import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB63hKXEZGsIiibm5cxt7NCAsk4VG3Rgs8",
  authDomain: "mikostrem-app.firebaseapp.com",
  projectId: "mikostrem-app",
  storageBucket: "mikostrem-app.firebasestorage.app",
  messagingSenderId: "899585533522",
  appId: "1:899585533522:web:085604f2d9f8e2a836218b",
  measurementId: "G-T9YJM77T3R"
};

// 1. Inisialisasi app dulu
const app = initializeApp(firebaseConfig);

// 2. Baru inisialisasi services menggunakan 'app' tersebut
export const db = getFirestore(app);
export const auth = getAuth(app);

// 3. Taruh ke window agar bisa diakses global jika diperlukan
window.db = db;
window.auth = auth;

console.log("Firebase & Firestore berhasil dimuat!");
