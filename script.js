import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { ref, get, set, update } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { questionsPlates, matieresDuNiveau } from "./rounds.js";
import { NIVEAUX, infoNiveau, infoMatiere, matieresPourNiveau } from "./matieres.js";
import { htmlMath } from "./formules.js";
import { ordreAleatoire } from "./outils.js";
import { Sons, animerCompteur } from "./sons.js";
import { aujourdhui, gradeDe, totalXp } from "./progression.js";
import { assurerCompte } from "./abonnement.js";

const PLAFOND_JOUR = 50;
const CLE_HISTO = "ligue_historique";
const MAX_HISTO = 5000;
const CLE_RATEES = "ligue_ratees";

const $ = function (id) {
  return document.getElementById(id);
};

let uid = null;
let fiche = { pieces: 0, jours: {}, xp: 0, stats: {}, jeux: {} };
let session = null;
let niveauCourant = null;
let fileEcriture = Promise.resolve();
let reussitesSet = null;

function dejaGagne() {
  return fiche.jours[aujourdhui()] || 0;
}

function afficher(ecran) {
  ["ecran-niveau", "ecran-matiere", "ecran-quiz", "ecran-fin"].forEach(function (id) {
    $(id).hidden = id !== ecran;
  });
}

function majSolde() {
  $("solde").textContent = fiche.pieces;
  $("jour").textContent = dejaGagne() + " / " + PLAFOND_JOUR;
}

// ===== Mémoire des questions déjà vues (pour ne pas les répéter trop vite) =====
function lireHistorique() {
  try {
    const h = JSON.parse(localStorage.getItem(CLE_HISTO) || "{}");
    return h && typeof h === "object" ? h : {};
  } catch (e) {
    return {};
  }
}

function noterVue(id) {
  try {
    const h = lireHistorique();
    h[id] = Date.now();
    const cles = Object.keys(h);
    if (cles.length > MAX_HISTO) {
      cles
        .sort(function (a, b) {
          return h[a] - h[b];
        })
        .slice(0, cles.length - MAX_HISTO)
        .forEach(function (k) {
          delete h[k];
        });
    }
    localStorage.setItem(CLE_HISTO, JSON.stringify(h));
  } catch (e) {
    // sans importance
  }
}

// Les questions où tu t'es trompé : on les revoit en priorité en mode « Réviser »
function lireRatees() {
  try {
    const h = JSON.parse(localStorage.getItem(CLE_RATEES) || "{}");
    return h && typeof h === "object" ? h : {};
  } catch (e) {
    return {};
  }
}

function noterRatee(id, juste) {
  try {
    const h = lireRatees();
    if (juste) delete h[id];
    else h[id] = Date.now();
    localStorage.setItem(CLE_RATEES, JSON.stringify(h));
  } catch (e) {
    // sans importance
  }
}

// Les questions réussies sur un autre téléphone comptent aussi comme « déjà travaillées »
async function chargerReussites() {
  if (reussitesSet) return;
  try {
    const snap = await get(ref(db, "reussites/" + uid));
    reussitesSet = new Set(snap.exists() ? Object.keys(snap.val()) : []);
  } catch (e) {
    reussitesSet = new Set();
  }
}

function hasard() {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (c && c.getRandomValues) {
    const t = new Uint32Array(1);
    c.getRandomValues(t);
    return (t[0] + 0.5) / 4294967296;
  }
  return Math.random();
}

// Tirage au hasard où chaque question a un poids : plus le poids est grand, plus elle sort souvent
function choisirPondere(liste, poids) {
  let meilleure = null;
  let meilleureCle = -1;
  liste.forEach(function (q) {
    const cle = Math.pow(hasard(), 1 / Math.max(0.0001, poids(q)));
    if (cle > meilleureCle) {
      meilleureCle = cle;
      meilleure = q;
    }
  });
  return meilleure;
}

function rangsCatalogue() {
  const r = {};
  const toutes = questionsPlates(null, null);
  toutes.forEach(function (q, i) {
    r[q.id] = i;
  });
  r.max = Math.max(1, toutes.length - 1);
  return r;
}

function dejaTravaillee(h, id) {
  return !!h[id] || !!(reussitesSet && reussitesSet.has(id));
}

