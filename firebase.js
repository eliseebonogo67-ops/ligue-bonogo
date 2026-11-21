import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import "./sons.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCW5AVP-5NzzzEuTEFrHr8KLVZbGrsbS8",
  authDomain: "concours-bonogo-9c948.firebaseapp.com",
  databaseURL: "https://concours-bonogo-9c948-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "concours-bonogo-9c948",
  storageBucket: "concours-bonogo-9c948.firebasestorage.app",
  messagingSenderId: "327306780971",
  appId: "1:327306780971:web:91f0c668ff616925d8e56e"
};

const app = initializeApp(firebaseConfig);

// Le vrai module d'authentification : à utiliser pour créer, relier ou supprimer un compte (page compte.html)
export const authReel = getAuth(app);
export const db = getDatabase(app);

// Un joueur est toujours connecté avant que la page ne démarre :
// compte protégé (e-mail) s'il en a un, sinon compte invité créé automatiquement.
try {
  await authReel.authStateReady();
  if (!authReel.currentUser) await signInAnonymously(authReel);
} catch (e) {
  // sans connexion : les pages réessaieront quand le réseau reviendra
}

// Les pages appellent signInAnonymously(auth) pour obtenir le joueur connecté.
// Pour un compte protégé par e-mail, cette fonction créerait par erreur un NOUVEAU compte invité.
// On présente donc le compte protégé comme « déjà connecté » : toutes les pages gardent le même code.
function joueurPourLesPages(utilisateur) {
  return new Proxy(utilisateur, {
    get: function (cible, nom) {
      if (nom === "isAnonymous") return true;
      const v = Reflect.get(cible, nom, cible);
      return typeof v === "function" ? v.bind(cible) : v;
    }
  });
}

export const auth = new Proxy(authReel, {
  get: function (cible, nom) {
    if (nom === "currentUser") {
      const u = cible.currentUser;
      return u && !u.isAnonymous ? joueurPourLesPages(u) : u;
    }
    const v = Reflect.get(cible, nom, cible);
    return typeof v === "function" ? v.bind(cible) : v;
  }
});

// Applique sur toutes les pages le thème, le cadre et le titre achetés dans la boutique
import("./profil.js")
  .then(function (m) {
    m.appliquerProfil();
  })
  .catch(function () {
    // la boutique n'est pas indispensable au reste du jeu
  });

// Sur toutes les pages : cadeau de bienvenue à la première visite, puis contrôle de l'abonnement
import("./abonnement.js")
  .then(function (m) {
    m.garde();
  })
  .catch(function () {
    // l'abonnement n'est pas indispensable au reste du jeu
  });
