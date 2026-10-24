import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  ref,
  get,
  set,
  update,
  onValue,
  runTransaction
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { ROUNDS } from "./rounds.js";
import { calculerTournoi } from "./partiemoteur.js";
import { ouvrirCycle, prolonger } from "./cycles.js";
import { initHorloge, maintenant } from "./horloge.js";

const params = new URLSearchParams(window.location.search);
const salonId = params.get("s");

// partiemoteur.js attend 10 s après le départ : on en retire 7 pour démarrer 3 s après la fin des inscriptions
const DECALAGE_DEPART_MS = 7000;

let uid = null;
let salon = null;
let partie = {};
let envoyees = {};
let rendu = "";
let lanceTente = false;
let prolongeTente = false;
let cycleTermine = false;
let reclameEnCours = false;
let bilan = "";

const $ = function (id) {
  return document.getElementById(id);
};

function erreur(e) {
  $("erreur").textContent = typeof e === "string" ? e : (e.code || "") + " " + e.message;
}

function listeJoueurs() {
  const j = (salon && salon.joueurs) || {};
  return Object.keys(j).sort(function (a, b) {
    return j[a] - j[b] || (a < b ? -1 : 1);
  });
}

function nomJoueur(id) {
  if (id === uid) return "Toi";
  return "Joueur " + (listeJoueurs().indexOf(id) + 1);
}

function miseDe(id) {
  return (salon && salon.mises && salon.mises[id]) || 0;
}

function pot() {
  const m = (salon && salon.mises) || {};
  return Object.keys(m).reduce(function (total, k) {
    return total + m[k];
  }, 0);
}

function etat(texte) {
  $("statut").textContent = texte;
  $("statut").hidden = false;
  $("zone-question").hidden = true;
  $("zone-fin").hidden = true;
  rendu = "";
}

// Haut de l'écran : la note et les cases vert/rouge de chacun, pour comparer
function afficherClassement(scores, enJeu, tous, marques) {
  const zone = $("classement");
  zone.innerHTML = "";
  const ordre = tous.slice().sort(function (a, b) {
    const ja = enJeu.indexOf(a) !== -1 ? 1 : 0;
    const jb = enJeu.indexOf(b) !== -1 ? 1 : 0;
    if (ja !== jb) return jb - ja;
    return (scores[b] || 0) - (scores[a] || 0);
  });
  ordre.forEach(function (id) {
    const actif = enJeu.indexOf(id) !== -1;
    const d = document.createElement("div");
    d.className = "joueur" + (id === uid ? " moi" : "") + (actif ? "" : " elimine");

    const n = document.createElement("span");
    n.textContent = nomJoueur(id) + (actif ? "" : " ✗");
    d.appendChild(n);

    if (marques && marques[id]) {
      const mk = document.createElement("span");
      mk.textContent = marques[id]
        .map(function (v) {
          return v === null ? "▫️" : v === 1 ? "🟩" : "🟥";
        })
        .join("");
      mk.style.fontSize = "12px";
      d.appendChild(mk);
    }

    const s = document.createElement("b");
    s.textContent = scores[id] !== undefined ? scores[id] : "–";
    d.appendChild(s);

    zone.appendChild(d);
  });
}

function maReponse(n, i) {
  const cle = n + "-" + i;
  if (envoyees[cle] !== undefined) return envoyees[cle];
  const r = partie["m" + n] && partie["m" + n]["q" + i] && partie["m" + n]["q" + i][uid];
  return r ? r.c : null;
}

function majBoutons(q, c, bloque, revele) {
  document.querySelectorAll("#choix button").forEach(function (b, k) {
    b.disabled = bloque || c !== null;
    b.classList.toggle("choisi", c === k);
    b.classList.toggle("juste", revele && k === q.bonne);
    b.classList.toggle("faux", revele && c === k && k !== q.bonne);
  });
}

async function envoyer(n, i, k, q) {
  const cle = n + "-" + i;
  if (envoyees[cle] !== undefined || maReponse(n, i) !== null) return;
  envoyees[cle] = k;
  majBoutons(q, k, false, false);
  try {
    // L'heure du clic est un nombre fixe : tout le monde lit la même valeur
    await set(ref(db, "parties/" + salonId + "/m" + n + "/q" + i + "/" + uid), {
      c: k,
      t: maintenant()
    });
  } catch (e) {
    erreur(e);
  }
}

function montrerQuestion(m, i, q) {
  $("statut").hidden = true;
  $("zone-fin").hidden = true;
  $("zone-question").hidden = false;
  const cle = m.n + "-" + i;
  if (rendu !== cle) {
    rendu = cle;
    $("numero").textContent = "Question " + (i + 1) + " / " + m.round.questions.length;
    $("question").textContent = q.q;
    const zone = $("choix");
    zone.innerHTML = "";
    q.choix.forEach(function (texte, k) {
      const b = document.createElement("button");
      b.textContent = texte;
      b.addEventListener("click", function () {
        envoyer(m.n, i, k, q);
      });
      zone.appendChild(b);
    });
  }
}

