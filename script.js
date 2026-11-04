import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { ROUNDS } from "./rounds.js";
import { Sons, animerCompteur } from "./sons.js";
import { aujourdhui, gradeDe, totalXp } from "./progression.js";

const PLAFOND_JOUR = 50;
const $ = function (id) {
  return document.getElementById(id);
};

let uid = null;
let fiche = { pieces: 0, jours: {}, roundsJoues: {}, xp: 0, stats: {}, jeux: {} };
let etat = null;

function dejaGagne() {
  return fiche.jours[aujourdhui()] || 0;
}

function afficher(ecran) {
  ["ecran-accueil", "ecran-quiz", "ecran-fin"].forEach(function (id) {
    $(id).hidden = id !== ecran;
  });
}

function majSolde() {
  $("solde").textContent = fiche.pieces;
  $("jour").textContent = dejaGagne() + " / " + PLAFOND_JOUR;
}

function afficherAccueil() {
  majSolde();
  const liste = $("liste-rounds");
  liste.innerHTML = "";
  ROUNDS.forEach(function (r) {
    const joue = !!fiche.roundsJoues[r.id];
    const b = document.createElement("button");
    b.className = joue ? "joue" : "";
    b.textContent = r.titre + (joue ? " (déjà joué : 0 pièce)" : " (pièces à gagner)");
    b.addEventListener("click", function () {
      lancer(r);
    });
    liste.appendChild(b);
  });
  afficher("ecran-accueil");
}

function lancer(round) {
  etat = {
    round: round,
    index: 0,
    serie: 0,
    serieMax: 0,
    gain: 0,
    bonnes: 0,
    repondues: 0,
    deja: !!fiche.roundsJoues[round.id],
    verrou: false,
    fini: false
  };
  afficher("ecran-quiz");
  question();
}

function question() {
  const q = etat.round.questions[etat.index];
  etat.verrou = false;
  $("progression").textContent = "Question " + (etat.index + 1) + " / " + etat.round.questions.length;
  $("serie").textContent = etat.serie >= 2 ? "🔥 Série x" + etat.serie : "";
  $("question").textContent = q.q;
  $("retour-rep").textContent = "";
  $("explication").hidden = true;
  $("btn-suivant").hidden = true;

  const zone = $("choix");
  zone.innerHTML = "";
  q.choix.forEach(function (texte, i) {
    const b = document.createElement("button");
    b.textContent = texte;
    b.addEventListener("click", function () {
      repondre(i);
    });
    zone.appendChild(b);
  });
}

function repondre(i) {
  if (etat.verrou || etat.fini) return;
  etat.verrou = true;
  etat.repondues++;

  const q = etat.round.questions[etat.index];
  const boutons = document.querySelectorAll("#choix button");
  boutons.forEach(function (b) {
    b.disabled = true;
  });
  boutons[q.bonne].classList.add("juste");

  if (i === q.bonne) {
    etat.serie++;
    if (etat.serie > etat.serieMax) etat.serieMax = etat.serie;
    etat.bonnes++;
    let g = 1;
    if (etat.serie === 3) g += 1;
    if (etat.serie === 5) g += 2;
    etat.gain += g;
    $("retour-rep").textContent = etat.deja ? "Bonne réponse !" : "Bonne réponse ! +" + g + " 🪙";
    if (etat.serie >= 2) {
      $("serie").textContent = "🔥 Série x" + etat.serie;
      Sons.serie(etat.serie);
    }
    Sons.bon();
  } else {
    boutons[i].classList.add("faux");
    etat.serie = 0;
    $("serie").textContent = "";
    $("retour-rep").textContent = "Mauvaise réponse";
    Sons.faux();
  }

  // L'explication de la bonne réponse : seulement dans l'entraînement
  if (q.expl) {
    $("explication").textContent = "💡 " + q.expl;
    $("explication").hidden = false;
  }

  const dernier = etat.index + 1 >= etat.round.questions.length;
  $("btn-suivant").textContent = dernier ? "Terminer" : "Suivant →";
  $("btn-suivant").hidden = false;
}

