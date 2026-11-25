import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  ref,
  set,
  get,
  update,
  onValue
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { initHorloge, maintenant } from "./horloge.js";
import { Sons } from "./sons.js";
import { article, DEFAUTS } from "./profil.js";
import { ordreReproductible } from "./outils.js";
import { installerSignalement } from "./signalement.js";
import { htmlMath } from "./formules.js";
import { infoMatiere } from "./matieres.js";
import { tirerDuel, questionParId, noterVus } from "./tirage.js";

// ===== Moteur du duel (réglages modifiables pour les tests) =====
const DUREE_CULTURE_S = 30;
const DUREE_CALCUL_S = 45;
const PAUSE_DEBUT_MS = 6000;
const TOLERANCE_MS = 1500;
const REVEAL_MS = 4000;
const AVANCE_MS = 700; // petite pause avant le résultat quand les deux joueurs ont répondu
const ECART_EGALITE_MS = 0;
const DEUX_FAUX = "annulee"; // "annulee" ou "premier"

// Maths et Physique-Chimie demandent plus de temps (calculs)
function dureeQuestionMs(q) {
  const calcul = q.matiere === "maths" || q.matiere === "pc";
  return (calcul ? DUREE_CALCUL_S : DUREE_CULTURE_S) * 1000;
}

function reponseValide(rep, p) {
  if (!rep) return null;
  if (rep.t < p.debut - TOLERANCE_MS) return null;
  if (rep.t > p.fin + TOLERANCE_MS) return null;
  return rep;
}

// Le planning dépend des réponses : si les deux joueurs ont répondu avant la fin du chrono,
// le résultat arrive tout de suite et la question suivante démarre plus tôt.
function planning(donnees, rnd) {
  let debut = donnees.lanceLe + PAUSE_DEBUT_MS;
  return rnd.questions.map(function (q, i) {
    const fin = debut + dureeQuestionMs(q);
    const rq = (donnees.reponses && donnees.reponses["q" + i]) || {};
    const r1 = reponseValide(rq[donnees.j1], { debut: debut, fin: fin });
    const r2 = reponseValide(rq[donnees.j2], { debut: debut, fin: fin });
    let revele = fin + TOLERANCE_MS;
    if (r1 && r2) {
      revele = Math.min(revele, Math.max(debut + 500, Math.max(r1.t, r2.t) + AVANCE_MS));
    }
    const p = {
      debut: debut,
      fin: fin,
      revele: revele,
      suivante: revele + REVEAL_MS
    };
    debut = p.suivante;
    return p;
  });
}

// gagnant : 1, 2, ou null (question annulée)
function resultatQuestion(q, rep1, rep2, p) {
  const r1 = reponseValide(rep1, p);
  const r2 = reponseValide(rep2, p);
  const ok1 = !!r1 && r1.c === q.bonne;
  const ok2 = !!r2 && r2.c === q.bonne;
  let gagnant = null;

  if (ok1 && ok2) {
    if (Math.abs(r1.t - r2.t) <= ECART_EGALITE_MS) {
      gagnant = null;
    } else {
      gagnant = r1.t < r2.t ? 1 : 2;
    }
  } else if (ok1) {
    gagnant = 1;
  } else if (ok2) {
    gagnant = 2;
  } else if (DEUX_FAUX === "premier" && r1 && r2) {
    gagnant = r1.t <= r2.t ? 1 : 2;
  }

  return {
    gagnant: gagnant,
    c1: r1 ? r1.c : null,
    c2: r2 ? r2.c : null,
    ok1: ok1,
    ok2: ok2
  };
}

function calculer(rnd, donnees, now) {
  const plan = planning(donnees, rnd);
  const resultats = [];
  let v1 = 0;
  let v2 = 0;

  rnd.questions.forEach(function (q, i) {
    const p = plan[i];
    if (now < p.revele) {
      resultats.push(null);
      return;
    }
    const rq = (donnees.reponses && donnees.reponses["q" + i]) || {};
    const res = resultatQuestion(q, rq[donnees.j1], rq[donnees.j2], p);
    resultats.push(res);
    if (res.gagnant === 1) v1++;
    if (res.gagnant === 2) v2++;
  });

  return { plan: plan, resultats: resultats, v1: v1, v2: v2 };
}

