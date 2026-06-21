// 1. Import semua yang dibutuhkan dari library Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// 2. Konfigurasi (Salin dari Firebase Console tadi)
const firebaseConfig = {
  apiKey: "AIzaSyB63hKXEZGs...", // Pastikan ini yang asli
  authDomain: "mikostrem-app.firebaseapp.com",
  projectId: "mikostrem-app",
  storageBucket: "mikostrem-app.appspot.com",
  messagingSenderId: "899585533522",
  appId: "1:899585533522:web:085604f2d9f8e2a836218b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 3. Fungsi Login yang akan dipanggil oleh tombol HTML
window.loginGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("User logged in:", result.user);
        alert("Login Berhasil!");
    } catch (error) {
        console.error("Error:", error);
        alert("Login Gagal: " + error.message);
    }
};
