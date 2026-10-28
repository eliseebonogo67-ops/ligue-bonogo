import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
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

export const auth = getAuth(app);
export const db = getDatabase(app);

// Applique sur toutes les pages le thème, le cadre et le titre achetés dans la boutique
import("./profil.js")
  .then(function (m) {
    m.appliquerProfil();
  })
  .catch(function () {
    // la boutique n'est pas indispensable au reste du jeu
  });
