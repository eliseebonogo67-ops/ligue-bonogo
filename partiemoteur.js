export const DUREE_CULTURE_S = 20;
export const DUREE_CALCUL_S = 30;
export const PAUSE_DEBUT_MS = 10000;
export const PAUSE_QUESTION_MS = 3000;
export const PAUSE_MANCHE_MS = 12000;
export const TOLERANCE_MS = 1500;
export const MAX_MANCHES = 6;

// Chaque manche utilise un round différent (le suivant dans la liste)
export function roundDeManche(rounds, base, n) {
  return rounds[(base + n - 1) % rounds.length];
}

function dureeMs(round) {
  const s = round.id.indexOf("calcul") !== -1 ? DUREE_CALCUL_S : DUREE_CULTURE_S;
  return s * 1000;
}

export function planningManche(debut0, round) {
  const duree = dureeMs(round);
  const questions = [];
  let debut = debut0;
  round.questions.forEach(function () {
    const fin = debut + duree;
    const revele = fin + TOLERANCE_MS;
    questions.push({ debut: debut, fin: fin, revele: revele });
    debut = revele + PAUSE_QUESTION_MS;
  });
  const dernier = questions[questions.length - 1];
  return { questions: questions, fin: dernier.revele + PAUSE_QUESTION_MS };
}

function pointQuestion(q, rep, p) {
  if (!rep) return 0;
  if (rep.t < p.debut - TOLERANCE_MS) return 0;
  if (rep.t > p.fin + TOLERANCE_MS) return 0;
  return rep.c === q.bonne ? 1 : 0;
}

// ids : joueurs inscrits, lanceLe : heure de départ, base : numéro du round de départ,
// partie : réponses (partie.m1.q0[uid] = { c, t })
// marques[id] : une case par question (null = pas encore tranchée, 1 = juste, 0 = faux)
export function calculerTournoi(ids, lanceLe, base, rounds, partie, now) {
  const manches = [];
  let actifs = ids.slice();
  let debut = lanceLe + PAUSE_DEBUT_MS;
  let termine = false;
  let gagnants = [];

  for (let n = 1; n <= MAX_MANCHES; n++) {
    const round = roundDeManche(rounds, base, n);
    const plan = planningManche(debut, round);
    const rep = (partie && partie["m" + n]) || {};
    const scores = {};
    const marques = {};
    actifs.forEach(function (id) {
      scores[id] = 0;
      marques[id] = [];
    });

    round.questions.forEach(function (q, i) {
      const p = plan.questions[i];
      if (now < p.revele) {
        actifs.forEach(function (id) {
          marques[id].push(null);
        });
        return;
      }
      const rq = rep["q" + i] || {};
      actifs.forEach(function (id) {
        const pt = pointQuestion(q, rq[id], p);
        scores[id] += pt;
        marques[id].push(pt);
      });
    });

    const fini = now >= plan.fin;
    manches.push({
      n: n,
      round: round,
      plan: plan,
      debut: debut,
      joueurs: actifs.slice(),
      scores: scores,
      marques: marques,
      fini: fini
    });
    if (!fini) break;

    let max = -1;
    actifs.forEach(function (id) {
      if (scores[id] > max) max = scores[id];
    });
    const tetes = actifs.filter(function (id) {
      return scores[id] === max;
    });

    if (tetes.length === 1 || n === MAX_MANCHES) {
      termine = true;
      gagnants = tetes;
      break;
    }
    actifs = tetes;
    debut = plan.fin + PAUSE_MANCHE_MS;
  }

  return {
    manches: manches,
    termine: termine,
    gagnants: gagnants,
    partage: gagnants.length > 1
  };
}
