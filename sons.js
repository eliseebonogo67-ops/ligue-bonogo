// Sons générés par le téléphone (gratuit, aucun fichier audio)
const CLE = "ligue_son";
let actif = true;
try {
  actif = localStorage.getItem(CLE) !== "0";
} catch (e) {
  actif = true;
}
let ctx = null;

function contexte() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function note(freq, duree, type, volume, retard) {
  if (!actif) return;
  const c = contexte();
  if (!c) return;
  const t0 = c.currentTime + (retard || 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume || 0.2, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duree + 0.03);
}

function vib(ms) {
  if (actif && navigator.vibrate) {
    try {
      navigator.vibrate(ms);
    } catch (e) {
      // sans importance
    }
  }
}

export const Sons = {
  clic: function () {
    note(700, 0.05, "square", 0.07);
  },
  bon: function () {
    note(660, 0.12, "sine", 0.22);
    note(880, 0.2, "sine", 0.22, 0.11);
    vib(25);
  },
  faux: function () {
    note(220, 0.22, "sawtooth", 0.13);
    note(165, 0.3, "sawtooth", 0.13, 0.18);
    vib(120);
  },
  serie: function (n) {
    const base = 523 * Math.pow(1.12, Math.min(n, 8));
    note(base, 0.1, "triangle", 0.2, 0.25);
    note(base * 1.5, 0.18, "triangle", 0.2, 0.34);
  },
  // Pièces gagnées : petite cascade qui monte
  piece: function () {
    [988, 1175, 1319, 1568].forEach(function (f, i) {
      note(f, 0.09, "square", 0.08, i * 0.07);
    });
  },
  // Pièces perdues ou payées : trois notes qui descendent
  perte: function () {
    [784, 659, 523].forEach(function (f, i) {
      note(f, 0.1, "triangle", 0.12, i * 0.09);
    });
  },
  tic: function () {
    note(880, 0.05, "sine", 0.12);
  },
  depart: function () {
    note(523, 0.12, "triangle", 0.2);
    note(659, 0.12, "triangle", 0.2, 0.13);
    note(784, 0.3, "triangle", 0.22, 0.26);
  },
  victoire: function () {
    note(523, 0.14, "triangle", 0.22);
    note(659, 0.14, "triangle", 0.22, 0.15);
    note(784, 0.14, "triangle", 0.22, 0.3);
    note(1047, 0.45, "triangle", 0.24, 0.45);
    vib(200);
  },
  defaite: function () {
    note(392, 0.2, "sine", 0.18);
    note(330, 0.2, "sine", 0.18, 0.2);
    note(262, 0.45, "sine", 0.18, 0.4);
  }
};

// Compteur qui monte ou descend avec un son à chaque pas
export function animerCompteur(el, de, vers, duree) {
  if (!el) return;
  de = Number(de) || 0;
  vers = Number(vers) || 0;
  if (de === vers) {
    el.textContent = vers;
    return;
  }
  const pas = Math.min(Math.abs(vers - de), 12);
  const monte = vers > de;
  let i = 0;
  el.textContent = de;
  const timer = setInterval(function () {
    i++;
    el.textContent = Math.round(de + ((vers - de) * i) / pas);
    note(monte ? 700 + i * 60 : 900 - i * 50, 0.05, "square", 0.07);
    if (i >= pas) {
      clearInterval(timer);
      el.textContent = vers;
      if (monte) Sons.piece();
      else Sons.perte();
    }
  }, (duree || 900) / pas);
}

// Le navigateur exige un premier toucher avant d'autoriser le son
document.addEventListener(
  "pointerdown",
  function () {
    contexte();
  },
  { once: true }
);

// Un petit son sur tous les boutons (les réponses ont leurs propres sons)
document.addEventListener(
  "click",
  function (e) {
    const b = e.target.closest ? e.target.closest("button, a.btn") : null;
    if (!b || b.id === "ligue-son") return;
    if (b.closest("#choix")) return;
    Sons.clic();
  },
  true
);

function creerBouton() {
  const b = document.createElement("button");
  b.id = "ligue-son";
  b.textContent = actif ? "🔊" : "🔇";
  b.setAttribute("aria-label", "Son");
  b.style.cssText =
    "position:fixed;bottom:14px;right:14px;z-index:9999;width:42px;height:42px;padding:0;" +
    "border-radius:50%;border:2px solid #f0b400;background:rgba(10,18,90,0.9);color:#fff;" +
    "font-size:20px;cursor:pointer;";
  b.addEventListener("click", function () {
    actif = !actif;
    try {
      localStorage.setItem(CLE, actif ? "1" : "0");
    } catch (e) {
      // sans importance
    }
    b.textContent = actif ? "🔊" : "🔇";
    if (actif) Sons.clic();
  });
  document.body.appendChild(b);
}

if (document.body) creerBouton();
else document.addEventListener("DOMContentLoaded", creerBouton);
