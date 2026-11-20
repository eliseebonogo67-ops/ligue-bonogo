// Les deux niveaux de l'application et les matières connues

export const NIVEAUX = [
  { id: "bepc", nom: "BEPC", emoji: "📘", desc: "Classe de 3e" },
  { id: "bac", nom: "Baccalauréat", emoji: "🎓", desc: "Classe de terminale" }
];

export const MATIERES = [
  { id: "francais", nom: "Français", emoji: "📖" },
  { id: "maths", nom: "Mathématiques", emoji: "➗" },
  { id: "pc", nom: "Physique-Chimie", emoji: "⚗️" },
  { id: "svt", nom: "SVT", emoji: "🧬" },
  { id: "hg", nom: "Histoire-Géographie", emoji: "🌍" },
  { id: "anglais", nom: "Anglais", emoji: "🇬🇧" },
  { id: "philo", nom: "Philosophie", emoji: "💭" },
  { id: "ecm", nom: "ECM", emoji: "⚖️" }
];

// Autres écritures acceptées (anciennes importations, fautes de frappe courantes)
const ALIAS = {
  francais: ["francais", "lettres"],
  maths: ["maths", "math", "mathematiques", "mathematique"],
  pc: ["pc", "physique_chimie", "physique_et_chimie", "physique", "chimie", "sciences_physiques"],
  svt: ["svt", "sciences_de_la_vie_et_de_la_terre", "biologie", "sciences_naturelles"],
  hg: ["hg", "histoire_geographie", "histoire_geo", "histoire_et_geographie", "histoire", "geographie"],
  anglais: ["anglais", "english"],
  philo: ["philo", "philosophie"],
  ecm: ["ecm", "education_civique_et_morale", "education_civique", "civisme"]
};

export function slugTexte(texte) {
  return String(texte === undefined || texte === null ? "" : texte)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

// "BEPC" -> "bepc", "BAC" ou "Baccalauréat" -> "bac", le reste -> "" (non classé)
export function normaliserNiveau(texte) {
  const s = slugTexte(texte);
  if (s.indexOf("bepc") !== -1) return "bepc";
  if (s.indexOf("bac") !== -1) return "bac";
  return "";
}

export function normaliserMatiere(texte) {
  const s = slugTexte(texte);
  if (!s) return "";
  const ids = Object.keys(ALIAS);
  for (let i = 0; i < ids.length; i++) {
    if (ALIAS[ids[i]].indexOf(s) !== -1) return ids[i];
  }
  return s;
}

export function infoNiveau(id) {
  return (
    NIVEAUX.find(function (n) {
      return n.id === id;
    }) || { id: id, nom: id || "Non classé", emoji: "📚", desc: "" }
  );
}

// Matière inconnue (écrite à la main) : on affiche son nom lisible
export function infoMatiere(id) {
  const m = MATIERES.find(function (x) {
    return x.id === id;
  });
  if (m) return m;
  const nom = String(id || "Non classée").replace(/_/g, " ");
  return { id: id, nom: nom.charAt(0).toUpperCase() + nom.slice(1), emoji: "📚" };
       }
