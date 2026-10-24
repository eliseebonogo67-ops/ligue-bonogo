import { ref, set, update } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { db } from "./firebase.js";
import { formatDe, FENETRE_MS, idCycle, ouvreDeId } from "./formats.js";

// Crée la fiche d'un cycle (une seule fois : les règles refusent un doublon)
export async function creerFiche(id, nbRounds) {
  const fid = id.split("_")[0];
  const f = formatDe(fid);
  if (!f) return;
  const ouvre = ouvreDeId(id);
  const b = "salons/" + id + "/";
  const maj = {};
  maj[b + "fid"] = fid;
  maj[b + "mise"] = f.mise;
  maj[b + "max"] = f.max;
  maj[b + "round"] = Math.floor(ouvre / 1000) % nbRounds;
  maj[b + "ouvre"] = ouvre;
  maj[b + "ferme"] = ouvre + FENETRE_MS;
  maj[b + "nb"] = 0;
  try {
    await update(ref(db), maj);
  } catch (e) {
    // déjà créée par un autre téléphone
  }
}

// Désigne un nouveau cycle courant, puis crée sa fiche
export async function ouvrirCycle(fid, ouvreMs, nbRounds) {
  const id = idCycle(fid, ouvreMs);
  try {
    await set(ref(db, "salles/" + fid + "/courant"), id);
  } catch (e) {
    return false;
  }
  await creerFiche(id, nbRounds);
  return true;
}

// Moins de 2 joueurs à la fermeture : on repousse la fermeture par tranches de 45 s
export async function prolonger(id, ferme, now) {
  const k = Math.floor((now - ferme) / FENETRE_MS) + 1;
  try {
    await set(ref(db, "salons/" + id + "/ferme"), ferme + k * FENETRE_MS);
  } catch (e) {
    // un autre téléphone l'a déjà fait
  }
}
