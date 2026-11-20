import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { normaliserNiveau, normaliserMatiere } from "./matieres.js";

// Séries d'exemple : elles ne servent que tant qu'aucune série n'a été importée.
// Dès qu'il y a de vraies séries, elles sont retirées automatiquement.
export const ROUNDS = [
  {
    id: "test_cg_01",
    titre: "Culture générale 1",
    niveau: "",
    matiere: "",
    questions: [
      {
        q: "Quelle est la capitale du Burkina Faso ?",
        choix: ["Bobo-Dioulasso", "Ouagadougou", "Koudougou", "Banfora"],
        bonne: 1,
        expl: "Ouagadougou est la capitale politique et administrative du Burkina Faso. Bobo-Dioulasso est la deuxième ville du pays."
      },
      {
        q: "Quel est le plus long fleuve d’Afrique ?",
        choix: ["Le Niger", "Le Congo", "Le Nil", "Le Zambèze"],
        bonne: 2,
        expl: "Le Nil mesure environ 6 650 km : c’est le plus long fleuve d’Afrique, devant le Congo et le Niger."
      },
      {
        q: "Quelle est la monnaie du Burkina Faso ?",
        choix: ["Le dollar", "Le franc CFA", "L’euro", "Le naira"],
        bonne: 1,
        expl: "Le Burkina Faso utilise le franc CFA (XOF), partagé avec les autres pays de l’UEMOA."
      },
      {
        q: "Quelle planète est la plus proche du Soleil ?",
        choix: ["Vénus", "Mercure", "Mars", "La Terre"],
        bonne: 1,
        expl: "Mercure est la planète la plus proche du Soleil. Vénus est la deuxième."
      },
      {
        q: "En quelle année le pays a-t-il pris le nom de Burkina Faso ?",
        choix: ["1960", "1974", "1984", "1991"],
        bonne: 2,
        expl: "Le 4 août 1984, la Haute-Volta est devenue le Burkina Faso, « le pays des hommes intègres »."
      }
    ]
  },
  {
    id: "test_calcul_01",
    titre: "Calcul 1",
    niveau: "",
    matiere: "",
    questions: [
      {
        q: "12 × 8 = ?",
        choix: ["86", "96", "108", "98"],
        bonne: 1,
        expl: "12 × 8 = 10 × 8 + 2 × 8 = 80 + 16 = 96."
      },
      {
        q: "15 % de 200 = ?",
        choix: ["20", "25", "30", "35"],
        bonne: 2,
        expl: "10 % de 200 = 20 et 5 % = 10, donc 15 % = 20 + 10 = 30."
      },
      {
        q: "144 ÷ 12 = ?",
        choix: ["11", "12", "14", "16"],
        bonne: 1,
        expl: "12 × 12 = 144, donc 144 ÷ 12 = 12."
      },
      {
        q: "Racine carrée de 81 = ?",
        choix: ["7", "8", "9", "11"],
        bonne: 2,
        expl: "9 × 9 = 81, donc la racine carrée de 81 est 9."
      },
      {
        q: "3/4 de 60 = ?",
        choix: ["40", "45", "48", "50"],
        bonne: 1,
        expl: "60 ÷ 4 = 15, puis 15 × 3 = 45."
      }
    ]
  }
];

// ===== Séries importées par l'administrateur =====
const CACHE = "ligue_catalogue2";
let termine = false;

// Firebase peut renvoyer une liste sous forme d'objet : on la remet en tableau
function enTableau(v) {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== "object") return [];
  return Object.keys(v)
    .sort(function (a, b) {
      return Number(a) - Number(b);
    })
    .map(function (k) {
      return v[k];
    });
}

function ajouter(liste) {
  if (termine) return;
  termine = true;
  if (liste.length === 0) return;
  ROUNDS.length = 0;
  liste
    .slice()
    .sort(function (a, b) {
      return a.ordre - b.ordre || (a.id < b.id ? -1 : 1);
    })
    .forEach(function (s) {
      ROUNDS.push({
        id: s.id,
        titre: s.titre,
        niveau: normaliserNiveau(s.niveau),
        matiere: normaliserMatiere(s.matiere),
        questions: s.questions
      });
    });
}

function lireCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "null");
    return c && Array.isArray(c.liste) ? c : null;
  } catch (e) {
    return null;
  }
}

async function chargerCatalogue() {
  const cache = lireCache();
  try {
    await signInAnonymously(auth);
    const vSnap = await get(ref(db, "catalogue/version"));
    const version = vSnap.exists() ? vSnap.val() : 0;

    // Rien n'a changé depuis la dernière fois : on réutilise la mémoire du téléphone
    if (cache && cache.version === version) {
      ajouter(cache.liste);
      return;
    }

    const snap = await get(ref(db, "sujets"));
    const brut = snap.exists() ? snap.val() : {};
    const liste = Object.keys(brut)
      .map(function (id) {
        const s = brut[id] || {};
        return {
          id: id,
          titre: s.titre,
          ordre: s.ordre || 0,
          niveau: s.niveau || "",
          matiere: s.matiere || "",
          questions: enTableau(s.questions)
        };
      })
      .filter(function (s) {
        return s.titre && s.questions.length > 0;
      });

    try {
      localStorage.setItem(CACHE, JSON.stringify({ version: version, liste: liste }));
    } catch (e) {
      // sans importance
    }
    ajouter(liste);
  } catch (e) {
    // Hors connexion : on prend la dernière version connue
    if (cache) ajouter(cache.liste);
  }
}

await Promise.race([
  chargerCatalogue(),
  new Promise(function (resolve) {
    setTimeout(resolve, 8000);
  })
]);

if (!termine) {
  const c = lireCache();
  if (c) ajouter(c.liste);
  else termine = true;
}

// ===== Questions indépendantes, pour l'entraînement =====
// Chaque question de chaque série classée (niveau + matière) devient une question à part entière.
export function questionsPlates(niveau, matiere) {
  const res = [];
  ROUNDS.forEach(function (r) {
    if (!r.niveau || !r.matiere) return;
    if (niveau && r.niveau !== niveau) return;
    if (matiere && r.matiere !== matiere) return;
    r.questions.forEach(function (q, i) {
      if (!q || !Array.isArray(q.choix) || q.choix.length < 2) return;
      res.push({
        id: r.id + "_" + i,
        rid: r.id,
        index: i,
        niveau: r.niveau,
        matiere: r.matiere,
        q: q.q,
        choix: q.choix,
        bonne: q.bonne,
        expl: q.expl || ""
      });
    });
  });
  return res;
}

// Les matières d'un niveau, avec le nombre de questions de chacune
export function matieresDuNiveau(niveau) {
  const compte = {};
  questionsPlates(niveau, null).forEach(function (q) {
    compte[q.matiere] = (compte[q.matiere] || 0) + 1;
  });
  return Object.keys(compte).map(function (id) {
    return { id: id, nb: compte[id] };
  });
      }
