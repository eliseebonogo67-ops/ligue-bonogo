// Catalogue de la boutique (articles uniquement décoratifs), application et publication du profil
import { totalXp, semaineId, TITRES, evaluerTitres } from "./progression.js";

export const CATEGORIES = [
  { id: "animal", nom: "Avatars", emoji: "🐾" },
  { id: "cadre", nom: "Cadres", emoji: "🖼️" },
  { id: "theme", nom: "Thèmes", emoji: "🎨" }
];

// Ce que chaque joueur porte tant qu'il n'a rien choisi (gratuit)
export const DEFAUTS = {
  animal: "animal_etudiant",
  theme: "theme_nuit",
  titre: "titre_recrue",
  cadre: "cadre_aucun"
};

// La rareté donne la couleur et la lueur autour de l'avatar
export const RARETES = {
  commun: { nom: "Commun", couleur: "#d9d9d9", ombre: "none" },
  rare: { nom: "Rare", couleur: "#4cc3ff", ombre: "0 0 12px rgba(76,195,255,0.7)" },
  epique: { nom: "Épique", couleur: "#b46bff", ombre: "0 0 14px rgba(180,107,255,0.8)" },
  legendaire: { nom: "Légendaire", couleur: "#ffd54a", ombre: "0 0 18px rgba(255,213,74,1)" }
};

