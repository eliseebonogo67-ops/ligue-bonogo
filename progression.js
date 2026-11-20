// XP, grades, série de jours, défi du jour, titres à mériter et semaines du palmarès

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

// Un jour est actif si le joueur s'est entraîné ou a joué une compétition
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
  { id: "rep15", texte: "Réponds à 15 questions en entraînement", cible: 15, recompense: 15, source: "repondues" },
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
  else if (defi.source === "repondues") p = s.repondues || 0;
  else if (defi.source === "serie") p = s.serie || 0;
  else if (defi.source === "jeux") p = (v.jeux && v.jeux[date]) || 0;
  return Math.min(p, defi.cible);
}

// ===== Titres : on les mérite, on ne les achète pas =====
function somme(objet, champ) {
  let t = 0;
  Object.keys(objet || {}).forEach(function (k) {
    const x = objet[k];
    t += Number(champ ? x && x[champ] : x) || 0;
  });
  return t;
}

function maximum(objet, champ) {
  let m = 0;
  Object.keys(objet || {}).forEach(function (k) {
    const x = objet[k];
    m = Math.max(m, Number(x && x[champ]) || 0);
  });
  return m;
}

export const TITRES = [
  { id: "titre_recrue", nom: "Recrue", texte: "Recrue", desc: "Titre de départ", cible: 0 },
  {
    id: "titre_assidu",
    nom: "Assidu",
    texte: "Assidu 📅",
    desc: "Joue 7 jours d’affilée",
    cible: 7,
    mesure: function (v) {
      return calculerSerie(v, aujourdhui()).serie;
    }
  },
  {
    id: "titre_sniper",
    nom: "Sniper",
    texte: "Sniper 🎯",
    desc: "Enchaîne 10 bonnes réponses d’affilée",
    cible: 10,
    mesure: function (v) {
      return maximum(v.stats, "serie");
    }
  },
  {
    id: "titre_machine",
    nom: "Machine",
    texte: "Machine ⚡",
    desc: "Donne 300 bonnes réponses en entraînement",
    cible: 300,
    mesure: function (v) {
      return somme(v.stats, "bonnes");
    }
  },
  {
    id: "titre_strategue",
    nom: "Stratège",
    texte: "Stratège 🧠",
    desc: "Joue 10 compétitions",
    cible: 10,
    mesure: function (v) {
      return somme(v.jeux, null);
    }
  },
  {
    id: "titre_duelliste",
    nom: "Duelliste",
    texte: "Duelliste ⚔️",
    desc: "Gagne 5 duels contre des amis",
    cible: 5,
    mesure: function (v, duels) {
      return (duels && duels.v) || 0;
    }
  },
  {
    id: "titre_champion",
    nom: "Champion",
    texte: "Champion 🏆",
    desc: "Gagne 3 compétitions",
    cible: 3,
    mesure: function (v) {
      return v.victoires || 0;
    }
  },
  {
    id: "titre_legende",
    nom: "Légende",
    texte: "Légende 👑",
    desc: "Atteins le grade de Colonel (4 500 XP)",
    cible: 4500,
    mesure: function (v) {
      return totalXp(v);
    }
  }
];

// Pour chaque titre : la valeur actuelle du joueur et s'il est mérité
export function evaluerTitres(v, duels) {
  v = v || {};
  return TITRES.map(function (t) {
    const valeur = t.mesure ? t.mesure(v, duels || {}) : 0;
    return {
      id: t.id,
      nom: t.nom,
      texte: t.texte,
      desc: t.desc,
      cible: t.cible,
      valeur: Math.min(valeur, t.cible),
      merite: !t.mesure || valeur >= t.cible
    };
  });
}

// Identifiant de la semaine (du lundi au dimanche), par exemple 2026-W46
export function semaineId(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour);
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const numero = Math.ceil(((d - debutAnnee) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + "-W" + String(numero).padStart(2, "0");
}

// La semaine d'il y a n semaines (0 = cette semaine)
export function semaineIl(n) {
  return semaineId(new Date(Date.now() - n * 7 * 86400000));
}

// Temps restant avant la fin de la semaine (lundi 00 h, heure universelle)
export function resteSemaine() {
  const d = new Date();
  const jour = d.getUTCDay() || 7;
  const fin = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (8 - jour));
  const ms = Math.max(0, fin - Date.now());
  return { jours: Math.floor(ms / 86400000), heures: Math.floor((ms % 86400000) / 3600000) };
   }
