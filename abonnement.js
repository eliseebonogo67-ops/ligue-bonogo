// Abonnement : cadeau de bienvenue, essai gratuit et accès au jeu
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { initHorloge, maintenant } from "./horloge.js";

// ===== RÉGLAGES : tout se change ici =====

// false pendant les tests : personne n'est bloqué.
// Passe à true le jour où le paiement Google Play est branché et que tu lances pour le public.
export const ABONNEMENT_ACTIF = false;

// Date de départ de l'abonnement. Les comptes créés avant cette date reçoivent leur essai
// de 7 jours à partir d'elle. Format : Date.UTC(année, mois - 1, jour).
export const LANCEMENT_MS = Date.UTC(2027, 0, 1);

export const ESSAI_JOURS = 7;
export const PRIX_FCFA = 1000;
export const CADEAU_PIECES = 50;

// Les pages réservées aux abonnés (et aux personnes en période d'essai).
// partie.html n'y est pas : un joueur qui a payé sa mise ne doit jamais être expulsé en pleine partie.
export const PAGES_PAYANTES = ["entrainement.html", "salon.html", "defi.html", "duel.html"];

// Passe à true quand l'achat Google Play fonctionne dans l'application
export const PAIEMENT_DISPONIBLE = false;

const JOUR_MS = 86400000;

export async function connecter() {
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

// Crée le compte au premier passage : 50 pièces offertes et date d'arrivée (début de l'essai).
// L'appel est partagé : plusieurs pages ou modules qui le demandent en même temps n'en font qu'un.
let promesseCompte = null;

async function creerCompte(uid) {
  await initHorloge();
  const lect = await Promise.all([
    get(ref(db, "joueurs/" + uid + "/creeLe")),
    get(ref(db, "joueurs/" + uid + "/pieces"))
  ]);
  if (lect[0].exists()) return { nouveau: false, cadeau: false };

  const maj = {};
  maj["joueurs/" + uid + "/creeLe"] = Math.round(maintenant());
  let cadeau = false;
  if (!lect[1].exists()) {
    maj["joueurs/" + uid + "/pieces"] = CADEAU_PIECES;
    cadeau = true;
  }
  try {
    await update(ref(db), maj);
  } catch (e) {
    return { nouveau: false, cadeau: false };
  }
  return { nouveau: true, cadeau: cadeau };
}

export function assurerCompte(uid) {
  if (!promesseCompte) promesseCompte = creerCompte(uid);
  return promesseCompte;
}

// phase : "essai", "abonne" ou "expire". acces : peut-il jouer ?
export async function lireStatut(uid) {
  await initHorloge();
  const lect = await Promise.all([
    get(ref(db, "joueurs/" + uid + "/creeLe")),
    get(ref(db, "abonnements/" + uid))
  ]);
  const now = maintenant();
  const creeLe = lect[0].exists() ? lect[0].val() : now;
  const finEssai = Math.max(creeLe, LANCEMENT_MS) + ESSAI_JOURS * JOUR_MS;
  const a = lect[1].exists() ? lect[1].val() : null;

  let phase;
  let jusqua = 0;
  if (a && a.jusqua > now) {
    phase = "abonne";
    jusqua = a.jusqua;
  } else if (now < finEssai) {
    phase = "essai";
  } else {
    phase = "expire";
  }
  const joursRestants =
    phase === "essai" ? Math.min(ESSAI_JOURS, Math.max(1, Math.ceil((finEssai - now) / JOUR_MS))) : 0;

  return {
    phase: phase,
    acces: !ABONNEMENT_ACTIF || phase !== "expire",
    libre: !ABONNEMENT_ACTIF,
    finEssai: finEssai,
    jusqua: jusqua,
    joursRestants: joursRestants
  };
}

export function dateLongue(ms) {
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Lancée sur chaque page par firebase.js : crée le compte, puis bloque l'accès si l'essai est fini
export async function garde() {
  try {
    const uid = await connecter();
    await assurerCompte(uid);
    if (!ABONNEMENT_ACTIF) return;
    const page = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (PAGES_PAYANTES.indexOf(page) === -1) return;
    const s = await lireStatut(uid);
    if (!s.acces) {
      window.location.replace("abonnement.html?retour=" + encodeURIComponent(page));
    }
  } catch (e) {
    // sans connexion on ne bloque pas : rien ne s'enregistre de toute façon
  }
                               }