export const ARTICLES = [
  // Avatars : les animaux
  { id: "animal_etudiant", cat: "animal", groupe: "Animaux", nom: "Étudiant", emoji: "🧑‍🎓", rarete: "commun", prix: 0 },
  { id: "animal_singe", cat: "animal", groupe: "Animaux", nom: "Singe", emoji: "🐒", rarete: "commun", prix: 40 },
  { id: "animal_cheval", cat: "animal", groupe: "Animaux", nom: "Cheval", emoji: "🐴", rarete: "commun", prix: 60 },
  { id: "animal_zebre", cat: "animal", groupe: "Animaux", nom: "Zèbre", emoji: "🦓", rarete: "commun", prix: 70 },
  { id: "animal_girafe", cat: "animal", groupe: "Animaux", nom: "Girafe", emoji: "🦒", rarete: "commun", prix: 80 },
  { id: "animal_loup", cat: "animal", groupe: "Animaux", nom: "Loup", emoji: "🐺", rarete: "rare", prix: 120 },
  { id: "animal_buffle", cat: "animal", groupe: "Animaux", nom: "Buffle", emoji: "🐃", rarete: "rare", prix: 140 },
  { id: "animal_hippo", cat: "animal", groupe: "Animaux", nom: "Hippopotame", emoji: "🦛", rarete: "rare", prix: 160 },
  { id: "animal_crocodile", cat: "animal", groupe: "Animaux", nom: "Crocodile", emoji: "🐊", rarete: "rare", prix: 180 },
  { id: "animal_aigle", cat: "animal", groupe: "Animaux", nom: "Aigle", emoji: "🦅", rarete: "epique", prix: 200 },
  { id: "animal_guepard", cat: "animal", groupe: "Animaux", nom: "Guépard", emoji: "🐆", rarete: "epique", prix: 220 },
  { id: "animal_tigre", cat: "animal", groupe: "Animaux", nom: "Tigre", emoji: "🐯", rarete: "epique", prix: 240 },
  { id: "animal_rhino", cat: "animal", groupe: "Animaux", nom: "Rhinocéros", emoji: "🦏", rarete: "epique", prix: 260 },
  { id: "animal_elephant", cat: "animal", groupe: "Animaux", nom: "Éléphant", emoji: "🐘", rarete: "epique", prix: 280 },
  { id: "animal_gorille", cat: "animal", groupe: "Animaux", nom: "Gorille", emoji: "🦍", rarete: "legendaire", prix: 350 },
  { id: "animal_lion", cat: "animal", groupe: "Animaux", nom: "Lion", emoji: "🦁", rarete: "legendaire", prix: 400 },
  { id: "animal_dragon", cat: "animal", groupe: "Animaux", nom: "Dragon", emoji: "🐉", rarete: "legendaire", prix: 500 },

  // Avatars : Savants & Pionniers (une image par personnage, à mettre dans le dépôt)
  { id: "heros_edison", cat: "animal", groupe: "Savants & Pionniers", nom: "Thomas Edison", devise: "J’essaie, je rate, je recommence", emoji: "💡", img: "av_edison.png", rarete: "rare", prix: 100 },
  { id: "heros_darwin", cat: "animal", groupe: "Savants & Pionniers", nom: "Charles Darwin", devise: "J’observe, je comprends", emoji: "🐢", img: "av_darwin.png", rarete: "rare", prix: 100 },
  { id: "heros_diop", cat: "animal", groupe: "Savants & Pionniers", nom: "Cheikh Anta Diop", devise: "L’Afrique a sa science", emoji: "🌍", img: "av_diop.png", rarete: "rare", prix: 100 },
  { id: "heros_galilee", cat: "animal", groupe: "Savants & Pionniers", nom: "Galilée", devise: "La Terre tourne", emoji: "🔭", img: "av_galilee.png", rarete: "rare", prix: 100 },
  { id: "heros_newton", cat: "animal", groupe: "Savants & Pionniers", nom: "Isaac Newton", devise: "Pourquoi la pomme tombe ?", emoji: "🍎", img: "av_newton.png", rarete: "rare", prix: 100 },
  { id: "heros_einstein", cat: "animal", groupe: "Savants & Pionniers", nom: "Albert Einstein", devise: "Tout est relatif", emoji: "🧠", img: "av_einstein.png", rarete: "rare", prix: 100 },
  { id: "heros_hampate", cat: "animal", groupe: "Savants & Pionniers", nom: "Amadou Hampâté Bâ", devise: "Un vieillard = une bibliothèque", emoji: "📚", img: "av_hampate.png", rarete: "rare", prix: 100 },
  { id: "heros_curie", cat: "animal", groupe: "Savants & Pionniers", nom: "Marie Curie", devise: "La science n’a pas peur", emoji: "⚗️", img: "av_curie.png", rarete: "rare", prix: 100 },
  { id: "heros_imhotep", cat: "animal", groupe: "Savants & Pionniers", nom: "Imhotep", devise: "Je soigne, je construis", emoji: "🏺", img: "av_imhotep.png", rarete: "rare", prix: 100 },
  { id: "heros_sankara", cat: "animal", groupe: "Savants & Pionniers", nom: "Thomas Sankara", devise: "Osons inventer l’avenir", emoji: "⭐", img: "av_sankara.png", rarete: "rare", prix: 100 },

  // Cadres autour de l'avatar (dessinés par le code, aucune image à ajouter)
  { id: "cadre_aucun", cat: "cadre", nom: "Aucun cadre", rarete: "commun", prix: 0 },
  { id: "cadre_argent", cat: "cadre", nom: "Argent", rarete: "commun", prix: 60 },
  { id: "cadre_or", cat: "cadre", nom: "Or", rarete: "rare", prix: 120 },
  { id: "cadre_cristal", cat: "cadre", nom: "Cristal", rarete: "rare", prix: 180 },
  { id: "cadre_amethyste", cat: "cadre", nom: "Améthyste", rarete: "epique", prix: 240 },
  { id: "cadre_ailes", cat: "cadre", nom: "Cœur ailé", rarete: "epique", prix: 280 },
  { id: "cadre_royal", cat: "cadre", nom: "Royal", rarete: "legendaire", prix: 400 },

  // Thèmes de couleurs
  { id: "theme_nuit", cat: "theme", nom: "Bleu nuit", prix: 0, haut: "#1b2a8a", milieu: "#0b1250", bas: "#060a2e", bord: "#2a3bb0" },
  { id: "theme_violet", cat: "theme", nom: "Violet royal", prix: 100, haut: "#4a1b8a", milieu: "#200b50", bas: "#10062e", bord: "#6a3bb0" },
  { id: "theme_emeraude", cat: "theme", nom: "Forêt", prix: 120, haut: "#0f6b3a", milieu: "#08331c", bas: "#031a0e", bord: "#1f9a58" },
  { id: "theme_rouge", cat: "theme", nom: "Rouge sombre", prix: 150, haut: "#8a1b2a", milieu: "#500b14", bas: "#2e060b", bord: "#b03b4a" },
  { id: "theme_ocean", cat: "theme", nom: "Océan", prix: 200, haut: "#0b6a8a", milieu: "#08354f", bas: "#031a2e", bord: "#1f8ab0" }
];

const CACHE = "ligue_profil";
const CACHE_PUB = "ligue_pub";