// Mode « nouvelles » : une question jamais travaillée, les plus récemment chargées en priorité.
// Quand tout a été vu, on reprend les plus anciennes.
// Mode « réviser » : une question déjà travaillée, celles où tu t'es trompé d'abord.
function choisirSuivante(s, candidats) {
  const h = lireHistorique();
  if (s.mode === "reviser") {
    const vues = candidats.filter(function (q) {
      return dejaTravaillee(h, q.id);
    });
    if (vues.length === 0) return null;
    const ratees = lireRatees();
    return choisirPondere(vues, function (q) {
      const age = h[q.id] ? 1 + (Date.now() - h[q.id]) / 86400000 : 8;
      return (ratees[q.id] ? 6 : 1) * Math.min(8, age);
    });
  }
  const neuves = candidats.filter(function (q) {
    return !dejaTravaillee(h, q.id);
  });
  if (neuves.length > 0) {
    s.faitLeTour = false;
    return choisirPondere(neuves, function (q) {
      return Math.exp(3 * ((s.rangs[q.id] || 0) / s.rangs.max));
    });
  }
  s.faitLeTour = true;
  return choisirPondere(candidats, function (q) {
    const age = h[q.id] ? 1 + (Date.now() - h[q.id]) / 86400000 : 8;
    return Math.min(8, age);
  });
}

// ===== Écran 1 : le niveau =====
function carte(emoji, titre, sousTitre, action, desactive) {
  const b = document.createElement("button");
  b.className = "carte-choix";
  b.disabled = !!desactive;
  const e = document.createElement("span");
  e.className = "gros-emoji";
  e.textContent = emoji;
  const t = document.createElement("span");
  t.className = "carte-texte";
  const n = document.createElement("b");
  n.textContent = titre;
  const s = document.createElement("span");
  s.textContent = sousTitre;
  t.appendChild(n);
  t.appendChild(s);
  b.appendChild(e);
  b.appendChild(t);
  if (!desactive) b.addEventListener("click", action);
  return b;
}

function pluriel(n, mot) {
  return n + " " + mot + (n > 1 ? "s" : "");
}

function afficherNiveaux() {
  majSolde();
  const zone = $("liste-niveaux");
  zone.innerHTML = "";
  let total = 0;
  NIVEAUX.forEach(function (n) {
    const nb = questionsPlates(n.id, null).length;
    total += nb;
    zone.appendChild(
      carte(
        n.emoji,
        n.nom,
        nb > 0 ? n.desc + " · " + pluriel(nb, "question") : "Bientôt disponible",
        function () {
          afficherMatieres(n.id);
        },
        nb === 0
      )
    );
  });
  $("vide-msg").hidden = total > 0;
  afficher("ecran-niveau");
}

// ===== Écran 2 : la matière =====
function afficherMatieres(niveauId) {
  niveauCourant = niveauId;
  const n = infoNiveau(niveauId);
  $("titre-niveau").textContent = n.emoji + " " + n.nom + " — Choisis une matière";

  // Toutes les matières de la salle, même celles qui n'ont pas encore de questions
  const comptes = {};
  matieresDuNiveau(niveauId).forEach(function (m) {
    comptes[m.id] = m.nb;
  });
  const ids = matieresPourNiveau(niveauId).map(function (m) {
    return m.id;
  });
  Object.keys(comptes).forEach(function (id) {
    if (ids.indexOf(id) === -1) ids.push(id);
  });

  const zone = $("liste-matieres");
  zone.innerHTML = "";
  const total = ids.reduce(function (somme, id) {
    return somme + (comptes[id] || 0);
  }, 0);
  if (total > 0) {
    zone.appendChild(
      carte("🎲", "Toutes les matières", pluriel(total, "question") + " mélangées", function () {
        lancer(niveauId, null);
      })
    );
  }
  ids.forEach(function (id) {
    const info = infoMatiere(id);
    const nb = comptes[id] || 0;
    zone.appendChild(
      carte(
        info.emoji,
        info.nom,
        nb > 0 ? pluriel(nb, "question") : "Bientôt disponible",
        function () {
          lancer(niveauId, id);
        },
        nb === 0
      )
    );
  });
  afficher("ecran-matiere");
}