function phaseQuestion(m, i, q, p, now) {
  montrerQuestion(m, i, q);
  $("chrono").textContent = "⏱ " + Math.ceil((p.fin - now) / 1000) + " s";
  const c = maReponse(m.n, i);
  majBoutons(q, c, false, false);
  $("info").textContent = c !== null ? "Réponse envoyée ✓" : "";
}

function phaseCalcul(m, i, q) {
  montrerQuestion(m, i, q);
  $("chrono").textContent = "⏱ 0 s";
  majBoutons(q, maReponse(m.n, i), true, false);
  $("info").textContent = "Calcul du résultat…";
}

function phaseResultat(m, i, q, now) {
  montrerQuestion(m, i, q);
  const plan = m.plan;
  const suivante = i < plan.questions.length - 1 ? plan.questions[i + 1].debut : plan.fin;
  const c = maReponse(m.n, i);
  majBoutons(q, c, true, true);
  $("chrono").textContent = "Suite dans " + Math.max(0, Math.ceil((suivante - now) / 1000)) + " s";
  if (c === null) $("info").textContent = "Pas de réponse";
  else if (c === q.bonne) $("info").textContent = "✅ Bonne réponse";
  else $("info").textContent = "❌ Mauvaise réponse";
}

function avantManche(t, m, tous, now) {
  const reste = Math.ceil((m.debut - now) / 1000);
  if (t.manches.length === 1) {
    $("titre-manche").textContent = ROUNDS[salon.round] ? ROUNDS[salon.round].titre : "";
    $("classement").innerHTML = "";
    etat("La partie commence dans " + reste + " s");
    return;
  }
  const prev = t.manches[t.manches.length - 2];
  $("titre-manche").textContent = "Égalité en tête !";
  afficherClassement(prev.scores, m.joueurs, tous, prev.marques);
  const dedans = m.joueurs.indexOf(uid) !== -1;
  etat((dedans ? "Tu continues" : "Tu es éliminé") + " · manche " + m.n + " dans " + reste + " s");
}

async function reclamer(gain) {
  if (reclameEnCours) return;
  reclameEnCours = true;
  try {
    const snap = await get(ref(db, "joueurs/" + uid + "/pieces"));
    const solde = snap.exists() ? snap.val() : 0;
    const maj = {};
    maj["joueurs/" + uid + "/pieces"] = solde + gain;
    maj["parties/" + salonId + "/reclame/" + uid] = true;
    await update(ref(db), maj);
    bilan = "✓ " + gain + " 🪙 ajoutées à ton solde";
  } catch (e) {
    bilan = e.code === "PERMISSION_DENIED" ? "Gain déjà encaissé" : "Erreur : " + (e.code || e.message);
  }
}

// La partie est finie : on le note, puis la salle suivante s'ouvre (45 s d'inscription)
async function terminerCycle(fin) {
  if (cycleTermine || !salon || !salon.fid) return;
  cycleTermine = true;
  try {
    await set(ref(db, "salons/" + salonId + "/fini"), fin);
  } catch (e) {
    // un autre joueur l'a déjà écrit
  }
  await ouvrirCycle(salon.fid, fin, ROUNDS.length);
}

function finTournoi(t, m, tous) {
  afficherClassement(m.scores, m.joueurs, tous, m.marques);
  $("titre-manche").textContent = "Partie terminée";
  $("statut").hidden = true;
  $("zone-question").hidden = true;
  $("zone-fin").hidden = false;

  const g = t.gagnants;
  const jeGagne = g.indexOf(uid) !== -1;
  const gain = Math.floor(pot() / g.length);

  let titre;
  if (!t.partage) {
    titre = jeGagne ? "🏆 Tu remportes la cagnotte !" : "Défaite : " + nomJoueur(g[0]) + " gagne";
  } else {
    titre = jeGagne
      ? "🤝 Égalité finale : cagnotte partagée"
      : "Égalité finale entre " + g.map(nomJoueur).join(", ");
  }
  $("fin-titre").textContent = titre;

  let detail = "Cagnotte : " + pot() + " 🪙";
  if (jeGagne) {
    detail += "\nTu reçois " + gain + " 🪙";
    reclamer(gain);
    if (bilan) detail += "\n" + bilan;
  } else {
    detail += "\nTu perds ton droit d’entrée de " + miseDe(uid) + " 🪙";
  }
  $("fin-detail").textContent = detail;

  terminerCycle(m.plan.fin);
}

function lancerSiPret() {
  if (lanceTente) return;
  lanceTente = true;
  // Le départ est exactement l'heure de fermeture des inscriptions
  set(ref(db, "salons/" + salonId + "/lanceLe"), salon.ferme).catch(function () {
    // un autre joueur l'a déjà fait
  });
  setTimeout(function () {
    lanceTente = false;
  }, 5000);
}

