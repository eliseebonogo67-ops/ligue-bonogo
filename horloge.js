import { ref, onValue } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { db } from "./firebase.js";

let offset = 0;
let base = null;
let perf0 = 0;

// Mesure l'écart entre le téléphone et le serveur, une fois au démarrage
export function initHorloge() {
  return new Promise(function (resolve) {
    onValue(ref(db, ".info/serverTimeOffset"), function (s) {
      offset = s.val() || 0;
      if (base === null) {
        base = Date.now() + offset;
        perf0 = performance.now();
      }
      resolve();
    });
  });
}

// Heure du serveur estimée. L'horloge interne ne recule jamais :
// reculer l'heure du téléphone en pleine partie ne donne aucun temps en plus.
export function maintenant() {
  const viaDate = Date.now() + offset;
  if (base === null) return viaDate;
  const viaInterne = base + (performance.now() - perf0);
  return Math.max(viaDate, viaInterne);
            }
