// Import fungsi yang diperlukan
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";

// Konfigurasi dari Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyB63hKXEZGsIiibm5cxt7NCAsk4VG3Rgs8",
  authDomain: "mikostrem-app.firebaseapp.com",
  projectId: "mikostrem-app",
  storageBucket: "mikostrem-app.firebasestorage.app",
  messagingSenderId: "899585533522",
  appId: "1:899585533522:web:085604f2d9f8e2a836218b",
  measurementId: "G-T9YJM77T3R"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Fungsi untuk menyimpan data favorit
async function simpanFavorit(namaAnime) {
  try {
    const docRef = await addDoc(collection(db, "favorit"), {
      judul: namaAnime,
      user: "Miko",
      timestamp: new Date().toISOString()
    });
    alert("Berhasil ditambahkan ke Favorit!");
    console.log("Data tersimpan dengan ID: ", docRef.id);
  } catch (e) {
    console.error("Gagal simpan: ", e);
    alert("Gagal simpan, cek koneksi atau database rules.");
  }
}

// Penting: Masukkan fungsi ke window agar bisa dipanggil dari HTML (onclick)
window.simpanFavorit = simpanFavorit;