function prolongerSiBesoin() {
  if (prolongeTente) return;
  prolongeTente = true;
  prolonger(salonId, salon.ferme, maintenant());
  setTimeout(function () {
    prolongeTente = false;
  }, 4000);
}

function afficher() {
  if (!uid) return;
  if (!salon) {
    etat("Chargement…");
    return;
  }

  const now = maintenant();
  const tous = listeJoueurs();
  const round = ROUNDS[salon.round] || ROUNDS[0];
  $("cagnotte").textContent = pot();

  if (tous.indexOf(uid) === -1) {
    $("retour").hidden = false;
    $("btn-quitter").hidden = true;
    $("liste-attente").hidden = true;
    etat("Tu n’es pas inscrit à cette partie.");
    return;
  }

  // 1. Inscriptions
  if (!salon.lanceLe) {
    $("retour").hidden = false;
    $("titre-manche").textContent = "Salle " + salon.mise + " 🪙 · " + round.titre;
    $("classement").innerHTML = "";
    const n = tous.length;

    if (now < salon.ferme) {
      const reste = Math.ceil((salon.ferme - now) / 1000);
      $("btn-quitter").hidden = false;
      $("liste-attente").hidden = false;
      $("liste-attente").textContent = tous.map(nomJoueur).join("  ·  ");
      etat(
        (n >= salon.max ? "Salle complète" : "Inscriptions ouvertes") +
          " · " + n + " / " + salon.max + "\nDépart dans " + reste + " s"
      );
    } else if (n >= 2) {
      $("btn-quitter").hidden = true;
      $("liste-attente").hidden = true;
      etat("Départ…");
      lancerSiPret();
    } else {
      $("btn-quitter").hidden = true;
      etat("Il faut au moins 2 joueurs.\nNouvelle attente de 45 s…");
      prolongerSiBesoin();
    }
    return;
  }

  // 2. Partie lancée
  $("btn-quitter").hidden = true;
  $("liste-attente").hidden = true;

  const t = calculerTournoi(tous, salon.lanceLe - DECALAGE_DEPART_MS, salon.round, ROUNDS, partie, now);
  const m = t.manches[t.manches.length - 1];

  if (t.termine) {
    $("retour").hidden = false;
    finTournoi(t, m, tous);
    return;
  }
  $("retour").hidden = true;

  if (now < m.debut) {
    avantManche(t, m, tous, now);
    return;
  }

  const plan = m.plan;
  const nq = plan.questions.length;
  let i = 0;
  while (i < nq - 1 && now >= plan.questions[i + 1].debut) i++;
  const p = plan.questions[i];
  const q = m.round.questions[i];

  $("titre-manche").textContent = "Manche " + m.n + " · " + m.round.titre;
  afficherClassement(m.scores, m.joueurs, tous, m.marques);

  if (m.joueurs.indexOf(uid) === -1) {
    etat("Tu es éliminé. Tu suis la suite…");
    return;
  }

  if (now < p.fin) phaseQuestion(m, i, q, p, now);
  else if (now < p.revele) phaseCalcul(m, i, q);
  else phaseResultat(m, i, q, now);
}

async function quitter() {
  if (!salon || salon.lanceLe) return;
  const mise = miseDe(uid);
  try {
    const snap = await get(ref(db, "joueurs/" + uid + "/pieces"));
    const solde = snap.exists() ? snap.val() : 0;
    const maj = {};
    maj["salons/" + salonId + "/joueurs/" + uid] = null;
    maj["salons/" + salonId + "/mises/" + uid] = null;
    maj["joueurs/" + uid + "/pieces"] = solde + mise;
    await update(ref(db), maj);
    await runTransaction(ref(db, "salons/" + salonId + "/nb"), function (n) {
      return Math.max(0, (n || 1) - 1);
    });
    window.location.href = "salon.html";
  } catch (e) {
    erreur(e);
  }
}

$("btn-quitter").addEventListener("click", quitter);
$("statut").style.whiteSpace = "pre-line";

// Le haut de l'écran (notes des joueurs) reste visible quand on fait défiler
const zoneClassement = $("classement");
zoneClassement.style.position = "sticky";
zoneClassement.style.top = "0";
zoneClassement.style.zIndex = "5";
zoneClassement.style.padding = "8px 0";
zoneClassement.style.background = "rgba(8, 14, 70, 0.94)";

async function demarrer() {
  if (!salonId) {
    erreur("Ouvre salon.html pour choisir une salle.");
    return;
  }
  try {
    const cred = await signInAnonymously(auth);
    uid = cred.user.uid;

    await initHorloge();

    onValue(ref(db, "salons/" + salonId), function (s) {
      salon = s.val();
    });
    onValue(ref(db, "parties/" + salonId), function (s) {
      partie = s.val() || {};
    });
    setInterval(afficher, 250);
  } catch (e) {
    erreur(e);
  }
}

demarrer();