// ===== Code de revanche =====
const LETTRES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Même mise, quatre lettres au hasard : les questions sont tirées par celui qui lance le duel
function nouveauCodeRevanche(ancien) {
  let c = "0" + ancien.charAt(1);
  for (let i = 0; i < 4; i++) {
    c += LETTRES.charAt(Math.floor(Math.random() * LETTRES.length));
  }
  return c;
}

// ===== Écran du duel =====
const params = new URLSearchParams(window.location.search);
const matchId = params.get("m");
const slot = params.get("slot") === "2" ? 2 : 1;
// Les 5 questions du duel sont tirées par celui qui le lance et enregistrées dans la base :
// les deux joueurs voient exactement les mêmes.
let round = null;
const niveauDemande = params.get("n") || "";
const matiereDemandee = params.get("mat") || "";
const adv = slot === 1 ? 2 : 1;

// Code de défi : "0", mise (0, 1 ou 2), puis 4 lettres au hasard
function miseDuCode(code) {
  if (!/^[0-9][0-2][A-Z2-9]{4}$/.test(code || "")) return 0;
  return [0, 5, 10][parseInt(code.charAt(1), 10)];
}
const mise = miseDuCode(matchId);

let uid = null;
let data = {};
let lanceEnvoye = false;
let envoyees = {};
let rendu = "";
let questionAffichee = 0;
let paye = false;
let payeEnCours = false;
let regleEnCours = false;
let resumeMise = "";
let dernierTic = "";
let sonsJoues = {};
let departJoue = false;
let finSonJoue = false;
let nomsCharges = false;
let nomAdvTexte = "Adversaire";
let nomAdvAffiche = "Adversaire";
let resultatEnregistre = false;
let faceTexte = "";
let revancheEnCours = false;
let revancheSonJouee = false;
let signal = null;
let questionsPreparees = false;

const $ = function (id) {
  return document.getElementById(id);
};

function erreur(e) {
  $("erreur").textContent = typeof e === "string" ? e : (e.code || "") + " " + e.message;
}

function uidAdv() {
  return slot === 1 ? data.j2 : data.j1;
}

function emojiAnimal(p) {
  const a = article(p && p.animal ? p.animal : DEFAUTS.animal) || article(DEFAUTS.animal);
  return a.emoji;
}

// Cinq questions exactement, du niveau et de la matière choisis : tirées par celui qui lance le duel
async function preparerQuestions() {
  if (slot !== 1 || questionsPreparees) return;
  questionsPreparees = true;
  try {
    const deja = await get(ref(db, "duels/" + matchId + "/qs"));
    if (deja.exists()) return;
    if (niveauDemande !== "bepc" && niveauDemande !== "bac") {
      erreur("Lance le duel depuis « Défier un ami » pour choisir le niveau et la matière.");
      return;
    }
    const matiere = matiereDemandee === "tous" ? "" : matiereDemandee;
    const liste = tirerDuel(niveauDemande, matiere);
    if (!liste) {
      erreur("Pas assez de questions pour ce choix : il en faut au moins 5.");
      return;
    }
    const maj = {};
    maj["duels/" + matchId + "/niveau"] = niveauDemande;
    maj["duels/" + matchId + "/matiere"] = matiereDemandee || "tous";
    maj["duels/" + matchId + "/qs"] = liste.map(function (q) {
      return q.id;
    });
    await update(ref(db), maj);
  } catch (e) {
    questionsPreparees = false;
    erreur(e);
  }
}

// Reconstitue les 5 questions à partir de leurs identifiants
function construireRound() {
  if (round || !data.qs) return;
  const ids = Array.isArray(data.qs)
    ? data.qs
    : Object.keys(data.qs)
        .sort(function (a, b) {
          return Number(a) - Number(b);
        })
        .map(function (k) {
          return data.qs[k];
        });
  const questions = ids.map(function (id) {
    return questionParId(id);
  });
  if (
    questions.length !== 5 ||
    questions.some(function (q) {
      return !q;
    })
  ) {
    erreur("Une question est introuvable : ferme l’application, rouvre-la puis réessaie.");
    return;
  }
  round = { id: "duel", titre: "Duel", questions: questions };
}

