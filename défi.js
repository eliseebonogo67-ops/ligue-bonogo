import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { ROUNDS } from "./rounds.js";

// Code = round (1 chiffre) + mise (0, 1 ou 2) + 4 lettres aléatoires
const LETTRES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MISES = [0, 5, 10];

const $ = function (id) {
  return document.getElementById(id);
};

let codeCourant = null;
let solde = null;

function dire(texte) {
  $("msg").textContent = texte;
}

function nouveauCode(indexRound, indexMise) {
  let c = String(indexRound) + String(indexMise);
  for (let i = 0; i < 4; i++) {
    c += LETTRES.charAt(Math.floor(Math.random() * LETTRES.length));
  }
  return c;
}

function lireCode(code) {
  if (!/^[0-9][0-2][A-Z2-9]{4}$/.test(code)) return null;
  const round = ROUNDS[parseInt(code.charAt(0), 10)];
  if (!round) return null;
  return { round: round, mise: MISES[parseInt(code.charAt(1), 10)] };
}

function urlDuel(code, slot) {
  const info = lireCode(code);
  if (!info) return null;
  return (
    "duel.html?m=" + encodeURIComponent(code) +
    "&r=" + encodeURIComponent(info.round.id) +
    "&slot=" + slot
  );
}

function lienDefi(code) {
  return window.location.href.split("?")[0] + "?code=" + code;
}

function texteMise(m) {
  return m > 0 ? m + " pièces" : "aucune";
}

function copierSecours(texte) {
  try {
    const t = document.createElement("textarea");
    t.value = texte;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(t);
    return ok;
  } catch (e) {
    return false;
  }
}

function copier(texte) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard
      .writeText(texte)
      .then(function () {
        return true;
      })
      .catch(function () {
        return copierSecours(texte);
      });
  }
  return Promise.resolve(copierSecours(texte));
}

async function chargerSolde() {
  try {
    const cred = await signInAnonymously(auth);
    const snap = await get(ref(db, "joueurs/" + cred.user.uid + "/pieces"));
    solde = snap.exists() ? snap.val() : 0;
    $("solde").textContent = solde;
  } catch (e) {
    $("solde").textContent = "?";
  }
}

ROUNDS.forEach(function (r, i) {
  const o = document.createElement("option");
  o.value = i;
  o.textContent = r.titre;
  $("round").appendChild(o);
});

$("btn-creer").addEventListener("click", function () {
  const indexMise = parseInt($("mise").value, 10);
  const m = MISES[indexMise];
  if (solde !== null && m > solde) {
    dire("Solde insuffisant : il te faut " + m + " pièces (tu en as " + solde + ").");
    return;
  }
  codeCourant = nouveauCode($("round").value, indexMise);
  $("code").textContent = codeCourant;
  $("zone-code").hidden = false;
  dire("Défi créé (mise : " + texteMise(m) + "). Envoie le code, puis touche Commencer.");
});

$("btn-wa").addEventListener("click", function () {
  if (!codeCourant) return;
  const info = lireCode(codeCourant);
  const texte =
    "⚔️ Je te défie sur Ligue Bonogo ! Mise : " + texteMise(info.mise) +
    "\nCode : " + codeCourant + "\n" + lienDefi(codeCourant);
  window.open("https://wa.me/?text=" + encodeURIComponent(texte), "_blank");
});

$("btn-copier").addEventListener("click", function () {
  if (!codeCourant) return;
  copier(lienDefi(codeCourant)).then(function (ok) {
    dire(ok ? "Lien copié ✓" : "Copie impossible : donne simplement le code " + codeCourant);
  });
});

$("btn-commencer").addEventListener("click", function () {
  if (!codeCourant) return;
  window.location.href = urlDuel(codeCourant, 1);
});

$("saisie").addEventListener("input", function () {
  const info = lireCode($("saisie").value.trim().toUpperCase());
  if (info) {
    dire("Round : " + info.round.titre + " · mise : " + texteMise(info.mise));
  }
});

$("btn-rejoindre").addEventListener("click", function () {
  const code = $("saisie").value.trim().toUpperCase().replace(/\s/g, "");
  const info = lireCode(code);
  if (!info) {
    dire("Code invalide : il doit avoir 6 caractères.");
    return;
  }
  if (solde !== null && info.mise > solde) {
    dire("Solde insuffisant : il te faut " + info.mise + " pièces (tu en as " + solde + ").");
    return;
  }
  window.location.href = urlDuel(code, 2);
});

// Si l'ami ouvre le lien, le code est déjà rempli
const params = new URLSearchParams(window.location.search);
const recu = params.get("code");
if (recu) {
  $("saisie").value = recu.toUpperCase();
  const info = lireCode(recu.toUpperCase());
  dire(info
    ? "Round : " + info.round.titre + " · mise : " + texteMise(info.mise)
    : "Code reçu invalide.");
}

chargerSolde();
