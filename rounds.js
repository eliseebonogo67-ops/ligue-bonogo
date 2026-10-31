import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";

export const ROUNDS = [
  {
    id: "test_cg_01",
    titre: "Culture générale 1",
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
  },
  {
    id: "cg_02",
    titre: "Culture générale 2",
    questions: [
      {
        q: "Quel est le plus grand océan du monde ?",
        choix: ["Atlantique", "Pacifique", "Indien", "Arctique"],
        bonne: 1,
        expl: "L’océan Pacifique couvre environ un tiers de la surface de la Terre : c’est le plus grand et le plus profond."
      },
      {
        q: "Quel organe pompe le sang dans le corps ?",
        choix: ["Le foie", "Le cœur", "Le poumon", "Le rein"],
        bonne: 1,
        expl: "Le cœur est un muscle qui pompe le sang dans tout le corps."
      },
      {
        q: "Quel est le pays le plus peuplé d’Afrique ?",
        choix: ["L’Éthiopie", "L’Égypte", "Le Nigeria", "L’Afrique du Sud"],
        bonne: 2,
        expl: "Le Nigeria compte plus de 200 millions d’habitants : c’est le pays le plus peuplé d’Afrique."
      },
      {
        q: "Combien de jours compte une année non bissextile ?",
        choix: ["364", "365", "366", "360"],
        bonne: 1,
        expl: "Une année normale compte 365 jours ; l’année bissextile en compte 366."
      },
      {
        q: "Quelle est la langue officielle du Burkina Faso ?",
        choix: ["Le mooré", "Le français", "Le dioula", "L’anglais"],
        bonne: 1,
        expl: "Le français est la langue officielle. Le mooré, le dioula et le fulfuldé sont des langues nationales très parlées."
      }
    ]
  },
  {
    id: "calcul_02",
    titre: "Calcul 2",
    questions: [
      {
        q: "25 × 4 = ?",
        choix: ["80", "100", "120", "90"],
        bonne: 1,
        expl: "25 × 4 = 100 : quatre quarts de 100 font 100."
      },
      {
        q: "Quel est le périmètre d’un carré de côté 7 cm ?",
        choix: ["14 cm", "21 cm", "28 cm", "49 cm"],
        bonne: 2,
        expl: "Périmètre = 4 × côté = 4 × 7 = 28 cm."
      },
      {
        q: "20 % de 150 = ?",
        choix: ["20", "30", "25", "35"],
        bonne: 1,
        expl: "10 % de 150 = 15, donc 20 % = 30."
      },
      {
        q: "Résous : 3x = 27. Que vaut x ?",
        choix: ["6", "8", "9", "12"],
        bonne: 2,
        expl: "x = 27 ÷ 3 = 9."
      },
      {
        q: "Quelle est la moitié de 3/4 ?",
        choix: ["3/8", "3/4", "1/4", "6/4"],
        bonne: 0,
        expl: "La moitié de 3/4 s’obtient en divisant par 2 : 3/4 ÷ 2 = 3/8."
      }
    ]
  },
  {
    id: "hg_bf",
    titre: "Histoire-Géo Burkina",
    questions: [
      {
        q: "En quelle année la Haute-Volta a-t-elle obtenu son indépendance ?",
        choix: ["1958", "1960", "1962", "1966"],
        bonne: 1,
        expl: "La Haute-Volta est devenue indépendante le 5 août 1960."
      },
      {
        q: "Qui fut le premier président de la Haute-Volta indépendante ?",
        choix: ["Thomas Sankara", "Maurice Yaméogo", "Blaise Compaoré", "Sangoulé Lamizana"],
        bonne: 1,
        expl: "Maurice Yaméogo fut le premier président de la Haute-Volta indépendante, en 1960."
      },
      {
        q: "Quelle est la deuxième ville du Burkina Faso ?",
        choix: ["Koudougou", "Bobo-Dioulasso", "Ouahigouya", "Banfora"],
        bonne: 1,
        expl: "Bobo-Dioulasso, dans l’ouest, est la deuxième ville du pays après Ouagadougou."
      },
      {
        q: "Quel pays ne partage pas de frontière avec le Burkina Faso ?",
        choix: ["Le Mali", "Le Ghana", "Le Nigeria", "Le Togo"],
        bonne: 2,
        expl: "Le Burkina Faso borde six pays : Mali, Niger, Bénin, Togo, Ghana et Côte d’Ivoire. Le Nigeria n’en fait pas partie."
      },
      {
        q: "Comment appelle-t-on les habitants du Burkina Faso ?",
        choix: ["Les Burkinabè", "Les Burkinois", "Les Voltaïques", "Les Burkinais"],
        bonne: 0,
        expl: "On dit « Burkinabè » (le mot ne change pas au pluriel) pour désigner les habitants du Burkina Faso."
      }
    ]
  },
  {
    id: "francais_01",
    titre: "Français",
    questions: [
      {
        q: "Quel est le féminin de « acteur » ?",
        choix: ["Acteuse", "Actrice", "Acteure", "Actrisse"],
        bonne: 1,
        expl: "Beaucoup de noms en -teur font leur féminin en -trice : acteur → actrice."
      },
      {
        q: "Quel est le pluriel de « cheval » ?",
        choix: ["Chevals", "Chevaux", "Chevaus", "Chevales"],
        bonne: 1,
        expl: "La plupart des noms en -al font leur pluriel en -aux : cheval → chevaux."
      },
      {
        q: "Quelle est la nature du mot « rapidement » ?",
        choix: ["Adjectif", "Adverbe", "Nom", "Verbe"],
        bonne: 1,
        expl: "« Rapidement » est un adverbe : il est invariable et précise un verbe."
      },
      {
        q: "Complète : « Demain, nous ____ au marché. »",
        choix: ["allons", "sommes allés", "irons", "allions"],
        bonne: 2,
        expl: "« Demain » indique le futur : nous irons."
      },
      {
        q: "Quel mot est un synonyme de « rapide » ?",
        choix: ["Lent", "Prompt", "Calme", "Faible"],
        bonne: 1,
        expl: "« Prompt » signifie rapide. « Lent » est son contraire."
      }
    ]
  },
  {
    id: "svt_01",
    titre: "SVT",
    questions: [
      {
        q: "Quel gaz les plantes absorbent-elles pour la photosynthèse ?",
        choix: ["L’oxygène", "Le dioxyde de carbone", "L’azote", "L’hydrogène"],
        bonne: 1,
        expl: "Les plantes absorbent le dioxyde de carbone (CO₂) et rejettent de l’oxygène."
      },
      {
        q: "Quel organe permet de respirer chez l’être humain ?",
        choix: ["Le cœur", "Les poumons", "L’estomac", "Le foie"],
        bonne: 1,
        expl: "Les poumons échangent l’oxygène et le dioxyde de carbone avec le sang."
      },
      {
        q: "Quel animal est un mammifère ?",
        choix: ["Le crocodile", "Le requin", "La chauve-souris", "Le lézard"],
        bonne: 2,
        expl: "La chauve-souris allaite ses petits : c’est un mammifère, comme l’être humain."
      },
      {
        q: "Quel insecte transmet le paludisme ?",
        choix: ["La mouche tsé-tsé", "Le moustique anophèle", "La puce", "Le pou"],
        bonne: 1,
        expl: "Le paludisme est transmis par la piqûre de l’anophèle femelle infectée."
      },
      {
        q: "À quoi servent les globules rouges ?",
        choix: ["Défendre l’organisme", "Transporter l’oxygène", "Coaguler le sang", "Digérer les aliments"],
        bonne: 1,
        expl: "Les globules rouges transportent l’oxygène grâce à l’hémoglobine."
      }
    ]
  },
  {
    id: "pc_01",
    titre: "Physique-Chimie",
    questions: [
      {
        q: "Quelle est la formule chimique de l’eau ?",
        choix: ["CO₂", "H₂O", "O₂", "NaCl"],
        bonne: 1,
        expl: "Une molécule d’eau contient 2 atomes d’hydrogène et 1 atome d’oxygène : H₂O."
      },
      {
        q: "Quelle est l’unité de mesure de la force ?",
        choix: ["Le joule", "Le newton", "Le watt", "Le pascal"],
        bonne: 1,
        expl: "La force se mesure en newtons (N)."
      },
      {
        q: "À quelle température l’eau pure bout-elle au niveau de la mer ?",
        choix: ["50 °C", "80 °C", "100 °C", "120 °C"],
        bonne: 2,
        expl: "Au niveau de la mer, l’eau pure bout à 100 °C."
      },
      {
        q: "Dans quel état de la matière se trouve un glaçon ?",
        choix: ["Solide", "Liquide", "Gazeux", "Plasma"],
        bonne: 0,
        expl: "Un glaçon est de l’eau à l’état solide. En fondant, il devient liquide."
      },
      {
        q: "Quelle est la vitesse approximative de la lumière dans le vide ?",
        choix: ["300 000 km/s", "3 000 km/s", "30 000 km/s", "3 000 000 km/s"],
        bonne: 0,
        expl: "La lumière se propage à environ 300 000 km par seconde dans le vide."
      }
    ]
  },
  {
    id: "afrique_01",
    titre: "Afrique",
    questions: [
      {
        q: "Quel est le plus grand désert chaud du monde ?",
        choix: ["Le Kalahari", "Le Sahara", "Le Namib", "Le Gobi"],
        bonne: 1,
        expl: "Le Sahara, en Afrique du Nord, est le plus grand désert chaud du monde."
      },
      {
        q: "Quelle est la capitale du Sénégal ?",
        choix: ["Dakar", "Abidjan", "Bamako", "Conakry"],
        bonne: 0,
        expl: "Dakar est la capitale du Sénégal."
      },
      {
        q: "Dans quel pays se trouvent Abidjan et Yamoussoukro ?",
        choix: ["Le Ghana", "La Côte d’Ivoire", "Le Mali", "Le Togo"],
        bonne: 1,
        expl: "Abidjan et Yamoussoukro sont en Côte d’Ivoire. Yamoussoukro est la capitale officielle."
      },
      {
        q: "Quel est le plus haut sommet d’Afrique ?",
        choix: ["Le mont Kenya", "Le Kilimandjaro", "Le mont Cameroun", "Le Drakensberg"],
        bonne: 1,
        expl: "Le Kilimandjaro, en Tanzanie, culmine à environ 5 895 m."
      },
      {
        q: "Où se trouve le siège de l’Union africaine ?",
        choix: ["Nairobi", "Addis-Abeba", "Abuja", "Le Caire"],
        bonne: 1,
        expl: "Le siège de l’Union africaine est à Addis-Abeba, en Éthiopie."
      }
    ]
  },
  {
    id: "calcul_03",
    titre: "Calcul 3",
    questions: [
      {
        q: "7² = ?",
        choix: ["14", "49", "42", "56"],
        bonne: 1,
        expl: "7² = 7 × 7 = 49."
      },
      {
        q: "Un article à 2 000 FCFA est soldé de 25 %. Quel est le nouveau prix ?",
        choix: ["1 500 FCFA", "1 750 FCFA", "1 800 FCFA", "1 250 FCFA"],
        bonne: 0,
        expl: "25 % de 2 000 = 500, donc le nouveau prix est 2 000 − 500 = 1 500 FCFA."
      },
      {
        q: "Quelle est l’aire d’un rectangle de 8 m sur 5 m ?",
        choix: ["13 m²", "26 m²", "40 m²", "45 m²"],
        bonne: 2,
        expl: "Aire = longueur × largeur = 8 × 5 = 40 m²."
      },
      {
        q: "0,5 + 0,25 = ?",
        choix: ["0,75", "0,70", "0,30", "0,85"],
        bonne: 0,
        expl: "0,5 + 0,25 = 0,75."
      },
      {
        q: "1 000 − 357 = ?",
        choix: ["643", "653", "743", "633"],
        bonne: 0,
        expl: "1 000 − 357 = 643."
      }
    ]
  }
];

// ===== Sujets importés par l'administrateur, ajoutés à la suite des sujets d'exemple =====
const CACHE = "ligue_catalogue";
let termine = false;

function ajouter(liste) {
  if (termine) return;
  termine = true;
  liste
    .slice()
    .sort(function (a, b) {
      return (a.ordre - b.ordre) || (a.id < b.id ? -1 : 1);
    })
    .forEach(function (s) {
      ROUNDS.push({ id: s.id, titre: s.titre, questions: s.questions });
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
        return { id: id, titre: s.titre, ordre: s.ordre || 0, questions: s.questions };
      })
      .filter(function (s) {
        return s.titre && Array.isArray(s.questions) && s.questions.length > 0;
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