// ===== Écran 3 : les questions, une par une =====
async function lancer(niveauId, matiereId) {
  const pool = questionsPlates(niveauId, matiereId);
  if (pool.length === 0) {
    $("erreur").textContent = "Aucune question disponible pour ce choix.";
    return;
  }
  $("erreur").textContent = "";
  await chargerReussites();
  session = {
    niveau: niveauId,
    matiere: matiereId,
    pool: pool,
    mode: "nouvelles",
    rangs: rangsCatalogue(),
    faitLeTour: false,
    numero: 0,
    derniere: null,
    q: null,
    ordre: [],
    verrou: false,
    serie: 0,
    serieMax: 0,
    bonnes: 0,
    repondues: 0,
    gain: 0,
    xp: 0
  };
  afficher("ecran-quiz");
  majEnTete();
  questionSuivante();
}

// Bandeau du haut : niveau, matière et mode (nouvelles questions ou révision)
function majEnTete() {
  const s = session;
  const info = s.matiere ? infoMatiere(s.matiere) : { emoji: "🎲", nom: "Toutes les matières" };
  $("nom-seance").textContent =
    infoNiveau(s.niveau).nom + " · " + info.emoji + " " + info.nom + (s.mode === "reviser" ? " · 📖 Révision" : "");
  const b = $("btn-reviser");
  if (b) {
    b.textContent = s.mode === "reviser" ? "🆕 Revenir aux nouvelles questions" : "📖 Réviser mes anciennes questions";
  }
}

// Bouton « Réviser » : on bascule entre les nouvelles questions et les anciennes déjà travaillées
function basculerMode() {
  const s = session;
  if (!s) return;
  if (s.mode === "nouvelles") {
    const h = lireHistorique();
    const nb = s.pool.filter(function (q) {
      return dejaTravaillee(h, q.id);
    }).length;
    if (nb === 0) {
      $("erreur").textContent = "Tu n’as pas encore d’ancienne question à réviser ici : continue avec les nouvelles.";
      return;
    }
    s.mode = "reviser";
  } else {
    s.mode = "nouvelles";
  }
  $("erreur").textContent = "";
  s.derniere = null;
  majEnTete();
  questionSuivante();
}

function creerBoutonReviser() {
  if ($("btn-reviser")) return;
  const b = document.createElement("button");
  b.id = "btn-reviser";
  b.style.cssText =
    "display:block;margin:16px auto 0;padding:11px 16px;border-radius:14px;border:2px solid var(--or);" +
    "background:rgba(255,213,74,0.14);color:#ffe9a0;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;";
  b.textContent = "📖 Réviser mes anciennes questions";
  b.addEventListener("click", basculerMode);
  $("btn-quitter").parentNode.insertBefore(b, $("btn-quitter"));
}

function majScoreSeance() {
  $("score-seance").textContent = "✅ " + session.bonnes + " / " + session.repondues;
  $("serie").textContent = session.serie >= 2 ? "🔥 Série x" + session.serie : "";
}

function questionSuivante() {
  const s = session;
  let candidats = s.pool;
  if (candidats.length > 1 && s.derniere) {
    candidats = candidats.filter(function (q) {
      return q.id !== s.derniere;
    });
  }
  let q = choisirSuivante(s, candidats);
  if (!q) {
    // plus rien à réviser : retour aux nouvelles questions
    s.mode = "nouvelles";
    majEnTete();
    q = choisirSuivante(s, candidats);
  }
  s.q = q;
  s.derniere = q.id;
  s.numero++;
  s.verrou = false;
  // L'ordre des choix est tiré au hasard à chaque question : la bonne réponse change de place
  s.ordre = ordreAleatoire(q.choix.length);
  noterVue(q.id);

  $("question").innerHTML = htmlMath(q.q);
  const etiquette = s.matiere ? "" : infoMatiere(q.matiere).emoji + " " + infoMatiere(q.matiere).nom;
  $("etiquette-q").textContent =
    (s.mode === "reviser" ? "📖 Révision" : s.faitLeTour ? "♻️ Tu as fait le tour : questions déjà vues" : "") +
    (etiquette ? (s.mode === "reviser" || s.faitLeTour ? " · " : "") + etiquette : "");
  $("retour-rep").textContent = "";
  $("explication").hidden = true;
  $("btn-suivant").hidden = true;
  $("btn-signaler").hidden = true;
  majScoreSeance();

  const zone = $("choix");
  zone.innerHTML = "";
  s.ordre.forEach(function (origine, k) {
    const b = document.createElement("button");
    b.innerHTML = htmlMath(q.choix[origine]);
    b.addEventListener("click", function () {
      repondre(k);
    });
    zone.appendChild(b);
  });
  window.scrollTo(0, 0);
}