// Le pseudo et l'animal des deux joueurs, chargés une seule fois
async function chargerNoms() {
  if (nomsCharges || !data.j1 || !data.j2) return;
  nomsCharges = true;
  try {
    const snaps = await Promise.all([
      get(ref(db, "profils/" + uid)),
      get(ref(db, "profils/" + uidAdv()))
    ]);
    const pm = snaps[0].exists() ? snaps[0].val() : {};
    const pa = snaps[1].exists() ? snaps[1].val() : {};
    nomAdvTexte = pa.pseudo || "Adversaire";
    nomAdvAffiche = emojiAnimal(pa) + " " + nomAdvTexte;
    $("nom-moi").textContent = emojiAnimal(pm) + " Toi";
    $("nom-adv").textContent = nomAdvAffiche;
  } catch (e) {
    // les noms restent « Toi » et « Adversaire »
  }
}

// c = numéro d'origine du choix (celui que le moteur compare à la bonne réponse)
function maReponse(i) {
  if (envoyees[i] !== undefined) return envoyees[i];
  const r = data.reponses && data.reponses["q" + i] && data.reponses["q" + i][uid];
  return r ? r.c : null;
}

function etat(texte) {
  $("statut").textContent = texte;
  $("statut").hidden = false;
  $("zone-question").hidden = true;
  $("zone-fin").hidden = true;
  $("chrono").textContent = "";
  rendu = "";
}

// Cases vert/rouge des deux joueurs, toujours visibles en haut
function marques(calc) {
  let moiTxt = "";
  let advTxt = "";
  calc.resultats.forEach(function (r) {
    if (r === null) {
      moiTxt += "▫️";
      advTxt += "▫️";
    } else if (r.gagnant === null) {
      moiTxt += "➖";
      advTxt += "➖";
    } else if (r.gagnant === slot) {
      moiTxt += "🟩";
      advTxt += "🟥";
    } else {
      moiTxt += "🟥";
      advTxt += "🟩";
    }
  });
  return { moi: moiTxt, adv: advTxt };
}

function majScore(calc) {
  const vMoi = slot === 1 ? calc.v1 : calc.v2;
  const vAdv = slot === 1 ? calc.v2 : calc.v1;
  const mk = marques(calc);
  $("pts-moi").textContent = vMoi;
  $("pts-adv").textContent = vAdv;
  $("marques-moi").textContent = mk.moi;
  $("marques-adv").textContent = mk.adv;
}

// Chaque joueur voit les réponses dans un ordre différent (fixe pour toute la question)
function construireQuestion(i, q) {
  questionAffichee = i;
  const mi = infoMatiere(q.matiere);
  $("numero").textContent = "Question " + (i + 1) + " / " + round.questions.length + " · " + mi.emoji + " " + mi.nom;
  $("question").innerHTML = htmlMath(q.q);
  const zone = $("choix");
  zone.innerHTML = "";
  const ordre = ordreReproductible(q.choix.length, matchId + "|" + uid + "|" + i);
  ordre.forEach(function (origine) {
    const b = document.createElement("button");
    b.innerHTML = htmlMath(q.choix[origine]);
    b.dataset.orig = String(origine);
    b.addEventListener("click", function () {
      envoyer(i, origine);
    });
    zone.appendChild(b);
  });
}

function majBoutons(q, c, bloque, revele) {
  document.querySelectorAll("#choix button").forEach(function (b) {
    const k = parseInt(b.dataset.orig, 10);
    b.disabled = bloque || c !== null;
    b.classList.toggle("choisi", c === k);
    b.classList.toggle("juste", revele && k === q.bonne);
    b.classList.toggle("faux", revele && c === k && k !== q.bonne);
  });
}

async function envoyer(i, k) {
  if (envoyees[i] !== undefined || maReponse(i) !== null) return;
  envoyees[i] = k;
  Sons.clic();
  majBoutons(round.questions[i], k, false, false);
  try {
    // L'heure du clic est un nombre fixe : les deux écrans lisent la même valeur
    await set(ref(db, "duels/" + matchId + "/reponses/q" + i + "/" + uid), {
      c: k,
      t: maintenant()
    });
  } catch (e) {
    erreur(e);
  }
}

function montrerQuestion(i, q) {
  $("statut").hidden = true;
  $("zone-fin").hidden = true;
  $("zone-question").hidden = false;
  if (rendu !== "q" + i) {
    rendu = "q" + i;
    construireQuestion(i, q);
  }
}

// Pendant la question, l'écran ne réagit pas à ce que fait l'adversaire
function phaseQuestion(i, q, p, now) {
  montrerQuestion(i, q);
  signal.afficher(false);
  const reste = Math.ceil((p.fin - now) / 1000);
  $("chrono").textContent = "⏱ " + Math.max(0, reste) + " s";
  const cleTic = i + "-" + reste;
  if (reste <= 5 && reste > 0 && dernierTic !== cleTic) {
    dernierTic = cleTic;
    Sons.tic();
  }
  const c = maReponse(i);
  majBoutons(q, c, false, false);
  $("info").textContent =
    c !== null ? "Réponse envoyée ✓\nLe résultat arrive dès que ton adversaire a répondu" : "";
}

