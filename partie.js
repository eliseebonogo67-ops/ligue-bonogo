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
import { calculerTournoi, calculerElimination, SEUIL_ELIMINATION } from "./partiemoteur.js";
import { ouvrirCycle, prolonger } from "./cycles.js";
import { initHorloge, maintenant } from "./horloge.js";
import { Sons } from "./sons.js";
import { article, DEFAUTS } from "./profil.js";
import { ordreReproductible } from "./outils.js";
import { installerSignalement } from "./signalement.js";
import { htmlMath } from "./formules.js";
import { infoMatiere } from "./matieres.js";
import { questionParId, noterVus } from "./tirage.js";

const params = new URLSearchParams(window.location.search);
const salonId = params.get("s");

// partiemoteur.js attend 10 s après le départ : on en retire 7 pour démarrer 3 s après la fin des inscriptions
const DECALAGE_DEPART_MS = 7000;

// Au-delà de ce nombre de joueurs, le classement du haut devient compact
const SEUIL_COMPACT = 4;

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
let dernierTic = "";
let sonsJoues = {};
let departsJoues = {};
let finSonJoue = false;
let entreeSonJoue = false;
let classementOuvert = false;
let signatureClassement = "";
let profils = {};
let profilsDemandes = {};
let versionProfils = 0;
let signal = null;
let cibleSignal = null;
let manchesSalle = null;
let manchesPour = "";
let vusNotes = {};

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

// Les 30 questions de la salle sont tirées une fois pour toutes à l'ouverture et enregistrées dans la base :
// tous les joueurs voient les mêmes. Chaque manche a exactement 5 questions.
function mancheDeSalle() {
  if (!salon || !salon.qs) return null;
  const ids = Array.isArray(salon.qs)
    ? salon.qs
    : Object.keys(salon.qs)
        .sort(function (a, b) {
          return Number(a) - Number(b);
        })
        .map(function (k) {
          return salon.qs[k];
        });
  const cle = ids.join("|");
  if (manchesSalle && manchesPour === cle) return manchesSalle;
  const questions = ids.map(function (id) {
    return questionParId(id);
  });
  if (
    questions.length < 30 ||
    questions.some(function (q) {
      return !q;
    })
  ) {
    return null;
  }
  const manches = [];
  for (let n = 0; n < 6; n++) {
    manches.push({ id: "comp_m" + (n + 1), titre: "Manche " + (n + 1), questions: questions.slice(n * 5, n * 5 + 5) });
  }
  manchesSalle = manches;
  manchesPour = cle;
  return manches;
}

// Ces questions viennent d'être jouées : elles ne reviendront pas tout de suite dans les prochaines compétitions
function noterJouees(cle, questions) {
  if (vusNotes[cle]) return;
  vusNotes[cle] = true;
  noterVus(
    "comp",
    questions.map(function (q) {
      return q.id;
    })
  );
}

// Charge une seule fois l'animal et le pseudo des joueurs demandés
function chargerProfils(ids) {
  ids.forEach(function (id) {
    if (profilsDemandes[id]) return;
    profilsDemandes[id] = true;
    get(ref(db, "profils/" + id))
      .then(function (snap) {
        profils[id] = snap.exists() ? snap.val() : {};
        versionProfils++;
      })
      .catch(function () {
        profils[id] = {};
      });
  });
}

function emojiAnimal(p) {
  const a = article(p && p.animal ? p.animal : DEFAUTS.animal) || article(DEFAUTS.animal);
  return a.emoji;
}

