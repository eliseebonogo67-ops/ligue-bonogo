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
import { initHorloge, maintenant } from "./horloge.js";
import { Sons } from "./sons.js";
import { article, DEFAUTS } from "./profil.js";

// ===== Moteur du duel (réglages modifiables pour les tests) =====
const DUREE_CULTURE_S = 30;
const DUREE_CALCUL_S = 45;
const PAUSE_DEBUT_MS = 6000;
const TOLERANCE_MS = 1500;
const REVEAL_MS = 4000;
const ECART_EGALITE_MS = 0;
const DEUX_FAUX = "annulee"; // "annulee" ou "premier"

function dureeQuestionMs(rnd) {
  const s = rnd.id.indexOf("calcul") !== -1 ? DUREE_CALCUL_S : DUREE_CULTURE_S;
  return s * 1000;
}

function planning(lanceLe, rnd) {
  const duree = dureeQuestionMs(rnd);
  let debut = lanceLe + PAUSE_DEBUT_MS;
  return rnd.questions.map(function () {
    const p = {
      debut: debut,
      fin: debut + duree,
      revele: debut + duree + TOLERANCE_MS,
      suivante: debut + duree + TOLERANCE_MS + REVEAL_MS
    };
    debut = p.suivante;
    return p;
  });
}

function reponseValide(rep, p) {
  if (!rep) return null;
  if (rep.t < p.debut - TOLERANCE_MS) return null;
  if (rep.t > p.fin + TOLERANCE_MS) return null;
  return rep;
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
  const plan = planning(donnees.lanceLe, rnd);
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

// ===== Sujets déjà vus (pour varier les questions) =====
const CLE_VUS = "ligue_vus";
const LETTRES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function lireVus() {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_VUS) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function ajouterVu(id) {
  try {
    const v = lireVus().filter(function (x) {
      return x !== id;
    });
    v.push(id);
    localStorage.setItem(CLE_VUS, JSON.stringify(v.slice(-60)));
  } catch (e) {
    // sans importance
  }
}

// Nouveau code de revanche : même mise, autre sujet (un sujet pas encore vu si possible)
function nouveauCodeRevanche(ancien) {
  const vus = lireVus();
  const tous = ROUNDS.map(function (r, i) {
    return i;
  });
  let candidats = tous.filter(function (i) {
    return vus.indexOf(ROUNDS[i].id) === -1;
  });
  if (candidats.length === 0) {
    candidats = tous.filter(function (i) {
      return ROUNDS[i].id !== round.id;
    });
  }
  if (candidats.length === 0) candidats = [0];
  const idx = candidats[Math.floor(Math.random() * candidats.length)];

  let c = "0" + ancien.charAt(1) + LETTRES.charAt(Math.floor(idx / 32) % 32) + LETTRES.charAt(idx % 32);
  for (let i = 0; i < 2; i++) {
    c += LETTRES.charAt(Math.floor(Math.random() * LETTRES.length));
  }
  return c;
}

function roundIdDuCode(code) {
  const a = LETTRES.indexOf(code.charAt(2));
  const b = LETTRES.indexOf(code.charAt(3));
  const r = ROUNDS[a * 32 + b];
  return r ? r.id : ROUNDS[0].id;
}

// ===== Écran du duel =====
const params = new URLSearchParams(window.location.search);
const matchId = params.get("m");
const slot = params.get("slot") === "2" ? 2 : 1;
const round = ROUNDS.find(function (r) {
  return r.id === params.get("r");
}) || ROUNDS[0];
const adv = slot === 1 ? 2 : 1;

// Code de défi : "0", mise (0, 1 ou 2), numéro du sujet (2 caractères), 2 lettres au hasard
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
let nomsCharges = false;
let nomAdvTexte = "Adversaire";
let nomAdvAffiche = "Adversaire";
let resultatEnregistre = false;
let faceTexte = "";
let revancheEnCours = false;
let revancheSonJouee = false;

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
    "&r=" + encodeURIComponent(roundIdDuCode(r.code)) +
    "&slot=" + nouveauSlot;
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

  chargerNoms();
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
    ajouterVu(round.id);
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

$("btn-revanche").addEventListener("click", revanche);
demarrer();
