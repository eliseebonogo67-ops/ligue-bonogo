// Catalogue de la boutique (articles uniquement décoratifs) et application du profil

export const CATEGORIES = [
  { id: "cadre", nom: "Cadres", emoji: "🖼️" },
  { id: "theme", nom: "Thèmes", emoji: "🎨" },
  { id: "titre", nom: "Titres", emoji: "🏅" }
];

// Ce que chaque joueur porte tant qu'il n'a rien choisi (gratuit)
export const DEFAUTS = { cadre: "cadre_or", theme: "theme_nuit", titre: "titre_recrue" };

export const ARTICLES = [
  // Cadres d'avatar
  { id: "cadre_or", cat: "cadre", nom: "Or classique", prix: 0, couleur: "#f0b400", ombre: "none" },
  { id: "cadre_bronze", cat: "cadre", nom: "Bronze", prix: 40, couleur: "#cd7f32", ombre: "0 0 10px rgba(205,127,50,0.6)" },
  { id: "cadre_argent", cat: "cadre", nom: "Argent", prix: 80, couleur: "#d9d9d9", ombre: "0 0 12px rgba(217,217,217,0.6)" },
  { id: "cadre_emeraude", cat: "cadre", nom: "Émeraude", prix: 120, couleur: "#2ecc71", ombre: "0 0 14px rgba(46,204,113,0.8)" },
  { id: "cadre_flammes", cat: "cadre", nom: "Flammes", prix: 180, couleur: "#ff6b2c", ombre: "0 0 16px rgba(255,107,44,0.9)" },
  { id: "cadre_neon", cat: "cadre", nom: "Néon", prix: 250, couleur: "#00e5ff", ombre: "0 0 18px rgba(0,229,255,1)" },

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

// Applique le thème, le cadre et le titre sur la page ouverte
export function appliquer(equipe) {
  equipe = equipe || {};
  const racine = document.documentElement;

  const theme = article(equipe.theme) || article(DEFAUTS.theme);
  racine.style.setProperty("--fond-haut", theme.haut);
  racine.style.setProperty("--fond-milieu", theme.milieu);
  racine.style.setProperty("--fond-bas", theme.bas);
  racine.style.setProperty("--bord", theme.bord);

  const cadre = article(equipe.cadre) || article(DEFAUTS.cadre);
  document.querySelectorAll(".avatar").forEach(function (a) {
    a.style.borderColor = cadre.couleur;
    a.style.boxShadow = cadre.ombre;
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
