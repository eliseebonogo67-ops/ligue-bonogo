// Catalogue de la boutique (articles uniquement décoratifs) et application du profil

export const CATEGORIES = [
  { id: "animal", nom: "Animaux", emoji: "🐾" },
  { id: "theme", nom: "Thèmes", emoji: "🎨" },
  { id: "titre", nom: "Titres", emoji: "🏅" }
];

// Ce que chaque joueur porte tant qu'il n'a rien choisi (gratuit)
export const DEFAUTS = { animal: "animal_etudiant", theme: "theme_nuit", titre: "titre_recrue" };

// La rareté donne la couleur et la lueur autour de l'avatar
export const RARETES = {
  commun: { nom: "Commun", couleur: "#d9d9d9", ombre: "none" },
  rare: { nom: "Rare", couleur: "#4cc3ff", ombre: "0 0 12px rgba(76,195,255,0.7)" },
  epique: { nom: "Épique", couleur: "#b46bff", ombre: "0 0 14px rgba(180,107,255,0.8)" },
  legendaire: { nom: "Légendaire", couleur: "#ffd54a", ombre: "0 0 18px rgba(255,213,74,1)" }
};

export const ARTICLES = [
  // Animaux (ton avatar devient l'animal)
  { id: "animal_etudiant", cat: "animal", nom: "Étudiant", emoji: "🧑‍🎓", rarete: "commun", prix: 0 },
  { id: "animal_singe", cat: "animal", nom: "Singe", emoji: "🐒", rarete: "commun", prix: 40 },
  { id: "animal_cheval", cat: "animal", nom: "Cheval", emoji: "🐴", rarete: "commun", prix: 60 },
  { id: "animal_zebre", cat: "animal", nom: "Zèbre", emoji: "🦓", rarete: "commun", prix: 70 },
  { id: "animal_girafe", cat: "animal", nom: "Girafe", emoji: "🦒", rarete: "commun", prix: 80 },
  { id: "animal_loup", cat: "animal", nom: "Loup", emoji: "🐺", rarete: "rare", prix: 120 },
  { id: "animal_buffle", cat: "animal", nom: "Buffle", emoji: "🐃", rarete: "rare", prix: 140 },
  { id: "animal_hippo", cat: "animal", nom: "Hippopotame", emoji: "🦛", rarete: "rare", prix: 160 },
  { id: "animal_crocodile", cat: "animal", nom: "Crocodile", emoji: "🐊", rarete: "rare", prix: 180 },
  { id: "animal_aigle", cat: "animal", nom: "Aigle", emoji: "🦅", rarete: "epique", prix: 200 },
  { id: "animal_guepard", cat: "animal", nom: "Guépard", emoji: "🐆", rarete: "epique", prix: 220 },
  { id: "animal_tigre", cat: "animal", nom: "Tigre", emoji: "🐯", rarete: "epique", prix: 240 },
  { id: "animal_rhino", cat: "animal", nom: "Rhinocéros", emoji: "🦏", rarete: "epique", prix: 260 },
  { id: "animal_elephant", cat: "animal", nom: "Éléphant", emoji: "🐘", rarete: "epique", prix: 280 },
  { id: "animal_gorille", cat: "animal", nom: "Gorille", emoji: "🦍", rarete: "legendaire", prix: 350 },
  { id: "animal_lion", cat: "animal", nom: "Lion", emoji: "🦁", rarete: "legendaire", prix: 400 },
  { id: "animal_dragon", cat: "animal", nom: "Dragon", emoji: "🐉", rarete: "legendaire", prix: 500 },

  // Thèmes de couleurs
  { id: "theme_nuit", cat: "theme", nom: "Bleu nuit", prix: 0, haut: "#1b2a8a", milieu: "#0b1250", bas: "#060a2e", bord: "#2a3bb0" },
  { id: "theme_violet", cat: "theme", nom: "Violet royal", prix: 100, haut: "#4a1b8a", milieu: "#200b50", bas: "#10062e", bord: "#6a3bb0" },
  { id: "theme_emeraude", cat: "theme", nom: "Forêt", prix: 120, haut: "#0f6b3a", milieu: "#08331c", bas: "#031a0e", bord: "#1f9a58" },
  { id: "theme_rouge", cat: "theme", nom: "Rouge sombre", prix: 150, haut: "#8a1b2a", milieu: "#500b14", bas: "#2e060b", bord: "#b03b4a" },
  { id: "theme_ocean", cat: "theme", nom: "Océan", prix: 200, haut: "#0b6a8a", milieu: "#08354f", bas: "#031a2e", bord: "#1f8ab0" },

  // Titres
  { id: "titre_recrue", cat: "titre", nom: "Recrue", prix: 0, texte: "Recrue" },
  { id: "titre_sniper", cat: "titre", nom: "Sniper", prix: 30, texte: "Sniper 🎯" },
  { id: "titre_machine", cat: "titre", nom: "Machine", prix: 60, texte: "Machine ⚡" },
  { id: "titre_strategue", cat: "titre", nom: "Stratège", prix: 100, texte: "Stratège 🧠" },
  { id: "titre_champion", cat: "titre", nom: "Champion", prix: 150, texte: "Champion 🏆" },
  { id: "titre_legende", cat: "titre", nom: "Légende", prix: 300, texte: "Légende 👑" }
];

const CACHE = "ligue_profil";

function article(id) {
  return ARTICLES.find(function (a) {
    return a.id === id;
  });
}

// Applique le thème, l'animal et le titre sur la page ouverte
export function appliquer(equipe) {
  equipe = equipe || {};
  const racine = document.documentElement;

  const theme = article(equipe.theme) || article(DEFAUTS.theme);
  racine.style.setProperty("--fond-haut", theme.haut);
  racine.style.setProperty("--fond-milieu", theme.milieu);
  racine.style.setProperty("--fond-bas", theme.bas);
  racine.style.setProperty("--bord", theme.bord);

  const animal = article(equipe.animal) || article(DEFAUTS.animal);
  const r = RARETES[animal.rarete];
  document.querySelectorAll(".avatar").forEach(function (a) {
    a.textContent = animal.emoji;
    a.style.borderColor = r.couleur;
    a.style.boxShadow = r.ombre;
  });

  const titre = article(equipe.titre) || article(DEFAUTS.titre);
  const el = document.getElementById("titre-joueur");
  if (el) el.textContent = titre.texte;
}

function quandPret(fonction) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fonction);
  } else {
    fonction();
  }
}

// Garde en mémoire ce que le joueur porte (affichage immédiat à l'ouverture des pages)
export function memoriser(equipe) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(equipe || {}));
  } catch (e) {
    // sans importance
  }
  quandPret(function () {
    appliquer(equipe);
  });
}

// Appelée par firebase.js : applique d'abord la mémoire, puis la version enregistrée
export async function appliquerProfil() {
  let cache = {};
  try {
    cache = JSON.parse(localStorage.getItem(CACHE) || "{}");
  } catch (e) {
    cache = {};
  }
  quandPret(function () {
    appliquer(cache);
  });

  try {
    const fb = await import("./firebase.js");
    const authMod = await import("https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js");
    const dbMod = await import("https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js");
    const cred = await authMod.signInAnonymously(fb.auth);
    const snap = await dbMod.get(dbMod.ref(fb.db, "joueurs/" + cred.user.uid + "/equipe"));
    memoriser(snap.exists() ? snap.val() : {});
  } catch (e) {
    // sans connexion, on garde la version en mémoire
  }
   }
