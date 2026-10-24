import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  ref,
  get,
  onValue,
  update,
  runTransaction
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { ROUNDS } from "./rounds.js";
import { FORMATS } from "./formats.js";
import { ouvrirCycle, creerFiche, prolonger } from "./cycles.js";
import { initHorloge, maintenant } from "./horloge.js";

const MAX_PARTIES_JOUR = 10;
const MAX_JEU_MS = 910000;

const $ = function (id) {
  return document.getElementById(id);
};

let uid = null;
let solde = 0;
const courants = {};
const salons = {};
const abonnements = {};
const occupe = {};
const cartes = {};

function dire(texte) {
  $("msg").textContent = texte;
}

function nbJoueurs(s) {
  return s && s.joueurs ? Object.keys(s.joueurs).length : 0;
}

function creerCartes() {
  const zone = $("salles");
  FORMATS.forEach(function (f) {
    const carte = document.createElement("div");
    carte.className = "carte-salon";

    const texte = document.createElement("div");
    texte.className = "texte";
    const titre = document.createElement("b");
    titre.textContent = "Salle " + f.mise + " 🪙 · " + f.max + " joueurs";
    const detail = document.createElement("span");
    detail.style.display = "block";
    const statut = document.createElement("span");
    statut.style.display = "block";
    statut.style.color = "#ffd54a";
    statut.style.fontWeight = "800";
    texte.appendChild(titre);
    texte.appendChild(detail);
    texte.appendChild(statut);

    const bouton = document.createElement("button");
    bouton.className = "btn vert";
    bouton.textContent = "…";
    bouton.disabled = true;

    carte.appendChild(texte);
    carte.appendChild(bouton);
    zone.appendChild(carte);
    cartes[f.id] = { detail: detail, statut: statut, bouton: bouton };
  });
}

function majCartes() {
  const now = maintenant();
  FORMATS.forEach(function (f) {
    const c = cartes[f.id];
    const s = salons[f.id];
    const b = c.bouton;
    b.onclick = null;

    if (!s) {
      c.detail.textContent = "";
      c.statut.textContent = "Ouverture de la salle…";
      b.textContent = "…";
      b.disabled = true;
      return;
    }

    const n = nbJoueurs(s);
    const dedans = !!(s.joueurs && s.joueurs[uid]);
    const ouverte = !s.lanceLe && now < s.ferme;
    c.detail.textContent = "Inscrits : " + n + "/" + s.max + " · cagnotte " + s.mise * n + " 🪙";

    let statut;
    if (s.fini) {
      statut = "Terminée · nouvelle salle…";
    } else if (s.lanceLe) {
      statut = "Partie en cours…";
    } else if (ouverte) {
      const reste = Math.ceil((s.ferme - now) / 1000);
      statut = (n >= s.max ? "Complète · départ dans " : "Départ dans ") + reste + " s";
    } else if (n >= 2) {
      statut = "Départ…";
    } else {
      statut = "En attente de joueurs (minimum 2)…";
    }
    c.statut.textContent = statut;

    if (dedans) {
      b.textContent = "Reprendre";
      b.disabled = false;
      b.onclick = function () {
        window.location.href = "partie.html?s=" + encodeURIComponent(courants[f.id]);
      };
    } else if (ouverte && n < s.max) {
      b.textContent = "Rejoindre";
      b.disabled = false;
      b.onclick = function () {
        rejoindre(f.id);
      };
    } else {
      b.textContent = ouverte ? "Complète" : "Fermée";
      b.disabled = true;
    }
  });
}

