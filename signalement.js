// Bouton « Signaler cette question » pour les compétitions et les duels
import { ref, set } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { db } from "./firebase.js";

const MOTIFS = [
  { id: "fausse", texte: "❌ La bonne réponse est fausse" },
  { id: "faute", texte: "✏️ Faute ou texte incorrect" },
  { id: "ambigue", texte: "🤔 Question ambiguë" },
  { id: "autre", texte: "💬 Autre problème" }
];

// parent : l'élément où placer le bouton
// cible() : renvoie { rid, index } de la question affichée
// getUid() : renvoie l'identifiant du joueur
// Résultat : { afficher(oui) } pour montrer ou cacher le bouton
export function installerSignalement(parent, cible, getUid) {
  const bouton = document.createElement("button");
  bouton.textContent = "⚠️ Signaler cette question";
  bouton.hidden = true;
  bouton.style.cssText =
    "display:block;margin:12px auto 0;padding:8px 12px;border:0;background:none;color:#aab4ff;" +
    "font-family:inherit;font-size:13px;font-weight:700;text-decoration:underline;cursor:pointer;";
  parent.appendChild(bouton);

  const fond = document.createElement("div");
  fond.className = "fond";
  fond.hidden = true;
  const popup = document.createElement("div");
  popup.className = "popup";
  const ruban = document.createElement("div");
  ruban.className = "ruban";
  ruban.textContent = "SIGNALER";
  const croix = document.createElement("button");
  croix.className = "croix";
  croix.textContent = "✕";
  croix.setAttribute("aria-label", "Fermer");
  const question = document.createElement("p");
  question.textContent = "Qu’est-ce qui ne va pas dans cette question ?";
  question.style.cssText = "text-align:center;color:#aab4ff;font-size:13px;margin:0 0 6px;";
  const message = document.createElement("p");
  message.className = "message";

  popup.appendChild(ruban);
  popup.appendChild(croix);
  popup.appendChild(question);
  MOTIFS.forEach(function (m) {
    const b = document.createElement("button");
    b.className = "btn bleu";
    b.textContent = m.texte;
    b.style.cssText = "margin-top:12px;padding:12px;font-size:15px;";
    b.addEventListener("click", function () {
      envoyer(m.id);
    });
    popup.appendChild(b);
  });
  popup.appendChild(message);
  fond.appendChild(popup);
  document.body.appendChild(fond);

  croix.addEventListener("click", function () {
    fond.hidden = true;
  });
  bouton.addEventListener("click", function () {
    message.textContent = "";
    fond.hidden = false;
  });

  async function envoyer(motif) {
    const c = cible();
    const uid = getUid();
    if (!c || !uid) return;
    try {
      await set(ref(db, "signalements/" + c.rid + "/" + c.index + "/" + uid), {
        m: motif,
        t: Date.now()
      });
      message.textContent = "Merci ! Ton signalement a bien été envoyé.";
      setTimeout(function () {
        fond.hidden = true;
      }, 1300);
    } catch (e) {
      message.textContent =
        e.code === "PERMISSION_DENIED"
          ? "Tu as déjà signalé cette question."
          : "Envoi impossible : " + (e.code || e.message);
    }
  }

  return {
    afficher: function (oui) {
      bouton.hidden = !oui;
    }
  };
    }