// Un article de la boutique, ou un titre (les titres ne s'achètent pas : ils se méritent)
export function article(id) {
  const a = ARTICLES.find(function (x) {
    return x.id === id;
  });
  if (a) return a;
  const t = TITRES.find(function (x) {
    return x.id === id;
  });
  if (t) return { id: t.id, cat: "titre", nom: t.nom, texte: t.texte, prix: 0 };
  return undefined;
}

// ===== Cadres : dessinés avec du CSS, ajoutés une seule fois à la page =====
let stylesPrets = false;

function injecterStyles() {
  if (stylesPrets) return;
  stylesPrets = true;
  const s = document.createElement("style");
  s.textContent =
    "[data-cadre]{position:relative;}" +
    "[data-cadre]::before,[data-cadre]::after{position:absolute;line-height:1;pointer-events:none;}" +
    '[data-cadre="cadre_argent"]{border-color:#eef2fb !important;box-shadow:0 0 0 3px #8a93aa,0 0 10px rgba(220,226,245,0.7) !important;}' +
    '[data-cadre="cadre_or"]{border-color:#ffd54a !important;box-shadow:0 0 0 3px #a86a00,0 0 16px rgba(255,213,74,0.95) !important;}' +
    '[data-cadre="cadre_cristal"]{border-color:#bff0ff !important;box-shadow:0 0 0 3px #2a7fd6,0 0 16px rgba(120,210,255,0.95) !important;}' +
    '[data-cadre="cadre_cristal"]::after{content:"◆";top:-11px;left:50%;transform:translateX(-50%);font-size:15px;color:#bff0ff;text-shadow:0 0 6px #2a7fd6;}' +
    '[data-cadre="cadre_amethyste"]{border-color:#e6c8ff !important;box-shadow:0 0 0 3px #7a2fd0,0 0 16px rgba(190,120,255,0.95) !important;}' +
    '[data-cadre="cadre_amethyste"]::after{content:"✦";top:-12px;left:50%;transform:translateX(-50%);font-size:16px;color:#f0d8ff;text-shadow:0 0 6px #7a2fd0;}' +
    '[data-cadre="cadre_ailes"]{border-color:#ffc2d9 !important;box-shadow:0 0 0 3px #e0457f,0 0 16px rgba(255,120,170,0.95) !important;}' +
    '[data-cadre="cadre_ailes"]::after{content:"♥";bottom:-10px;left:50%;transform:translateX(-50%);font-size:16px;color:#ff6fa3;text-shadow:0 0 6px #fff;}' +
    '[data-cadre="cadre_royal"]{border-color:#ffe27a !important;box-shadow:0 0 0 3px #7a2fd0,0 0 0 6px #ffd54a,0 0 20px rgba(255,213,74,1) !important;}' +
    '[data-cadre="cadre_royal"]::after{content:"👑";top:-15px;left:50%;transform:translateX(-50%);font-size:16px;}' +
    ".ligue-toast{position:fixed;left:12px;right:12px;top:12px;z-index:50;padding:12px;border-radius:14px;" +
    "background:linear-gradient(#ffd54a,#ffa800);color:#5a3a00;text-align:center;font:800 14px sans-serif;" +
    "box-shadow:0 6px 18px rgba(0,0,0,0.5);}";
  document.head.appendChild(s);
}

// Remplit une pastille d'avatar : image du personnage ou emoji, couleur de rareté et cadre
export function remplirAvatar(el, animalId, cadreId) {
  injecterStyles();
  const a = article(animalId) || article(DEFAUTS.animal);
  const r = RARETES[a.rarete] || RARETES.commun;
  if (a.img) {
    el.textContent = "";
    el.style.backgroundImage = "url(" + a.img + ")";
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  } else {
    el.textContent = a.emoji;
    el.style.backgroundImage = "";
    el.style.backgroundSize = "";
    el.style.backgroundPosition = "";
  }
  el.style.borderColor = r.couleur;
  el.style.boxShadow = r.ombre;
  if (cadreId && cadreId !== "cadre_aucun" && article(cadreId)) el.setAttribute("data-cadre", cadreId);
  else el.removeAttribute("data-cadre");
  return a;
}

