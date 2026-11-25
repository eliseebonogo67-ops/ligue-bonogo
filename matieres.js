// Les deux niveaux de concours et les matières de chaque salle

export const NIVEAUX = [
  { id: "bepc", nom: "BEPC", emoji: "📘", desc: "Concours direct, niveau BEPC" },
  { id: "bac", nom: "BAC", emoji: "📗", desc: "Concours direct, niveau BAC" }
];

// niveaux : les salles où la matière existe. competition : la matière peut tomber en compétition
// (Maths, Physique-Chimie et Philosophie sont exclues : leur programme diffère entre le BEPC et le BAC).
export const MATIERES = [
  { id: "maths", nom: "Mathématiques", emoji: "📐", niveaux: ["bepc", "bac"], competition: false },
  { id: "francais", nom: "Français", emoji: "✍️", niveaux: ["bepc", "bac"], competition: true },
  { id: "histoire", nom: "Histoire", emoji: "📜", niveaux: ["bepc", "bac"], competition: true },
  { id: "geographie", nom: "Géographie", emoji: "🌍", niveaux: ["bepc", "bac"], competition: true },
  { id: "svt", nom: "SVT", emoji: "🌿", niveaux: ["bepc", "bac"], competition: true },
  { id: "pc", nom: "Physique-Chimie", emoji: "⚡", niveaux: ["bepc", "bac"], competition: false },
  { id: "culture", nom: "Culture Générale", emoji: "🌐", niveaux: ["bepc", "bac"], competition: true },
  { id: "schycotech", nom: "Schycotech", emoji: "💻", niveaux: ["bepc", "bac"], competition: true },
  { id: "philo", nom: "Philosophie", emoji: "💭", niveaux: ["bac"], competition: false },
  { id: "actualites", nom: "Actualités", emoji: "📰", niveaux: ["bepc", "bac"], competition: true }
];

// Autres écritures acceptées (anciennes importations, fautes de frappe courantes)
const ALIAS = {
  maths: ["maths", "math", "mathematiques", "mathematique"],
  francais: ["francais", "lettres"],
  histoire: ["histoire", "hg", "histoire_geographie", "histoire_geo", "histoire_et_geographie"],
  geographie: ["geographie", "geo"],
  svt: ["svt", "sciences_de_la_vie_et_de_la_terre", "biologie", "sciences_naturelles"],
  pc: ["pc", "physique_chimie", "physique_et_chimie", "physique", "chimie", "sciences_physiques"],
  culture: ["culture", "culture_generale", "cg"],
  schycotech: ["schycotech", "psychotechnique", "psychotechniques", "psychotech", "psychotechnie"],
  philo: ["philo", "philosophie"],
  actualites: ["actualites", "actualite", "actu"]
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
  return { id: id, nom: nom.charAt(0).toUpperCase() + nom.slice(1), emoji: "📚", niveaux: ["bepc", "bac"], competition: false };
}

// Les matières d'une salle (la salle BEPC n'a pas de Philosophie)
export function matieresPourNiveau(niveauId) {
  return MATIERES.filter(function (m) {
    return m.niveaux.indexOf(niveauId) !== -1;
  });
}

// Une matière peut-elle tomber en compétition ?
export function matiereDeCompetition(id) {
  const m = MATIERES.find(function (x) {
    return x.id === id;
  });
  return !!(m && m.competition);
  }