function repondre(k) {
  const s = session;
  if (!s || s.verrou) return;
  s.verrou = true;
  const q = s.q;
  const juste = s.ordre[k] === q.bonne;
  const boutons = document.querySelectorAll("#choix button");
  boutons.forEach(function (b) {
    b.disabled = true;
  });
  boutons[s.ordre.indexOf(q.bonne)].classList.add("juste");
  s.repondues++;
  noterRatee(q.id, juste);

  if (juste) {
    s.serie++;
    if (s.serie > s.serieMax) s.serieMax = s.serie;
    s.bonnes++;
    $("retour-rep").textContent = "✅ Bonne réponse !";
    if (s.serie >= 2) Sons.serie(s.serie);
    Sons.bon();
  } else {
    boutons[k].classList.add("faux");
    s.serie = 0;
    $("retour-rep").textContent = "❌ Mauvaise réponse";
    Sons.faux();
  }
  majScoreSeance();

  // L'explication de la bonne réponse : seulement dans l'entraînement
  if (q.expl) {
    $("explication").innerHTML = "💡 " + htmlMath(q.expl);
    $("explication").hidden = false;
  }
  $("btn-suivant").hidden = false;
  $("btn-signaler").hidden = false;

  const numero = s.numero;
  const serie = s.serie;
  fileEcriture = fileEcriture
    .then(function () {
      return enregistrer(s, q, juste, serie, numero);
    })
    .catch(function (e) {
      $("erreur").textContent = "Enregistrement impossible : " + (e.code || e.message);
    });
}

// Une écriture par réponse : statistiques du jour, et récompense la première fois seulement
async function enregistrer(s, q, juste, serie, numero) {
  const jour = aujourdhui();
  const base = "joueurs/" + uid + "/";
  const st = fiche.stats[jour] || {};
  const bonnes = (st.bonnes || 0) + (juste ? 1 : 0);
  const repondues = (st.repondues || 0) + 1;
  const meilleure = Math.max(st.serie || 0, serie);

  const maj = {};
  maj[base + "stats/" + jour + "/repondues"] = repondues;
  if (juste) maj[base + "stats/" + jour + "/bonnes"] = bonnes;
  maj[base + "stats/" + jour + "/serie"] = meilleure;

  let premiere = false;
  let credite = 0;
  let xpGagne = 0;
  const gagneAvant = dejaGagne();
  const avant = fiche.pieces;
  const gradeAvant = gradeDe(totalXp(fiche)).index;

  if (juste) {
    // Chaque question ne rapporte qu'une seule fois (la première réussite)
    const vue = await get(ref(db, "reussites/" + uid + "/" + q.id));
    premiere = !vue.exists();
    if (premiere) {
      let g = 1;
      if (serie === 3) g += 1;
      if (serie === 5) g += 2;
      credite = Math.min(g, Math.max(0, PLAFOND_JOUR - gagneAvant));
      xpGagne = 2;
      maj["reussites/" + uid + "/" + q.id] = true;
      maj[base + "xp"] = fiche.xp + xpGagne;
      if (credite > 0) {
        maj[base + "pieces"] = fiche.pieces + credite;
        maj[base + "jours/" + jour] = gagneAvant + credite;
      }
    }
  }

  await update(ref(db), maj);

  fiche.stats[jour] = Object.assign({}, st, { bonnes: bonnes, repondues: repondues, serie: meilleure });
  if (premiere) {
    if (reussitesSet) reussitesSet.add(q.id);
    fiche.xp += xpGagne;
    s.xp += xpGagne;
    if (credite > 0) {
      fiche.pieces += credite;
      fiche.jours[jour] = gagneAvant + credite;
      s.gain += credite;
    }
  }

  // On met le message à jour seulement si on est encore sur cette question
  if (session === s && s.numero === numero && juste) {
    let texte = "✅ Bonne réponse !";
    if (!premiere) texte += " (déjà réussie : pas de récompense)";
    else if (credite > 0) texte += " +" + credite + " 🪙 · +" + xpGagne + " XP";
    else texte += " +" + xpGagne + " XP (plafond de pièces du jour atteint)";
    $("retour-rep").textContent = texte;
  }
  majSolde();
  if (credite > 0) animerCompteur($("solde"), avant, fiche.pieces, 700);

  const gradeApres = gradeDe(totalXp(fiche));
  if (gradeApres.index > gradeAvant) {
    $("bandeau-grade").textContent = "🎖️ Nouveau grade : " + gradeApres.grade.nom + " !";
    $("bandeau-grade").hidden = false;
    Sons.victoire();
    setTimeout(function () {
      $("bandeau-grade").hidden = true;
    }, 4000);
  }
}