function nomJoueur(id) {
  const p = profils[id];
  if (id === uid) return (p ? emojiAnimal(p) + " " : "") + "Toi";
  const base = "Joueur " + (listeJoueurs().indexOf(id) + 1);
  if (p && p.pseudo) return emojiAnimal(p) + " " + p.pseudo;
  if (p && p.animal) return emojiAnimal(p) + " " + base;
  return base;
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

function viderClassement() {
  $("classement").innerHTML = "";
  signatureClassement = "";
}

// Une pastille : nom, cases vert/rouge (si demandées) et note
function puce(id, enJeu, scores, marques, avecMarques) {
  const actif = enJeu.indexOf(id) !== -1;
  const d = document.createElement("div");
  d.className = "joueur" + (id === uid ? " moi" : "") + (actif ? "" : " elimine");

  const n = document.createElement("span");
  n.textContent = nomJoueur(id) + (actif ? "" : " ✗");
  d.appendChild(n);

  if (avecMarques && marques && marques[id]) {
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
  return d;
}

// Haut de l'écran : jusqu'à 4 joueurs on voit tout ; au-delà, version compacte
function afficherClassement(scores, enJeu, tous, marques) {
  const zone = $("classement");
  const ordre = tous.slice().sort(function (a, b) {
    const ja = enJeu.indexOf(a) !== -1 ? 1 : 0;
    const jb = enJeu.indexOf(b) !== -1 ? 1 : 0;
    if (ja !== jb) return jb - ja;
    return (scores[b] || 0) - (scores[a] || 0);
  });

  // On ne redessine que si quelque chose a changé (les boutons restent cliquables)
  const signature = JSON.stringify([ordre, scores, marques, enJeu, classementOuvert, versionProfils]);
  if (signature === signatureClassement) return;
  signatureClassement = signature;
  zone.innerHTML = "";

  if (ordre.length <= SEUIL_COMPACT) {
    zone.style.maxHeight = "";
    zone.style.overflowY = "";
    ordre.forEach(function (id) {
      zone.appendChild(puce(id, enJeu, scores, marques, true));
    });
    return;
  }

  zone.style.maxHeight = "44vh";
  zone.style.overflowY = "auto";

  const actifMoi = enJeu.indexOf(uid) !== -1;
  const resume = document.createElement("div");
  resume.style.cssText = "width:100%;text-align:center;font-size:13px;font-weight:800;color:#aab4ff;";
  resume.textContent = actifMoi
    ? "Ton rang : " + (ordre.indexOf(uid) + 1) + " sur " + ordre.length
    : "Tu es éliminé (" + ordre.length + " joueurs)";
  zone.appendChild(resume);

  zone.appendChild(puce(uid, enJeu, scores, marques, true));

  const autres = ordre.filter(function (id) {
    return id !== uid;
  });
  const visibles = autres.slice(0, classementOuvert ? autres.length : 3);
  chargerProfils([uid].concat(visibles));
  visibles.forEach(function (id) {
    zone.appendChild(puce(id, enJeu, scores, marques, false));
  });

  const bouton = document.createElement("button");
  bouton.textContent = classementOuvert ? "Réduire ▴" : "Voir tous (" + ordre.length + ") ▾";
  bouton.style.cssText =
    "width:100%;padding:8px;border:0;background:none;color:#aab4ff;font-weight:800;font-size:13px;cursor:pointer;";
  bouton.addEventListener("click", function () {
    classementOuvert = !classementOuvert;
  });
  zone.appendChild(bouton);
}

// c = numéro d'origine du choix (celui que le moteur compare à la bonne réponse)
function maReponse(n, i) {
  const cle = n + "-" + i;
  if (envoyees[cle] !== undefined) return envoyees[cle];
  const r = partie["m" + n] && partie["m" + n]["q" + i] && partie["m" + n]["q" + i][uid];
  return r ? r.c : null;
}

// Les boutons sont mélangés : on retrouve le choix d'origine grâce à data-orig
function majBoutons(q, c, bloque, revele) {
  document.querySelectorAll("#choix button").forEach(function (b) {
    const k = parseInt(b.dataset.orig, 10);
    b.disabled = bloque || c !== null;
    b.classList.toggle("choisi", c === k);
    b.classList.toggle("juste", revele && k === q.bonne);
    b.classList.toggle("faux", revele && c === k && k !== q.bonne);
  });
}

// Chaque joueur voit les réponses dans un ordre différent, fixe pour toute la question
function construireChoix(q, graine, auClic) {
  const zone = $("choix");
  zone.innerHTML = "";
  ordreReproductible(q.choix.length, graine).forEach(function (origine) {
    const b = document.createElement("button");
    b.innerHTML = htmlMath(q.choix[origine]);
    b.dataset.orig = String(origine);
    b.addEventListener("click", function () {
      auClic(origine);
    });
    zone.appendChild(b);
  });
}

async function envoyer(n, i, k, q) {
  const cle = n + "-" + i;
  if (envoyees[cle] !== undefined || maReponse(n, i) !== null) return;
  envoyees[cle] = k;
  Sons.clic();
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
  cibleSignal = { rid: q.rid, index: q.index };
  const cle = m.n + "-" + i;
  if (rendu !== cle) {
    rendu = cle;
    const mi = infoMatiere(q.matiere);
    $("numero").textContent = "Question " + (i + 1) + " / " + m.round.questions.length + " · " + mi.emoji + " " + mi.nom;
    $("question").innerHTML = htmlMath(q.q);
    construireChoix(q, salonId + "|" + uid + "|" + cle, function (origine) {
      envoyer(m.n, i, origine, q);
    });
  }
}

function phaseQuestion(m, i, q, p, now) {
  montrerQuestion(m, i, q);
  signal.afficher(false);
  const reste = Math.ceil((p.fin - now) / 1000);
  $("chrono").textContent = "⏱ " + reste + " s";
  // Petit tic-tac pendant les 5 dernières secondes
  const cleTic = m.n + "-" + i + "-" + reste;
  if (reste <= 5 && reste > 0 && dernierTic !== cleTic) {
    dernierTic = cleTic;
    Sons.tic();
  }
  const c = maReponse(m.n, i);
  majBoutons(q, c, false, false);
  $("info").textContent = c !== null ? "Réponse envoyée ✓" : "";
}

function phaseCalcul(m, i, q) {
  montrerQuestion(m, i, q);
  signal.afficher(false);
  $("chrono").textContent = "⏱ 0 s";
  majBoutons(q, maReponse(m.n, i), true, false);
  $("info").textContent = "Calcul du résultat…";
}

function phaseResultat(m, i, q, now) {
  montrerQuestion(m, i, q);
  signal.afficher(true);
  const plan = m.plan;
  const suivante = i < plan.questions.length - 1 ? plan.questions[i + 1].debut : plan.fin;
  const c = maReponse(m.n, i);

  const cleSon = m.n + "-" + i;
  if (!sonsJoues[cleSon]) {
    sonsJoues[cleSon] = true;
    if (c === q.bonne) Sons.bon();
    else Sons.faux();
  }

  majBoutons(q, c, true, true);
  $("chrono").textContent = "Suite dans " + Math.max(0, Math.ceil((suivante - now) / 1000)) + " s";
  if (c === null) $("info").textContent = "Pas de réponse";
  else if (c === q.bonne) $("info").textContent = "✅ Bonne réponse";
  else $("info").textContent = "❌ Mauvaise réponse";
}

function avantManche(t, m, tous, now) {
  const reste = Math.ceil((m.debut - now) / 1000);
  if (reste <= 3 && reste > 0 && dernierTic !== "m" + m.n + "-" + reste) {
    dernierTic = "m" + m.n + "-" + reste;
    Sons.tic();
  }
  if (t.manches.length === 1) {
    $("titre-manche").textContent = "5 questions par manche";
    viderClassement();
    etat("La partie commence dans " + reste + " s");
    return;
  }
  const prev = t.manches[t.manches.length - 2];
  $("titre-manche").textContent = "Égalité en tête !";
  afficherClassement(prev.scores, m.joueurs, tous, prev.marques);
  const dedans = m.joueurs.indexOf(uid) !== -1;
  etat((dedans ? "Tu continues" : "Tu es éliminé") + " · manche " + m.n + " dans " + reste + " s");
}

// Encaisse le gain ; une victoire en solo (pas d'égalité) est comptée pour le titre « Champion »
async function reclamer(gain, compteVictoire) {
  if (reclameEnCours) return;
  reclameEnCours = true;
  try {
    const snap = await get(ref(db, "joueurs/" + uid));
    const v = snap.exists() ? snap.val() : {};
    const maj = {};
    maj["joueurs/" + uid + "/pieces"] = (v.pieces || 0) + gain;
    if (compteVictoire) maj["joueurs/" + uid + "/victoires"] = (v.victoires || 0) + 1;
    maj["parties/" + salonId + "/reclame/" + uid] = true;
    await update(ref(db), maj);
    bilan = "✓ " + gain + " 🪙 ajoutées à ton solde";
    Sons.piece();
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
  await ouvrirCycle(salon.fid, fin);
}

function finTournoi(t, m, tous) {
  chargerProfils(t.gagnants);
  afficherClassement(m.scores, m.joueurs, tous, m.marques);
  signal.afficher(false);
  $("titre-manche").textContent = "Partie terminée";
  $("statut").hidden = true;
  $("zone-question").hidden = true;
  $("zone-fin").hidden = false;

  const g = t.gagnants;
  const jeGagne = g.indexOf(uid) !== -1;
  const gain = Math.floor(pot() / g.length);

  if (!finSonJoue) {
    finSonJoue = true;
    if (jeGagne) {
      Sons.victoire();
    } else {
      Sons.defaite();
      setTimeout(Sons.perte, 900);
    }
  }

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
    reclamer(gain, !t.partage);
    if (bilan) detail += "\n" + bilan;
  } else {
    detail += "\nTu perds ton droit d’entrée de " + miseDe(uid) + " 🪙";
  }
  $("fin-detail").textContent = detail;

  terminerCycle(m.plan.fin);
}

// ===== Mode élimination (5 joueurs ou plus) =====

function maReponseE(k) {
  const cle = "e" + k;
  if (envoyees[cle] !== undefined) return envoyees[cle];
  const r = partie.tours && partie.tours["t" + k] && partie.tours["t" + k][uid];
  return r ? r.c : null;
}

async function envoyerE(k, origine, q) {
  const cle = "e" + k;
  if (envoyees[cle] !== undefined || maReponseE(k) !== null) return;
  envoyees[cle] = origine;
  Sons.clic();
  majBoutons(q, origine, false, false);
  try {
    await set(ref(db, "parties/" + salonId + "/tours/t" + k + "/" + uid), {
      c: origine,
      t: maintenant()
    });
  } catch (e) {
    erreur(e);
  }
}

function montrerQuestionE(d) {
  $("statut").hidden = true;
  $("zone-fin").hidden = true;
  $("zone-question").hidden = false;
  cibleSignal = { rid: d.item.rid, index: d.item.qi };
  const cle = "e" + d.k;
  if (rendu !== cle) {
    rendu = cle;
    const q = d.item.q;
    const mi = infoMatiere(q.matiere);
    $("numero").textContent = "Question " + (d.k + 1) + " · " + mi.emoji + " " + mi.nom;
    $("question").innerHTML = htmlMath(q.q);
    construireChoix(q, salonId + "|" + uid + "|" + cle, function (origine) {
      envoyerE(d.k, origine, q);
    });
  }
}

function chipSimple(texte, classe) {
  const c = document.createElement("div");
  c.className = "joueur" + (classe ? " " + classe : "");
  const s = document.createElement("span");
  s.textContent = texte;
  c.appendChild(s);
  return c;
}

// Haut de l'écran en mode élimination : combien restent en jeu, et ma situation
function afficherEtatElimination(enJeu, total, moiEnJeu) {
  const signature = "e|" + enJeu + "|" + total + "|" + moiEnJeu;
  if (signature === signatureClassement) return;
  signatureClassement = signature;
  const zone = $("classement");
  zone.innerHTML = "";
  zone.style.maxHeight = "";
  zone.style.overflowY = "";
  zone.appendChild(chipSimple("👥 En jeu : " + enJeu + " / " + total, ""));
  zone.appendChild(chipSimple(moiEnJeu ? "🟢 Tu es en jeu" : "✗ Tu es éliminé", moiEnJeu ? "moi" : "elimine"));
}

function afficherGagnants(g) {
  const signature = "g|" + g.join(",") + "|" + versionProfils;
  if (signature === signatureClassement) return;
  signatureClassement = signature;
  const zone = $("classement");
  zone.innerHTML = "";
  zone.style.maxHeight = "";
  zone.style.overflowY = "";
  g.slice(0, 6).forEach(function (id) {
    zone.appendChild(chipSimple("🏆 " + nomJoueur(id), id === uid ? "moi" : ""));
  });
  if (g.length > 6) zone.appendChild(chipSimple("… et " + (g.length - 6) + " autres", ""));
}

function phaseQuestionE(d, p, now) {
  montrerQuestionE(d);
  signal.afficher(false);
  const q = d.item.q;
  const reste = Math.ceil((p.fin - now) / 1000);
  $("chrono").textContent = "⏱ " + reste + " s";
  const cleTic = "e" + d.k + "-" + reste;
  if (reste <= 5 && reste > 0 && dernierTic !== cleTic) {
    dernierTic = cleTic;
    Sons.tic();
  }
  const c = maReponseE(d.k);
  majBoutons(q, c, false, false);
  $("info").textContent = c !== null ? "Réponse envoyée ✓\nSi tu te trompes, tu es éliminé" : "Trouve la bonne réponse pour continuer";
}

function phaseCalculE(d) {
  montrerQuestionE(d);
  signal.afficher(false);
  $("chrono").textContent = "⏱ 0 s";
  majBoutons(d.item.q, maReponseE(d.k), true, false);
  $("info").textContent = "Calcul du résultat…";
}

function phaseResultatE(d, now, restants) {
  montrerQuestionE(d);
  signal.afficher(true);
  const q = d.item.q;
  const c = maReponseE(d.k);
  const bon = d.bons.indexOf(uid) !== -1;
  const elimine = d.elimines.indexOf(uid) !== -1;

  const cleSon = "e" + d.k;
  if (!sonsJoues[cleSon]) {
    sonsJoues[cleSon] = true;
    if (bon) Sons.bon();
    else Sons.faux();
  }

  majBoutons(q, c, true, true);
  $("chrono").textContent = "Suite dans " + Math.max(0, Math.ceil((d.plan.suivant - now) / 1000)) + " s";

  let texte;
  if (elimine) texte = "❌ Éliminé";
  else if (d.bons.length === 0) texte = "⚪ Personne n’a trouvé : aucun éliminé";
  else if (d.elimines.length === 0) texte = "✅ Bonne réponse : personne n’est éliminé";
  else texte = "✅ Tu continues";
  texte += "\nÉliminés : " + d.elimines.length + " · En jeu : " + restants;
  $("info").textContent = texte;
}

function finElimination(t, d, tous) {
  const g = t.gagnants;
  chargerProfils(g);
  afficherGagnants(g);
  signal.afficher(false);
  $("titre-manche").textContent = "Partie terminée";
  $("statut").hidden = true;
  $("zone-question").hidden = true;
  $("zone-fin").hidden = false;

  const jeGagne = g.indexOf(uid) !== -1;
  const gain = Math.floor(pot() / g.length);

  if (!finSonJoue) {
    finSonJoue = true;
    if (jeGagne) {
      Sons.victoire();
    } else {
      Sons.defaite();
      setTimeout(Sons.perte, 900);
    }
  }

  let titre;
  if (!t.partage) {
    titre = jeGagne ? "🏆 Dernier en jeu : tu remportes la cagnotte !" : "Défaite : " + nomJoueur(g[0]) + " gagne";
  } else {
    titre = jeGagne
      ? "🤝 Plusieurs survivants : cagnotte partagée"
      : "Cagnotte partagée entre " + g.length + " survivants";
  }
  $("fin-titre").textContent = titre;

  let detail = "Cagnotte : " + pot() + " 🪙 · " + tous.length + " joueurs";
  if (jeGagne) {
    detail += "\nTu reçois " + gain + " 🪙";
    reclamer(gain, !t.partage);
    if (bilan) detail += "\n" + bilan;
  } else {
    detail += "\nTu perds ton droit d’entrée de " + miseDe(uid) + " 🪙";
  }
  $("fin-detail").textContent = detail;

  terminerCycle(d.plan.suivant);
}

function afficherElimination(tous, now) {
  const t = calculerElimination(tous, salon.lanceLe - DECALAGE_DEPART_MS, 0, mancheDeSalle(), partie.tours || {}, now);
  const d = t.tours[t.tours.length - 1];

  if (t.termine) {
    $("retour").hidden = false;
    finElimination(t, d, tous);
    return;
  }
  $("retour").hidden = true;

  if (now < d.plan.debut) {
    const reste = Math.ceil((d.plan.debut - now) / 1000);
    if (reste <= 3 && reste > 0 && dernierTic !== "e0-" + reste) {
      dernierTic = "e0-" + reste;
      Sons.tic();
    }
    $("titre-manche").textContent = "⚔️ Élimination · " + tous.length + " joueurs";
    viderClassement();
    etat("Une question à la fois : ceux qui se trompent sont éliminés.\nDébut dans " + reste + " s");
    return;
  }

  if (!departsJoues["e" + d.k]) {
    departsJoues["e" + d.k] = true;
    noterJouees("e" + d.k, [d.item.q]);
    Sons.depart();
  }

  const restants = d.decide ? d.vivants.length - d.elimines.length : d.vivants.length;
  const moiVivant = d.vivants.indexOf(uid) !== -1;
  const moiApres = moiVivant && d.elimines.indexOf(uid) === -1;

  $("titre-manche").textContent = "Question " + (d.k + 1);
  afficherEtatElimination(restants, tous.length, d.decide ? moiApres : moiVivant);

  if (!moiVivant) {
    etat("Tu es éliminé ❌\n" + restants + " joueur" + (restants > 1 ? "s" : "") + " encore en jeu");
    return;
  }

  const p = d.plan;
  if (now < p.fin) phaseQuestionE(d, p, now);
  else if (now < p.revele) phaseCalculE(d);
  else phaseResultatE(d, now, restants);
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
  $("cagnotte").textContent = pot();
  chargerProfils(tous.length <= 8 ? tous : [uid]);

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
    $("titre-manche").textContent = "Salle " + salon.mise + " 🪙";
    viderClassement();
    const n = tous.length;

    if (!entreeSonJoue) {
      entreeSonJoue = true;
      Sons.perte();
    }

    if (now < salon.ferme) {
      const reste = Math.ceil((salon.ferme - now) / 1000);
      if (reste <= 3 && dernierTic !== "w" + reste) {
        dernierTic = "w" + reste;
        Sons.tic();
      }
      $("btn-quitter").hidden = false;
      $("liste-attente").hidden = false;
      $("liste-attente").textContent =
        n > 6 ? n + " joueurs inscrits" : tous.map(nomJoueur).join("  ·  ");
      let mode = "";
      if (n >= SEUIL_ELIMINATION) mode = "\n⚔️ Mode élimination (une question par tour)";
      etat(
        (n >= salon.max ? "Salle complète" : "Inscriptions ouvertes") +
          " · " + n + " / " + salon.max + mode + "\nDépart dans " + reste + " s"
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

  if (!mancheDeSalle()) {
    $("retour").hidden = false;
    etat("Les questions de cette salle sont introuvables.\nMets à jour l’application puis reviens aux salles.");
    return;
  }

  // 5 joueurs ou plus : mode élimination
  if (tous.length >= SEUIL_ELIMINATION) {
    afficherElimination(tous, now);
    return;
  }

  const t = calculerTournoi(tous, salon.lanceLe - DECALAGE_DEPART_MS, 0, mancheDeSalle(), partie, now);
  const m = t.manches[t.manches.length - 1];

  if (t.termine) {
    $("retour").hidden = false;
    finTournoi(t, m, tous);
    return;
  }
  $("retour").hidden = true;

  if (now < m.debut) {
    signal.afficher(false);
    avantManche(t, m, tous, now);
    return;
  }

  if (!departsJoues[m.n]) {
    departsJoues[m.n] = true;
    noterJouees("m" + m.n, m.round.questions);
    Sons.depart();
  }

  const plan = m.plan;
  const nq = plan.questions.length;
  let i = 0;
  while (i < nq - 1 && now >= plan.questions[i + 1].debut) i++;
  const p = plan.questions[i];
  const q = m.round.questions[i];

  $("titre-manche").textContent = "Manche " + m.n;
  afficherClassement(m.scores, m.joueurs, tous, m.marques);

  if (m.joueurs.indexOf(uid) === -1) {
    signal.afficher(false);
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

    // Le bouton « Signaler » n'apparaît qu'une fois le résultat de la question connu
    signal = installerSignalement(
      $("zone-question"),
      function () {
        return cibleSignal;
      },
      function () {
        return uid;
      }
    );

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
