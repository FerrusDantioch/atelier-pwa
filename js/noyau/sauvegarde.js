// =============================================================================
// sauvegarde.js — enregistre la partie sur l'appareil
// -----------------------------------------------------------------------------
// La partie est rangée dans IndexedDB, la base de données intégrée au
// navigateur (base « atelier-pwa »). Elle contient trois rangements :
//   - parties  : la partie en cours (clé « principale ») ;
//   - secours  : les copies de secours (les plus récentes sont gardées) ;
//   - abimees  : une sauvegarde illisible n'est jamais effacée, elle est
//                mise de côté ici (on pourra peut-être la réparer).
//
// Pourquoi pas le « localStorage » ? Toutes les applications de Ferrus
// partagent la même adresse, donc le même petit espace localStorage (5 Mo) :
// IndexedDB offre beaucoup plus de place et ne gêne pas les autres.
//
// Si IndexedDB n'est pas disponible (certains modes de navigation privée),
// la partie reste en mémoire le temps de la visite et le jeu le dit
// clairement : il faut alors exporter sa partie dans un fichier.
// =============================================================================

import { annoncer } from './evenements.js';
import {
  ErreurSauvegarde, nomFichierExport, preparerPartie, resumerPartie, serialiserPartie,
} from './format-sauvegarde.js';

const CLE_PRINCIPALE = 'principale';
const ID_ONGLET = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let base = null;
let canalOnglets = null;
let modeMemoire = false;
const memoire = { partie: null, secours: [], abimees: [], prochainId: 1 };
let copiesMaximum = 5;

function ouvrirCanalOnglets() {
  canalOnglets?.close();
  canalOnglets = null;
  if (typeof self.BroadcastChannel !== 'function') return;
  try {
    canalOnglets = new self.BroadcastChannel(`${self.CONFIG_JEU.idStockage}.sauvegarde`);
    canalOnglets.unref?.();
    canalOnglets.onmessage = (evenement) => {
      const message = evenement.data || {};
      if (message.type === 'sauvegarde' && message.onglet !== ID_ONGLET) {
        annoncer('sauvegarde:autre-onglet', { date: message.date });
      }
    };
  } catch {
    canalOnglets = null;
  }
}

export function fermerSauvegarde() {
  canalOnglets?.close();
  canalOnglets = null;
  base?.close();
  base = null;
}

function prevenirAutresOnglets(date) {
  try {
    canalOnglets?.postMessage({ type: 'sauvegarde', onglet: ID_ONGLET, date });
  } catch {
    // canal fermé ou indisponible
  }
}

// --- Petits outils pour IndexedDB (qui fonctionne par « demandes ») ---------

function attendre(demande) {
  return new Promise((resoudre, rejeter) => {
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
  });
}

function terminer(transaction) {
  return new Promise((resoudre, rejeter) => {
    transaction.oncomplete = () => resoudre();
    transaction.onerror = () => rejeter(transaction.error);
    transaction.onabort = () => rejeter(transaction.error || new Error('transaction annulée'));
  });
}

function ouvrirBase(nom) {
  return new Promise((resoudre, rejeter) => {
    const demande = indexedDB.open(nom, 1);
    demande.onupgradeneeded = () => {
      const db = demande.result;
      if (!db.objectStoreNames.contains('parties')) db.createObjectStore('parties');
      if (!db.objectStoreNames.contains('secours')) db.createObjectStore('secours', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('abimees')) db.createObjectStore('abimees', { keyPath: 'id', autoIncrement: true });
    };
    demande.onsuccess = () => {
      const db = demande.result;
      // Si un autre onglet demande une mise à niveau future de la base, on
      // ferme proprement cette connexion au lieu de le bloquer.
      db.onversionchange = () => {
        db.close();
        if (base === db) base = null;
      };
      resoudre(db);
    };
    demande.onerror = () => rejeter(demande.error);
    demande.onblocked = () => rejeter(new Error('base bloquée par un autre onglet'));
  });
}

// --- Ouverture ---------------------------------------------------------------

