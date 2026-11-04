// XP, grades, série de jours et défi du jour

export const GRADES = [
  { nom: "Recrue", xp: 0, emoji: "🛡️" },
  { nom: "Soldat", xp: 100, emoji: "🪖" },
  { nom: "Caporal", xp: 250, emoji: "🎖️" },
  { nom: "Sergent", xp: 500, emoji: "⚔️" },
  { nom: "Adjudant", xp: 900, emoji: "🏅" },
  { nom: "Lieutenant", xp: 1500, emoji: "🥈" },
  { nom: "Capitaine", xp: 2300, emoji: "🥇" },
  { nom: "Commandant", xp: 3300, emoji: "💎" },
  { nom: "Colonel", xp: 4500, emoji: "👑" },
  { nom: "Général", xp: 6000, emoji: "⭐" }
];

// Le grade correspondant à un total d'XP, et la progression vers le suivant
export function gradeDe(xp) {
  let index = 0;
  GRADES.forEach(function (g, i) {
    if (xp >= g.xp) index = i;
  });
  const grade = GRADES[index];
  const suivant = GRADES[index + 1] || null;
  let pct = 100;
  if (suivant) pct = Math.round(((xp - grade.xp) / (suivant.xp - grade.xp)) * 100);
  return {
    index: index,
    grade: grade,
    suivant: suivant,
    pct: Math.max(0, Math.min(100, pct))
  };
}

// XP total : l'XP de l'entraînement + 10 XP par inscription à une compétition
export function totalXp(v) {
  v = v || {};
  let jeux = 0;
  if (v.jeux) {
    Object.keys(v.jeux).forEach(function (k) {
      jeux += Number(v.jeux[k]) || 0;
    });
  }
  return (v.xp || 0) + jeux * 10;
}

// La date du jour (heure du Burkina = heure universelle)
export function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

export function jourPrecedent(date, n) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Un jour est actif si le joueur a fait un round d'entraînement ou joué une compétition
function actif(v, jour) {
  return !!((v.stats && v.stats[jour]) || (v.jeux && v.jeux[jour]) || (v.jours && v.jours[jour]));
}

// Série de jours consécutifs, avec un seul jour de grâce
export function calculerSerie(v, date) {
  v = v || {};
  const fait = actif(v, date);
  let o = fait ? 0 : 1;
  let serie = 0;
  let grace = false;
  for (let garde = 0; garde < 400; garde++) {
    if (actif(v, jourPrecedent(date, o))) {
      serie++;
      o++;
    } else if (!grace && serie > 0 && actif(v, jourPrecedent(date, o + 1))) {
      grace = true;
      o++;
    } else {
      break;
    }
  }
  return { serie: serie, aujourdhuiFait: fait, graceUtilisee: grace };
}

// Défis du jour (le même pour tous les joueurs, il change chaque jour)
export const DEFIS = [
  { id: "bonnes10", texte: "Réponds juste à 10 questions en entraînement", cible: 10, recompense: 15, source: "bonnes" },
  { id: "rounds2", texte: "Termine 2 rounds d’entraînement", cible: 2, recompense: 15, source: "rounds" },
  { id: "serie4", texte: "Enchaîne 4 bonnes réponses d’affilée", cible: 4, recompense: 20, source: "serie" },
  { id: "comp1", texte: "Joue une partie en compétition", cible: 1, recompense: 20, source: "jeux" },
  { id: "bonnes20", texte: "Réponds juste à 20 questions en entraînement", cible: 20, recompense: 25, source: "bonnes" }
];

export function defiDuJour(date) {
  const j = Math.floor(Date.parse(date + "T00:00:00Z") / 86400000);
  return DEFIS[j % DEFIS.length];
}

export function progresDefi(defi, v, date) {
  v = v || {};
  const s = (v.stats && v.stats[date]) || {};
  let p = 0;
  if (defi.source === "bonnes") p = s.bonnes || 0;
  else if (defi.source === "rounds") p = s.rounds || 0;
  else if (defi.source === "serie") p = s.serie || 0;
  else if (defi.source === "jeux") p = (v.jeux && v.jeux[date]) || 0;
  return Math.min(p, defi.cible);
  }