function phaseAttente(i, q) {
  montrerQuestion(i, q);
  signal.afficher(false);
  $("chrono").textContent = "⏱ 0 s";
  majBoutons(q, maReponse(i), true, false);
  $("info").textContent = "Calcul du résultat…";
}

function phaseResultat(i, q, p, calc, now) {
  montrerQuestion(i, q);
  signal.afficher(true);
  const res = calc.resultats[i];
  const c = maReponse(i);
  majBoutons(q, c, true, true);
  $("chrono").textContent = "Suite dans " + Math.max(0, Math.ceil((p.suivante - now) / 1000)) + " s";

  let verdict = "⚪ Question annulée";
  if (res && res.gagnant === slot) verdict = "🟩 Vert pour toi !";
  else if (res && res.gagnant === adv) verdict = "🟥 Rouge pour toi";

  if (!sonsJoues[i]) {
    sonsJoues[i] = true;
    if (res && res.gagnant === slot) Sons.bon();
    else if (res && res.gagnant === adv) Sons.faux();
  }

  const cAdv = res ? (slot === 1 ? res.c2 : res.c1) : null;
  const txtAdv = cAdv !== null ? q.choix[cAdv] : "pas de réponse valide";
  const info = $("info");
  info.textContent = "";
  info.appendChild(document.createTextNode(verdict));
  info.appendChild(document.createElement("br"));
  const ligne = document.createElement("span");
  ligne.innerHTML = "Adversaire : " + htmlMath(txtAdv);
  info.appendChild(ligne);
}

// Les deux joueurs sont là : chacun paie sa mise (une seule fois)
async function payerMise() {
  if (mise <= 0 || paye || payeEnCours) return;
  payeEnCours = true;
  try {
    const snap = await get(ref(db, "joueurs/" + uid + "/pieces"));
    const solde = snap.exists() ? snap.val() : 0;
    if (solde < mise) {
      erreur("Solde insuffisant pour payer la mise.");
      return;
    }
    const maj = {};
    maj["joueurs/" + uid + "/pieces"] = solde - mise;
    maj["duels/" + matchId + "/mises/" + uid] = mise;
    await update(ref(db), maj);
    paye = true;
    Sons.perte();
  } catch (e) {
    erreur(e);
  }
}

// Fin du duel : le gagnant récupère les deux mises, égalité = remboursement
async function regler(vMoi, vAdv) {
  if (mise <= 0 || regleEnCours) return;
  regleEnCours = true;

  if (!paye) {
    resumeMise = "Mise non payée : aucun gain.";
    return;
  }

  const advPaye = !!(data.mises && data.mises[uidAdv()] === mise);
  let gain = 0;
  if (vMoi > vAdv) gain = advPaye ? mise * 2 : mise;
  else if (vMoi === vAdv) gain = mise;

  try {
    if (gain > 0) {
      const snap = await get(ref(db, "joueurs/" + uid + "/pieces"));
      const solde = snap.exists() ? snap.val() : 0;
      const maj = {};
      maj["joueurs/" + uid + "/pieces"] = solde + gain;
      maj["duels/" + matchId + "/reclame/" + uid] = true;
      await update(ref(db), maj);
      Sons.piece();
    } else {
      setTimeout(Sons.perte, 900);
    }
    if (vMoi < vAdv) resumeMise = "Tu perds " + mise + " 🪙";
    else if (vMoi === vAdv) resumeMise = "Égalité : mise remboursée";
    else if (advPaye) resumeMise = "Tu gagnes " + mise + " 🪙 pris à ton adversaire";
    else resumeMise = "Mise remboursée (l’adversaire n’avait pas payé)";
  } catch (e) {
    erreur(e);
    resumeMise = "Règlement impossible : " + (e.code || e.message);
  }
}

function pluriel(n, mot) {
  return n + " " + mot + (n > 1 ? "s" : "");
}

