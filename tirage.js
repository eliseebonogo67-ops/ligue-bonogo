// Choix des questions des duels (et, plus tard, des compétitions) :
// on privilégie les questions que le joueur n'a pas encore vues, les plus récemment chargées,
// et on varie les matières. Quand il a fait le tour, on mélange 70 % de neuves et 30 % d'anciennes.
import { questionsPlates } from "./rounds.js";
import { matiereDeCompetition } from "./matieres.js";

const CLES = { duel: "ligue_vus_duel", comp: "ligue_vus_comp" };
const MAX_MEMOIRE = 3000;
const PART_NEUVES = 0.7;

function hasard() {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (c && c.getRandomValues) {
    const t = new Uint32Array(1);
    c.getRandomValues(t);
    return (t[0] + 0.5) / 4294967296;
  }
  return Math.random();
}

function lireMemoire(mode) {
  try {
    const h = JSON.parse(localStorage.getItem(CLES[mode]) || "{}");
    return h && typeof h === "object" ? h : {};
  } catch (e) {
    return {};
  }
}

// Note les questions qui viennent d'être jouées dans ce mode (duel ou compétition)
export function noterVus(mode, ids) {
  try {
    const h = lireMemoire(mode);
    const t = Date.now();
    ids.forEach(function (id) {
      h[id] = t;
    });
    const cles = Object.keys(h);
    if (cles.length > MAX_MEMOIRE) {
      cles
        .sort(function (a, b) {
          return h[a] - h[b];
        })
        .slice(0, cles.length - MAX_MEMOIRE)
        .forEach(function (k) {
          delete h[k];
        });
    }
    localStorage.setItem(CLES[mode], JSON.stringify(h));
  } catch (e) {
    // sans importance
  }
}

// Tirage pondéré sans remise : chaque question reçoit une clé aléatoire d'autant plus haute que son poids est grand
function trierParCle(liste, poids) {
  return liste
    .map(function (q) {
      return { q: q, cle: Math.pow(hasard(), 1 / Math.max(0.0001, poids(q))) };
    })
    .sort(function (a, b) {
      return b.cle - a.cle;
    })
    .map(function (x) {
      return x.q;
    });
}

// Prend n questions en alternant les matières (dans un ordre mélangé), les mieux notées d'abord
function prendreEnAlternant(liste, n, poids, deja) {
  const groupes = {};
  trierParCle(liste, poids).forEach(function (q) {
    (groupes[q.matiere] = groupes[q.matiere] || []).push(q);
  });
  const ordre = trierParCle(
    Object.keys(groupes).map(function (m) {
      return { matiere: m };
    }),
    function () {
      return 1;
    }
  ).map(function (x) {
    return x.matiere;
  });
  const res = [];
  let encore = true;
  while (res.length < n && encore) {
    encore = false;
    for (let i = 0; i < ordre.length && res.length < n; i++) {
      const g = groupes[ordre[i]];
      if (g.length > 0) {
        res.push(g.shift());
        encore = true;
      }
    }
  }
  return res;
}

// Cœur du tirage, sans dépendance (testable seul).
// pool : questions possibles ; k : combien en tirer ; hMode / hAutre : questions déjà vues dans ce mode / dans l'autre
// rang : plus le nombre est grand, plus la question a été chargée récemment
export function choisirParmi(pool, k, hMode, hAutre, rang) {
  const maxRang = Math.max(1, rang.max || 1);
  function etat(q) {
    if (hMode[q.id]) return hAutre[q.id] ? 3 : 2;
    return hAutre[q.id] ? 1 : 0;
  }
  const neuves = pool.filter(function (q) {
    return etat(q) <= 1;
  });
  const vues = pool.filter(function (q) {
    return etat(q) >= 2;
  });

  // Les neuves : jamais vues d'abord, puis celles déjà vues dans l'autre mode ; les plus récemment chargées en priorité
  function poidsNeuve(q) {
    const base = etat(q) === 0 ? 4 : 1;
    return base * Math.exp(3 * ((rang[q.id] || 0) / maxRang));
  }
  // Les anciennes : celles vues il y a le plus longtemps d'abord ; celles vues dans les deux modes en dernier
  let tMin = Infinity;
  let tMax = 0;
  vues.forEach(function (q) {
    tMin = Math.min(tMin, hMode[q.id]);
    tMax = Math.max(tMax, hMode[q.id]);
  });
  function poidsVue(q) {
    const age = tMax === tMin ? 0.5 : (tMax - hMode[q.id]) / (tMax - tMin);
    return (1 + 3 * age) * (etat(q) === 3 ? 0.5 : 1);
  }

  const quotaNeuves = neuves.length >= k ? k : Math.min(neuves.length, Math.round(PART_NEUVES * k));
  const choisies = prendreEnAlternant(neuves, quotaNeuves, poidsNeuve);
  if (choisies.length < k) {
    const prises = {};
    choisies.forEach(function (q) {
      prises[q.id] = true;
    });
    const anciennes = prendreEnAlternant(vues, k - choisies.length, poidsVue);
    anciennes.forEach(function (q) {
      choisies.push(q);
      prises[q.id] = true;
    });
    // s'il manque encore des questions (peu de vues), on complète avec les neuves restantes
    if (choisies.length < k) {
      const reste = neuves.filter(function (q) {
        return !prises[q.id];
      });
      prendreEnAlternant(reste, k - choisies.length, poidsNeuve).forEach(function (q) {
        choisies.push(q);
      });
    }
  }
  return choisies;
}

function rangs() {
  const r = {};
  const toutes = questionsPlates(null, null);
  toutes.forEach(function (q, i) {
    r[q.id] = i;
  });
  r.max = Math.max(1, toutes.length - 1);
  return r;
}

// Cinq questions pour un duel : un niveau et une matière (ou toutes les matières du niveau si matiere est vide)
export function tirerDuel(niveau, matiere) {
  const pool = questionsPlates(niveau, matiere || null);
  if (pool.length < 5) return null;
  return choisirParmi(pool, 5, lireMemoire("duel"), lireMemoire("comp"), rangs());
}

// Questions d'une compétition : toutes les matières sauf Maths, Physique-Chimie et Philosophie, tous niveaux mélangés
export function tirerCompetition(k) {
  const pool = questionsPlates(null, null).filter(function (q) {
    return matiereDeCompetition(q.matiere);
  });
  if (pool.length < k) return null;
  return choisirParmi(pool, k, lireMemoire("comp"), lireMemoire("duel"), rangs());
}

// Retrouve une question à partir de son identifiant (celui enregistré dans le duel ou la salle)
export function questionParId(id) {
  const toutes = questionsPlates(null, null);
  for (let i = 0; i < toutes.length; i++) {
    if (toutes[i].id === id) return toutes[i];
  }
  return null;
}

// Nombre de questions disponibles pour un duel (pour griser les choix trop pauvres)
export function nombreDisponibles(niveau, matiere) {
  return questionsPlates(niveau, matiere || null).length;
          }