export async function ouvrirSauvegarde({ copiesDeSecours = 5 } = {}) {
  copiesMaximum = copiesDeSecours;
  try {
    if (!self.indexedDB) throw new Error('IndexedDB absent');
    base = await ouvrirBase(self.CONFIG_JEU.idStockage);
    modeMemoire = false;
  } catch (erreur) {
    console.warn('Sauvegarde en mémoire seulement :', erreur);
    base = null;
    modeMemoire = true;
  }
  ouvrirCanalOnglets();
  return { modeMemoire };
}

export function estEnModeMemoire() {
  return modeMemoire;
}

// --- Lecture / écriture de la partie en cours --------------------------------

async function lireBrut() {
  if (modeMemoire) return memoire.partie;
  if (!base) throw new Error('base fermée');
  const transaction = base.transaction('parties', 'readonly');
  return attendre(transaction.objectStore('parties').get(CLE_PRINCIPALE));
}

async function ecrireBrut(partie) {
  if (modeMemoire) {
    memoire.partie = partie;
    return;
  }
  if (!base) throw new Error('base fermée');
  const transaction = base.transaction('parties', 'readwrite');
  transaction.objectStore('parties').put(partie, CLE_PRINCIPALE);
  await terminer(transaction);
}

async function mettreDeCote(brute, raison) {
  const element = { date: new Date().toISOString(), raison, donnees: brute };
  if (modeMemoire) {
    memoire.abimees.push(element);
    return;
  }
  if (!base) return;
  const transaction = base.transaction('abimees', 'readwrite');
  transaction.objectStore('abimees').add(element);
  await terminer(transaction);
}

// --- Copie d'urgence -------------------------------------------------------------
// Quand le jeu se ferme ou passe en arrière-plan, la base de données n'a pas
// toujours le temps de finir d'écrire. On range donc aussi, instantanément,
// une copie d'urgence dans le localStorage (écriture immédiate). Au
// lancement suivant, si elle est plus récente que la sauvegarde, c'est elle
// qui est reprise ; puis elle est effacée.

function cleUrgence() {
  return `${self.CONFIG_JEU.idStockage}.partie-urgence`;
}

export function ecrireCopieUrgence(partie) {
  if (!partie) return false;
  try {
    const copie = { ...partie, enregistreeLe: new Date().toISOString(), versionJeu: self.CONFIG_JEU.version };
    self.localStorage.setItem(cleUrgence(), JSON.stringify(copie));
    return true;
  } catch {
    return false; // stockage plein ou indisponible : la sauvegarde normale reste
  }
}

function effacerCopieUrgence() {
  try {
    self.localStorage.removeItem(cleUrgence());
  } catch {
    // rien à faire
  }
}

// Reprend la copie d'urgence si elle est plus récente que la sauvegarde.
async function reprendreCopieUrgence() {
  let texte = null;
  try {
    texte = self.localStorage.getItem(cleUrgence());
  } catch {
    return;
  }
  if (!texte) return;
  try {
    const urgence = preparerPartie(JSON.parse(texte));
    const brute = await lireBrut();
    if (!brute || String(urgence.enregistreeLe) > String(brute.enregistreeLe || '')) {
      await ecrireBrut(urgence);
    }
  } catch (erreur) {
    console.warn('Copie d\'urgence illisible, ignorée :', erreur);
  }
  effacerCopieUrgence();
}

// Lit la partie en cours.
// Renvoie { partie, etat } avec etat = 'aucune' | 'ok' | 'reparee' | 'perdue'.
// Une partie illisible est mise de côté, et la copie de secours la plus
// récente la remplace, sans rien demander (l'interface prévient le joueur).
export async function lirePartie() {
  await reprendreCopieUrgence();
  const brute = await lireBrut();
  if (brute === undefined || brute === null) return { partie: null, etat: 'aucune' };
  try {
    return { partie: preparerPartie(brute), etat: 'ok' };
  } catch (erreur) {
    if (!(erreur instanceof ErreurSauvegarde)) throw erreur;
    console.warn('Sauvegarde illisible, mise de côté :', erreur);
    await mettreDeCote(brute, erreur.message);
    for (const copie of await listerCopies()) {
      try {
        const partie = preparerPartie(copie.partie);
        await ecrireBrut(partie);
        return { partie, etat: 'reparee', copie };
      } catch {
        // copie illisible elle aussi : on essaie la précédente
      }
    }
    return { partie: null, etat: 'perdue' };
  }
}