// ===== Signaler une question =====
function ouvrirSignal() {
  if (!session || !session.q) return;
  $("signal-msg").textContent = "";
  $("fond-signal").hidden = false;
}

async function envoyerSignal(motif) {
  const q = session && session.q;
  if (!q) return;
  try {
    await set(ref(db, "signalements/" + q.rid + "/" + q.index + "/" + uid), {
      m: motif,
      t: Date.now()
    });
    $("signal-msg").textContent = "Merci ! Ton signalement a bien été envoyé.";
    setTimeout(function () {
      $("fond-signal").hidden = true;
    }, 1300);
  } catch (e) {
    $("signal-msg").textContent =
      e.code === "PERMISSION_DENIED"
        ? "Tu as déjà signalé cette question."
        : "Envoi impossible : " + (e.code || e.message);
  }
}

// ===== Écran 4 : bilan de la séance =====
function terminer() {
  const s = session;
  if (!s) return;
  if (s.repondues === 0) {
    session = null;
    afficherMatieres(s.niveau);
    return;
  }
  $("resultat").textContent = pluriel(s.bonnes, "bonne") + " réponse" + (s.bonnes > 1 ? "s" : "") + " sur " + s.repondues;
  let m = "";
  if (s.gain > 0) m += "+" + s.gain + " 🪙";
  if (s.xp > 0) m += (m ? " · " : "") + "+" + s.xp + " XP";
  if (!m) m = "Pas de nouvelle récompense : seules les premières réussites rapportent.";
  $("message").textContent = m;
  afficher("ecran-fin");
}

async function demarrer() {
  try {
    const cred = await signInAnonymously(auth);
    uid = cred.user.uid;
    // Premier passage : le compte est créé avec les 50 pièces de bienvenue
    await assurerCompte(uid);
    const snap = await get(ref(db, "joueurs/" + uid));
    const v = snap.exists() ? snap.val() : {};
    fiche = {
      pieces: v.pieces || 0,
      jours: v.jours || {},
      xp: v.xp || 0,
      stats: v.stats || {},
      jeux: v.jeux || {}
    };
    creerBoutonReviser();
    afficherNiveaux();
  } catch (err) {
    $("erreur").textContent = "Erreur : " + (err.code || "") + " " + err.message;
  }
}

$("btn-suivant").addEventListener("click", function () {
  if (session && session.verrou) questionSuivante();
});
$("btn-quitter").addEventListener("click", terminer);
$("btn-signaler").addEventListener("click", ouvrirSignal);
$("fermer-signal").addEventListener("click", function () {
  $("fond-signal").hidden = true;
});
document.querySelectorAll(".motif").forEach(function (b) {
  b.addEventListener("click", function () {
    envoyerSignal(b.getAttribute("data-m"));
  });
});
$("btn-retour-niveaux").addEventListener("click", afficherNiveaux);
$("btn-continuer").addEventListener("click", function () {
  if (session) lancer(session.niveau, session.matiere);
});
$("btn-matieres").addEventListener("click", function () {
  const n = session ? session.niveau : niveauCourant;
  session = null;
  if (n) afficherMatieres(n);
  else afficherNiveaux();
});

demarrer();
