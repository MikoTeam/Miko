import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB63hKXEZGsIiibm5cxt7NCAsk4VG3Rgs8",
  authDomain: "mikostrem-app.firebaseapp.com",
  projectId: "mikostrem-app",
  storageBucket: "mikostrem-app.appspot.com",
  messagingSenderId: "899585533522",
  appId: "1:899585533522:web:085604f2d9f8e2a836218b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