// Enregistre la partie (la date d'enregistrement est mise à jour).
export async function enregistrerPartie(partie) {
  partie.enregistreeLe = new Date().toISOString();
  partie.versionJeu = self.CONFIG_JEU.version;
  try {
    await ecrireBrut(partie);
    // La sauvegarde est à jour : la copie d'urgence ne sert plus.
    effacerCopieUrgence();
    prevenirAutresOnglets(partie.enregistreeLe);
    annoncer('sauvegarde:faite', { date: partie.enregistreeLe });
    return true;
  } catch (erreur) {
    console.error('Échec de la sauvegarde :', erreur);
    annoncer('sauvegarde:echec', { erreur });
    return false;
  }
}

// --- Copies de secours --------------------------------------------------------
// raison : 'nouveau-jour' | 'avant-import' | 'avant-nouvelle-partie'
//        | 'avant-restauration' | 'manuelle'

export async function creerCopieDeSecours(partie, raison) {
  if (!partie) return false;
  const copie = { date: new Date().toISOString(), raison, partie: JSON.parse(JSON.stringify(partie)) };
  if (modeMemoire) {
    memoire.secours.push({ ...copie, id: memoire.prochainId });
    memoire.prochainId += 1;
    memoire.secours = memoire.secours.slice(-copiesMaximum);
    return true;
  }
  try {
    if (!base) throw new Error('base fermée');
    const transaction = base.transaction('secours', 'readwrite');
    const rangement = transaction.objectStore('secours');
    rangement.add(copie);
    // On ne garde que les plus récentes (les clés vont de la plus ancienne à
    // la plus récente, nouvelle copie comprise).
    const cles = await attendre(rangement.getAllKeys());
    const enTrop = cles.length - copiesMaximum;
    for (const cleCopie of cles.slice(0, Math.max(0, enTrop))) rangement.delete(cleCopie);
    await terminer(transaction);
    return true;
  } catch (erreur) {
    console.warn('Copie de secours impossible :', erreur);
    annoncer('sauvegarde:copie-echec', { erreur });
    return false;
  }
}

// Les copies, de la plus récente à la plus ancienne.
export async function listerCopies() {
  let copies;
  if (modeMemoire) {
    copies = [...memoire.secours];
  } else {
    if (!base) return [];
    const transaction = base.transaction('secours', 'readonly');
    copies = await attendre(transaction.objectStore('secours').getAll());
  }
  return copies
    .sort((a, b) => b.id - a.id)
    .map((copie) => {
      let resume = null;
      try {
        resume = resumerPartie(copie.partie);
      } catch {
        resume = null;
      }
      return { ...copie, resume };
    });
}

// Reprend une copie de secours (la partie actuelle est d'abord copiée).
export async function restaurerCopie(id, partieActuelle) {
  const copie = (await listerCopies()).find((element) => element.id === id);
  if (!copie) throw new ErreurSauvegarde('copieIntrouvable');
  const partie = preparerPartie(copie.partie);
  await creerCopieDeSecours(partieActuelle, 'avant-restauration');
  partie.enregistreeLe = new Date().toISOString();
  partie.versionJeu = self.CONFIG_JEU.version;
  await ecrireBrut(partie);
  effacerCopieUrgence();
  prevenirAutresOnglets(partie.enregistreeLe);
  return partie;
}

// Remplace la partie en cours (nouvelle partie, import) après en avoir gardé
// une copie de secours.
export async function remplacerPartie(nouvelle, ancienne, raison) {
  await creerCopieDeSecours(ancienne, raison);
  return enregistrerPartie(nouvelle);
}

// --- Export dans un fichier -----------------------------------------------------

export function exporterPartie(partie) {
  const fichier = new Blob([serialiserPartie(partie)], { type: 'application/json' });
  const adresse = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = adresse;
  lien.download = nomFichierExport();
  document.body.append(lien);
  lien.click();
  lien.remove();
  // On laisse au navigateur le temps de commencer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(adresse), 10000);
  return lien.download;
}