async function finir() {
  if (!etat || etat.fini) return;
  etat.fini = true;
  const e = etat;
  const avant = fiche.pieces;
  const xpAvant = totalXp(fiche);

  if (e.repondues === 0) {
    afficherAccueil();
    return;
  }

  afficher("ecran-fin");
  $("resultat").textContent = e.bonnes + " bonne(s) réponse(s) sur " + e.round.questions.length;
  $("message").textContent = "Enregistrement...";

  const jour = aujourdhui();
  const base = "joueurs/" + uid + "/";
  const gagneAvant = dejaGagne();
  const st = fiche.stats[jour] || { bonnes: 0, rounds: 0, serie: 0 };
  const xpGagne = e.deja ? 0 : e.bonnes * 2 + (e.bonnes === e.round.questions.length ? 10 : 0);

  const maj = {};
  let credite = 0;
  if (!e.deja) {
    const reste = Math.max(0, PLAFOND_JOUR - gagneAvant);
    credite = Math.min(e.gain, reste);
    maj[base + "roundsJoues/" + e.round.id] = true;
    if (credite > 0) {
      maj[base + "pieces"] = fiche.pieces + credite;
      maj[base + "jours/" + jour] = gagneAvant + credite;
    }
    if (xpGagne > 0) maj[base + "xp"] = fiche.xp + xpGagne;
  }
  // Statistiques du jour : elles servent à la série de jours et au défi du jour
  maj[base + "stats/" + jour + "/bonnes"] = st.bonnes + e.bonnes;
  maj[base + "stats/" + jour + "/rounds"] = st.rounds + 1;
  maj[base + "stats/" + jour + "/serie"] = Math.max(st.serie, e.serieMax);

  let message = "";
  try {
    await update(ref(db), maj);
    fiche.stats[jour] = {
      bonnes: st.bonnes + e.bonnes,
      rounds: st.rounds + 1,
      serie: Math.max(st.serie, e.serieMax)
    };

    if (e.deja) {
      message = "Round déjà joué : aucune pièce ni XP gagnés.";
    } else {
      fiche.roundsJoues[e.round.id] = true;
      fiche.xp += xpGagne;
      if (credite > 0) {
        fiche.pieces += credite;
        fiche.jours[jour] = gagneAvant + credite;
        message = "+" + credite + " 🪙" + (credite < e.gain ? " (plafond du jour atteint)" : "");
      } else if (e.gain === 0) {
        message = "Aucune pièce gagnée cette fois.";
      } else {
        message = "Plafond du jour atteint : aucune pièce ajoutée.";
      }
      if (xpGagne > 0) message += " · +" + xpGagne + " XP";

      const apres = gradeDe(totalXp(fiche));
      if (apres.index > gradeDe(xpAvant).index) {
        message += " · 🎖️ Nouveau grade : " + apres.grade.nom + " !";
        Sons.victoire();
      }
    }
  } catch (err) {
    message = "Erreur d’enregistrement : " + err.message;
  }

  $("message").textContent = message;
  majSolde();
  if (credite > 0) animerCompteur($("solde"), avant, fiche.pieces, 900);
}

async function demarrer() {
  try {
    const cred = await signInAnonymously(auth);
    uid = cred.user.uid;
    const snap = await get(ref(db, "joueurs/" + uid));
    if (!snap.exists() || snap.val().pieces === undefined) {
      const maj = {};
      maj["joueurs/" + uid + "/pieces"] = 0;
      maj["joueurs/" + uid + "/creeLe"] = Date.now();
      await update(ref(db), maj);
      fiche = { pieces: 0, jours: {}, roundsJoues: {}, xp: 0, stats: {}, jeux: {} };
    } else {
      const v = snap.val();
      fiche = {
        pieces: v.pieces || 0,
        jours: v.jours || {},
        roundsJoues: v.roundsJoues || {},
        xp: v.xp || 0,
        stats: v.stats || {},
        jeux: v.jeux || {}
      };
    }
    afficherAccueil();
  } catch (err) {
    $("erreur").textContent = "Erreur : " + (err.code || "") + " " + err.message;
  }
}

$("btn-suivant").addEventListener("click", function () {
  if (!etat || etat.fini || !etat.verrou) return;
  etat.index++;
  if (etat.index < etat.round.questions.length) question();
  else finir();
});

$("btn-quitter").addEventListener("click", function () {
  if (etat) finir();
});

$("btn-retour").addEventListener("click", function () {
  afficherAccueil();
});

demarrer();