// Applique le thème, l'avatar, le cadre et le titre sur la page ouverte
export function appliquer(equipe) {
  equipe = equipe || {};
  injecterStyles();
  const racine = document.documentElement;

  const theme = article(equipe.theme) || article(DEFAUTS.theme);
  racine.style.setProperty("--fond-haut", theme.haut);
  racine.style.setProperty("--fond-milieu", theme.milieu);
  racine.style.setProperty("--fond-bas", theme.bas);
  racine.style.setProperty("--bord", theme.bord);

  document.querySelectorAll(".avatar").forEach(function (a) {
    remplirAvatar(a, equipe.animal || DEFAUTS.animal, equipe.cadre);
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

// Publie le profil public et le gain de la semaine quand quelque chose a changé
async function publier(uid, v, fb, dbMod) {
  const equipe = v.equipe || {};
  const animal = equipe.animal || DEFAUTS.animal;
  const cadre = equipe.cadre || DEFAUTS.cadre;
  const titre = equipe.titre || DEFAUTS.titre;
  const xp = totalXp(v);

  // Le gain de la semaine : l'XP d'aujourd'hui moins l'XP au premier passage de la semaine
  const sem = semaineId(new Date());
  const maj = {};
  let base = v.base && typeof v.base[sem] === "number" ? v.base[sem] : null;
  if (base === null) {
    base = xp;
    maj["joueurs/" + uid + "/base/" + sem] = xp;
  }
  const gain = Math.max(0, xp - base);

  let pseudo = "";
  const sp = await dbMod.get(dbMod.ref(fb.db, "profils/" + uid + "/pseudo"));
  if (sp.exists()) pseudo = sp.val();

  const signature = [uid, animal, cadre, titre, xp, sem, gain, pseudo].join("|");
  try {
    if (localStorage.getItem(CACHE_PUB) === signature) return;
  } catch (e) {
    // sans importance
  }

  maj["profils/" + uid + "/animal"] = animal;
  maj["profils/" + uid + "/cadre"] = cadre;
  maj["profils/" + uid + "/titre"] = titre;
  maj["profils/" + uid + "/xp"] = xp;
  maj["profils/" + uid + "/maj"] = Date.now();

  const p = "palmares/" + sem + "/" + uid + "/";
  maj[p + "gain"] = gain;
  maj[p + "animal"] = animal;
  maj[p + "titre"] = titre;
  if (pseudo) maj[p + "pseudo"] = pseudo;
  maj[p + "maj"] = Date.now();

  await dbMod.update(dbMod.ref(fb.db), maj);
  try {
    localStorage.setItem(CACHE_PUB, signature);
  } catch (e) {
    // sans importance
  }
}

// Petit message en haut de l'écran quand un titre vient d'être mérité
function annoncer(titres) {
  quandPret(function () {
    injecterStyles();
    const d = document.createElement("div");
    d.className = "ligue-toast";
    d.textContent =
      "🏅 Nouveau titre mérité : " +
      titres
        .map(function (t) {
          return t.texte;
        })
        .join(", ") +
      " — à équiper dans ton profil";
    document.body.appendChild(d);
    setTimeout(function () {
      if (d.parentNode) d.parentNode.removeChild(d);
    }, 6500);
  });
}

// Débloque pour de bon les titres dont les conditions sont remplies (écriture une seule fois)
async function debloquerTitres(uid, v, fb, dbMod) {
  const deja = v.titres || {};
  let duels = {};
  if (!deja.titre_duelliste) {
    const s = await dbMod.get(dbMod.ref(fb.db, "profils/" + uid + "/duels"));
    if (s.exists()) duels = s.val();
  }
  const nouveaux = evaluerTitres(v, duels).filter(function (t) {
    return t.merite && t.id !== "titre_recrue" && !deja[t.id];
  });
  if (nouveaux.length === 0) return;
  const maj = {};
  nouveaux.forEach(function (t) {
    maj["joueurs/" + uid + "/titres/" + t.id] = true;
  });
  await dbMod.update(dbMod.ref(fb.db), maj);
  annoncer(nouveaux);
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
    const uid = cred.user.uid;
    const snap = await dbMod.get(dbMod.ref(fb.db, "joueurs/" + uid));
    const v = snap.exists() ? snap.val() : {};
    memoriser(v.equipe || {});
    try {
      await publier(uid, v, fb, dbMod);
    } catch (e) {
      // le profil public se mettra à jour à la prochaine ouverture
    }
    try {
      await debloquerTitres(uid, v, fb, dbMod);
    } catch (e) {
      // les titres se débloqueront à la prochaine ouverture
    }
  } catch (e) {
    // sans connexion, on garde la version en mémoire
  }
   }
