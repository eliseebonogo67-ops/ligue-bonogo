import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  ref,
  set,
  get,
  update,
  onValue
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { ROUNDS } from "./rounds.js";
import { calculer, planning } from "./duelmoteur.js";
import { initHorloge, maintenant } from "./horloge.js";
import { Sons } from "./sons.js";

const params = new URLSearchParams(window.location.search);
const matchId = params.get("m");
const slot = params.get("slot") === "2" ? 2 : 1;
const round = ROUNDS.find(function (r) {
  return r.id === params.get("r");
}) || ROUNDS[0];
const adv = slot === 1 ? 2 : 1;

// Code de défi : round (1 chiffre), mise (0, 1 ou 2) puis 4 lettres
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
let paye = false;
let payeEnCours = false;
let regleEnCours = false;
let resumeMise = "";
let dernierTic = "";
let sonsJoues = {};
let departJoue = false;
let finSonJoue = false;

const $ = function (id) {
  return document.getElementById(id);
};

function erreur(e) {
  $("erreur").textContent = typeof e === "string" ? e : (e.code || "") + " " + e.message;
}

function uidAdv() {
  return slot === 1 ? data.j2 : data.j1;
}

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

function construireQuestion(i, q) {
  $("numero").textContent = "Question " + (i + 1) + " / " + round.questions.length;
  $("question").textContent = q.q;
  const zone = $("choix");
  zone.innerHTML = "";
  q.choix.forEach(function (texte, k) {
    const b = document.createElement("button");
    b.textContent = texte;
    b.addEventListener("click", function () {
      envoyer(i, k);
    });
    zone.appendChild(b);
  });
}

function majBoutons(q, c, bloque, revele) {
  document.querySelectorAll("#choix button").forEach(function (b, k) {
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
  const reste = Math.ceil((p.fin - now) / 1000);
  $("chrono").textContent = "⏱ " + reste + " s";
  const cleTic = i + "-" + reste;
  if (reste <= 5 && reste > 0 && dernierTic !== cleTic) {
    dernierTic = cleTic;
    Sons.tic();
  }
  const c = maReponse(i);
  majBoutons(q, c, false, false);
  $("info").textContent = c !== null ? "Réponse envoyée ✓\nRésultat à la fin du chrono" : "";
}

function phaseAttente(i, q) {
  montrerQuestion(i, q);
  $("chrono").textContent = "⏱ 0 s";
  majBoutons(q, maReponse(i), true, false);
  $("info").textContent = "Calcul du résultat…";
}

function phaseResultat(i, q, p, calc, now) {
  montrerQuestion(i, q);
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
  $("info").textContent = verdict + "\nAdversaire : " + txtAdv;
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

  let detail = "Score : " + vMoi + " – " + vAdv;
  if (mise > 0) detail += "\n" + (resumeMise || "Calcul de la mise…");
  else detail += "\nMatch amical sans mise";
  $("fin-detail").textContent = detail;
}

function afficher() {
  if (!uid) return;
  const now = maintenant();
  $("mise-info").textContent = mise > 0 ? "Mise " + mise + " 🪙" : "Sans mise";

  if (!data.j1 || !data.j2) {
    etat("En attente de l’adversaire…");
    return;
  }

  payerMise();

  if (!data.lanceLe) {
    etat("Adversaire trouvé, lancement…");
    return;
  }

  const plan = planning(data.lanceLe, round);
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

  if (now < p.fin) {
    phaseQuestion(i, q, p, now);
  } else if (now < p.revele) {
    phaseAttente(i, q);
  } else {
    phaseResultat(i, q, p, calc, now);
  }
}

function lancerSiPret() {
  if (slot === 1 && !lanceEnvoye && data.j1 === uid && data.j2 && !data.lanceLe) {
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
    await set(ref(db, "duels/" + matchId + "/j" + slot), uid);
    setInterval(afficher, 250);
  } catch (e) {
    erreur(e);
  }
}

demarrer();
