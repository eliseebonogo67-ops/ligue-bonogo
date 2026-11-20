// Outils partagés : mélange équitable (entraînement) et mélange reproductible (compétitions, duels)

function entierAleatoire(max) {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (c && c.getRandomValues) {
    const t = new Uint32Array(1);
    const limite = Math.floor(4294967296 / max) * max;
    let x;
    do {
      c.getRandomValues(t);
      x = t[0];
    } while (x >= limite);
    return x % max;
  }
  return Math.floor(Math.random() * max);
}

// Mélange de Fisher-Yates : chaque ordre possible a exactement la même chance
export function melanger(tableau) {
  const t = tableau.slice();
  for (let i = t.length - 1; i > 0; i--) {
    const j = entierAleatoire(i + 1);
    const x = t[i];
    t[i] = t[j];
    t[j] = x;
  }
  return t;
}

export function choixAleatoire(tableau) {
  return tableau[entierAleatoire(tableau.length)];
}

// Ordre des choix d'une question : ordre[k] = numéro d'origine du choix affiché en position k
export function ordreAleatoire(n) {
  const base = [];
  for (let i = 0; i < n; i++) base.push(i);
  return melanger(base);
}

function hachage(texte) {
  let h = 1779033703 ^ texte.length;
  for (let i = 0; i < texte.length; i++) {
    h = Math.imul(h ^ texte.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function generateur(graine) {
  let a = graine;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Même graine = même ordre (utile pour garder le même affichage pendant toute une question)
export function ordreReproductible(n, graine) {
  const alea = generateur(hachage(String(graine)));
  const t = [];
  for (let i = 0; i < n; i++) t.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    const x = t[i];
    t[i] = t[j];
    t[j] = x;
  }
  return t;
      }