// Le bilan est enregistré une seule fois par duel (victoires, défaites, nuls)
async function enregistrerResultat(vMoi, vAdv) {
  if (resultatEnregistre) return;
  resultatEnregistre = true;
  const autre = uidAdv();
  const cle = vMoi > vAdv ? "v" : vMoi < vAdv ? "d" : "n";
  let face = { v: 0, d: 0, n: 0 };

  try {
    const lectures = await Promise.all([
      get(ref(db, "joueurs/" + uid + "/face/" + autre)),
      get(ref(db, "profils/" + uid + "/duels"))
    ]);
    const f = lectures[0].exists() ? lectures[0].val() : {};
    const g = lectures[1].exists() ? lectures[1].val() : {};
    face = { v: f.v || 0, d: f.d || 0, n: f.n || 0 };
    const total = { v: g.v || 0, d: g.d || 0, n: g.n || 0 };

    const maj = {};
    maj["joueurs/" + uid + "/duelsVus/" + matchId] = true;
    face[cle] += 1;
    total[cle] += 1;
    maj["joueurs/" + uid + "/face/" + autre + "/v"] = face.v;
    maj["joueurs/" + uid + "/face/" + autre + "/d"] = face.d;
    maj["joueurs/" + uid + "/face/" + autre + "/n"] = face.n;
    maj["profils/" + uid + "/duels/v"] = total.v;
    maj["profils/" + uid + "/duels/d"] = total.d;
    maj["profils/" + uid + "/duels/n"] = total.n;
    await update(ref(db), maj);
  } catch (e) {
    // déjà enregistré (page rechargée) : on relit simplement le bilan
    try {
      const s = await get(ref(db, "joueurs/" + uid + "/face/" + autre));
      const f = s.exists() ? s.val() : {};
      face = { v: f.v || 0, d: f.d || 0, n: f.n || 0 };
    } catch (e2) {
      // sans importance
    }
  }

  let texte = "Face à " + nomAdvAffiche + " : " + pluriel(face.v, "victoire") + " – " + pluriel(face.d, "défaite");
  if (face.n > 0) texte += " – " + pluriel(face.n, "nul");

  try {
    const sa = await get(ref(db, "profils/" + autre + "/duels"));
    if (sa.exists()) {
      const a = sa.val();
      texte += "\n" + nomAdvTexte + " en tout : " + (a.v || 0) + " V · " + (a.d || 0) + " D";
    }
  } catch (e) {
    // sans importance
  }
  faceTexte = texte;
}

// ===== Revanche =====
function allerRevanche(r) {
  const nouveauSlot = r.par === uid ? 1 : 2;
  window.location.href =
    "duel.html?m=" + encodeURIComponent(r.code) +
    "&slot=" + nouveauSlot +
    (nouveauSlot === 1
      ? "&n=" + encodeURIComponent(data.niveau || niveauDemande) +
        "&mat=" + encodeURIComponent(data.matiere || matiereDemandee || "tous")
      : "");
}

async function revanche() {
  if (revancheEnCours) return;
  revancheEnCours = true;
  try {
    if (data.revanche && data.revanche.code) {
      allerRevanche(data.revanche);
      return;
    }
    const code = nouveauCodeRevanche(matchId);
    try {
      await set(ref(db, "duels/" + matchId + "/revanche"), { code: code, par: uid });
    } catch (e) {
      // l'adversaire a proposé au même moment : on prend sa proposition
    }
    const snap = await get(ref(db, "duels/" + matchId + "/revanche"));
    if (snap.exists()) {
      allerRevanche(snap.val());
      return;
    }
    revancheEnCours = false;
    erreur("Revanche impossible pour le moment.");
  } catch (e) {
    revancheEnCours = false;
    erreur(e);
  }
}

function majRevanche() {
  const b = $("btn-revanche");
  const r = data.revanche;
  if (r && r.code) {
    if (r.par === uid) {
      b.textContent = "▶️ Lancer la revanche";
      $("fin-revanche").textContent = "Revanche proposée : ton ami peut te rejoindre.";
    } else {
      b.textContent = "⚔️ Accepter la revanche";
      $("fin-revanche").textContent = nomAdvTexte + " te propose une revanche !";
      if (!revancheSonJouee) {
        revancheSonJouee = true;
        Sons.depart();
      }
    }
  } else {
    b.textContent = "⚔️ Revanche";
    $("fin-revanche").textContent = "";
  }
}