async function rejoindre(fid) {
  const id = courants[fid];
  const s = salons[fid];
  if (!id || !s) return;

  const now = maintenant();
  if (s.lanceLe || now >= s.ferme) {
    dire("Les inscriptions sont fermées pour cette salle.");
    return;
  }
  if (solde < s.mise) {
    dire("Solde insuffisant : il te faut " + s.mise + " pièces (tu en as " + solde + ").");
    return;
  }

  try {
    const jour = new Date().toISOString().slice(0, 10);
    const snapJ = await get(ref(db, "joueurs/" + uid + "/jeux/" + jour));
    const nbJeux = snapJ.exists() ? snapJ.val() : 0;
    if (nbJeux >= MAX_PARTIES_JOUR) {
      dire("Limite du jour atteinte (" + MAX_PARTIES_JOUR + " parties payantes). Reviens demain !");
      return;
    }

    // On réserve une place de façon sûre, même si plusieurs candidats cliquent ensemble
    const res = await runTransaction(ref(db, "salons/" + id + "/nb"), function (n) {
      n = n || 0;
      if (n >= s.max) return;
      return n + 1;
    });
    if (!res.committed) {
      dire("Cette salle est déjà complète.");
      return;
    }

    try {
      const maj = {};
      maj["joueurs/" + uid + "/pieces"] = solde - s.mise;
      maj["joueurs/" + uid + "/jeux/" + jour] = nbJeux + 1;
      maj["salons/" + id + "/joueurs/" + uid] = maintenant();
      maj["salons/" + id + "/mises/" + uid] = s.mise;
      await update(ref(db), maj);
    } catch (e) {
      await runTransaction(ref(db, "salons/" + id + "/nb"), function (n) {
        return Math.max(0, (n || 1) - 1);
      });
      throw e;
    }

    window.location.href = "partie.html?s=" + encodeURIComponent(id);
  } catch (e) {
    dire("Impossible de rejoindre : " + (e.code || e.message));
  }
}

// Suit en direct la fiche du cycle courant d'une salle
function suivre(fid, id) {
  const a = abonnements[fid];
  if (a && a.id === id) return;
  if (a && a.stop) a.stop();
  salons[fid] = undefined;
  const stop = onValue(ref(db, "salons/" + id), function (snap) {
    salons[fid] = snap.val();
    majCartes();
  });
  abonnements[fid] = { id: id, stop: stop };
}

// Entretien du cycle : ouvrir la salle suivante, prolonger l'attente
function entretien() {
  const now = maintenant();
  FORMATS.forEach(function (f) {
    if (occupe[f.id] && now - occupe[f.id] < 4000) return;
    const id = courants[f.id];
    const s = salons[f.id];
    let action = null;

    if (id === null) {
      action = function () {
        ouvrirCycle(f.id, now, ROUNDS.length);
      };
    } else if (id && s === null) {
      action = function () {
        creerFiche(id, ROUNDS.length);
      };
    } else if (s) {
      if (s.fini) {
        action = function () {
          ouvrirCycle(f.id, s.fini, ROUNDS.length);
        };
      } else if (s.lanceLe && now > s.lanceLe + MAX_JEU_MS) {
        action = function () {
          ouvrirCycle(f.id, now, ROUNDS.length);
        };
      } else if (!s.lanceLe && now >= s.ferme && (s.nb || 0) < 2) {
        action = function () {
          prolonger(id, s.ferme, now);
        };
      }
    }

    if (action) {
      occupe[f.id] = now;
      action();
    }
  });
}

async function demarrer() {
  creerCartes();
  try {
    const cred = await signInAnonymously(auth);
    uid = cred.user.uid;

    await initHorloge();

    const snap = await get(ref(db, "joueurs/" + uid + "/pieces"));
    solde = snap.exists() ? snap.val() : 0;
    $("solde").textContent = solde;

    onValue(ref(db, "salles"), function (s) {
      const v = s.val() || {};
      FORMATS.forEach(function (f) {
        const id = v[f.id] && v[f.id].courant ? v[f.id].courant : null;
        courants[f.id] = id;
        if (id) suivre(f.id, id);
      });
    });

    setInterval(majCartes, 1000);
    setInterval(entretien, 2000);
  } catch (e) {
    dire("Erreur : " + (e.code || e.message));
  }
}

demarrer();
