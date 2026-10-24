// Réglages (modifiables pour les tests)
export const DUREE_CULTURE_S = 30; // mets 10 pour tester plus vite
export const DUREE_CALCUL_S = 45;  // mets 15 pour tester plus vite
export const PAUSE_DEBUT_MS = 6000;
export const TOLERANCE_MS = 1500;  // délai accepté pour un réseau lent
export const REVEAL_MS = 4000;
export const ECART_EGALITE_MS = 0; // 0 = le plus rapide gagne toujours
export const DEUX_FAUX = "annulee"; // "annulee" ou "premier"

export function dureeQuestionMs(round) {
  const s = round.id.indexOf("calcul") !== -1 ? DUREE_CALCUL_S : DUREE_CULTURE_S;
  return s * 1000;
}

export function planning(lanceLe, round) {
  const duree = dureeQuestionMs(round);
  let debut = lanceLe + PAUSE_DEBUT_MS;
  return round.questions.map(function () {
    const p = {
      debut: debut,
      fin: debut + duree,
      revele: debut + duree + TOLERANCE_MS,
      suivante: debut + duree + TOLERANCE_MS + REVEAL_MS
    };
    debut = p.suivante;
    return p;
  });
}

function reponseValide(rep, p) {
  if (!rep) return null;
  if (rep.t < p.debut - TOLERANCE_MS) return null;
  if (rep.t > p.fin + TOLERANCE_MS) return null;
  return rep;
}

// gagnant : 1, 2, ou null (question annulée)
export function resultatQuestion(q, rep1, rep2, p) {
  const r1 = reponseValide(rep1, p);
  const r2 = reponseValide(rep2, p);
  const ok1 = !!r1 && r1.c === q.bonne;
  const ok2 = !!r2 && r2.c === q.bonne;
  let gagnant = null;

  if (ok1 && ok2) {
    if (Math.abs(r1.t - r2.t) <= ECART_EGALITE_MS) {
      gagnant = null;
    } else {
      gagnant = r1.t < r2.t ? 1 : 2;
    }
  } else if (ok1) {
    gagnant = 1;
  } else if (ok2) {
    gagnant = 2;
  } else if (DEUX_FAUX === "premier" && r1 && r2) {
    gagnant = r1.t <= r2.t ? 1 : 2;
  }

  return {
    gagnant: gagnant,
    c1: r1 ? r1.c : null,
    c2: r2 ? r2.c : null,
    ok1: ok1,
    ok2: ok2
  };
}

export function calculer(round, data, now) {
  const plan = planning(data.lanceLe, round);
  const resultats = [];
  let v1 = 0;
  let v2 = 0;

  round.questions.forEach(function (q, i) {
    const p = plan[i];
    if (now < p.revele) {
      resultats.push(null);
      return;
    }
    const rq = (data.reponses && data.reponses["q" + i]) || {};
    const res = resultatQuestion(q, rq[data.j1], rq[data.j2], p);
    resultats.push(res);
    if (res.gagnant === 1) v1++;
    if (res.gagnant === 2) v2++;
  });

  return { plan: plan, resultats: resultats, v1: v1, v2: v2 };
                                }