function finDuel(calc) {
  $("statut").hidden = true;
  $("zone-question").hidden = true;
  $("zone-fin").hidden = false;
  $("chrono").textContent = "";
  const vMoi = slot === 1 ? calc.v1 : calc.v2;
  const vAdv = slot === 1 ? calc.v2 : calc.v1;
  let titre = "🤝 Match nul";
  if (vMoi > vAdv) titre = "🏆 Victoire !";
  if (vMoi < vAdv) titre = "Défaite";
  $("fin-titre").textContent = titre;

  if (!finSonJoue) {
    finSonJoue = true;
    if (vMoi > vAdv) Sons.victoire();
    else if (vMoi < vAdv) Sons.defaite();
  }

  regler(vMoi, vAdv);
  enregistrerResultat(vMoi, vAdv);

  let detail = "Score : " + vMoi + " – " + vAdv;
  if (mise > 0) detail += "\n" + (resumeMise || "Calcul de la mise…");
  else detail += "\nMatch amical sans mise";
  $("fin-detail").textContent = detail;
  $("fin-face").textContent = faceTexte;
  majRevanche();
}

function afficher() {
  if (!uid) return;
  const now = maintenant();
  $("mise-info").textContent = mise > 0 ? "Mise " + mise + " 🪙" : "Sans mise";

  if (!data.j1 || !data.j2) {
    etat("En attente de l’adversaire…");
    return;
  }

  // Un troisième joueur ne peut pas entrer dans un duel
  if (uid !== data.j1 && uid !== data.j2) {
    etat("Ce duel est déjà complet.");
    return;
  }

  chargerNoms();
  payerMise();
  construireRound();

  if (!data.lanceLe) {
    etat(round ? "Adversaire trouvé, lancement…" : "Préparation des 5 questions…");
    return;
  }
  if (!round) {
    etat("Préparation des 5 questions…");
    return;
  }

  const plan = planning(data, round);
  const calc = calculer(round, data, now);
  majScore(calc);

  if (now < plan[0].debut) {
    const reste = Math.ceil((plan[0].debut - now) / 1000);
    if (reste <= 3 && dernierTic !== "d" + reste) {
      dernierTic = "d" + reste;
      Sons.tic();
    }
    etat("Début dans " + reste + " s");
    return;
  }

  if (!departJoue) {
    departJoue = true;
    // Ces 5 questions sont notées : elles ne reviendront pas tout de suite dans tes prochains duels
    noterVus(
      "duel",
      round.questions.map(function (q) {
        return q.id;
      })
    );
    Sons.depart();
  }

  const n = round.questions.length;
  if (now >= plan[n - 1].suivante) {
    finDuel(calc);
    return;
  }

  let i = 0;
  while (i < n - 1 && now >= plan[i].suivante) i++;
  const p = plan[i];
  const q = round.questions[i];

  // Le résultat peut arriver avant la fin du chrono si les deux ont répondu
  if (now >= p.revele) {
    phaseResultat(i, q, p, calc, now);
  } else if (now >= p.fin) {
    phaseAttente(i, q);
  } else {
    phaseQuestion(i, q, p, now);
  }
}

function lancerSiPret() {
  if (slot === 1 && !lanceEnvoye && data.j1 === uid && data.j2 && data.qs && !data.lanceLe) {
    lanceEnvoye = true;
    set(ref(db, "duels/" + matchId + "/lanceLe"), maintenant()).catch(erreur);
  }
}

async function demarrer() {
  if (!matchId) {
    erreur("Ouvre accueil.html pour lancer un duel.");
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
        const q = round && round.questions[questionAffichee];
        return q ? { rid: q.rid, index: q.index } : null;
      },
      function () {
        return uid;
      }
    );

    // Vérifier le solde avant de s'engager dans un match avec mise
    if (mise > 0) {
      const snap = await get(ref(db, "joueurs/" + uid + "/pieces"));
      const solde = snap.exists() ? snap.val() : 0;
      if (solde < mise) {
        etat("Solde insuffisant");
        erreur("Il te faut au moins " + mise + " pièces (tu en as " + solde + "). Entraîne-toi d’abord.");
        return;
      }
    }

    onValue(ref(db, "duels/" + matchId), function (s) {
      data = s.val() || {};
      lancerSiPret();
    });
    try {
      await set(ref(db, "duels/" + matchId + "/j" + slot), uid);
    } catch (e) {
      // déjà inscrit (page rechargée) ou place prise : l'écran l'indiquera
    }
    preparerQuestions();
    setInterval(afficher, 250);
  } catch (e) {
    erreur(e);
  }
}

$("btn-revanche").addEventListener("click", revanche);
demarrer();
