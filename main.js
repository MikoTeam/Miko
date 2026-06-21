import { auth, provider, db } from "./firebase-config.js";
import { signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let semuaAnime = [];

// --- FUNGSI TOP XP (BARU) ---
async function muatTopXp() {
    const xpCard = document.querySelector(".xp-card");
    if (!xpCard) return;
    try {
        const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(3));
        const querySnapshot = await getDocs(q);
        let html = `<h3>👑 TOP 3 XP USERS</h3>`;
        querySnapshot.forEach((doc, i) => {
            const u = doc.data();
            html += `<p style="font-size:13px; margin:5px 0;">${i + 1}. ${u.nama} - ${u.xp} XP</p>`;
        });
        xpCard.innerHTML = html;
    } catch (e) { console.error("Error Top XP:", e); }
}

// --- FUNGSI LOGIN ---
window.loginGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await setDoc(userRef, { nama: user.displayName, email: user.email, photo: user.photoURL, xp: 0, level: 1 });
        }
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        tampilkanProfil(user);
        muatAnime();
        muatTopXp(); 
    } catch (e) { 
        alert("Login Gagal: " + e.message); 
    }
};

// --- FUNGSI PROFIL ---
async function tampilkanProfil(user) {
    try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        document.getElementById('profileContent').innerHTML = `
            <div class="avatar-large">${data.nama.charAt(0)}</div>
            <div class="user-info">
                <h3>${data.nama}</h3>
                <p class="role">● Premium Member</p>
                <div class="stats-footer">
                    <div class="xp-bar"><span>Lvl: ${data.level}</span><span>XP: ${data.xp}</span></div>
                </div>
            </div>
        `;
    } catch (e) { console.error(e); }
}

window.tambahXp = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const newXp = data.xp + 20;
            const newLevel = Math.floor(newXp / 500) + 1;
            await updateDoc(userRef, { xp: newXp, level: newLevel });
            tampilkanProfil(user);
            muatTopXp();
        }
    } catch (e) { console.error(e); }
};

// --- FUNGSI NAVIGASI ---
window.pindah = (id) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    if(id === 'favorit') window.muatFavorit();
};

// --- FUNGSI VIDEO & ANIME (Struktur Asli Kamu) ---
window.muatAnime = async function() {
    const grid = document.querySelector(".anime-grid");
    if (!grid) return;
    const querySnapshot = await getDocs(collection(db, "anime"));
    semuaAnime = [];
    querySnapshot.forEach((doc) => semuaAnime.push({ id: doc.id, ...doc.data() }));
    renderGrid(semuaAnime);
};

function renderGrid(dataList, isSearch = false) {
    const grid = document.querySelector(".anime-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const dataToDisplay = isSearch ? dataList : dataList.slice(0, 10);
    dataToDisplay.forEach(data => {
        const epsLinksStr = encodeURIComponent(JSON.stringify(data.epsLinks || {}));
        grid.innerHTML += `
            <div class="anime-item">
                <div class="poster" style="background-image: url('${data.posterUrl}');" 
                onclick="bukaVideo('${data.judul}', '${data.deskripsi}', '${epsLinksStr}', '${data.genre || ''}', '${data.posterUrl}')"></div>
                <p>${data.judul}</p>
            </div>
        `;
    });
}

window.cariAnime = () => {
    const input = document.getElementById('searchInput').value.toLowerCase();
    renderGrid(input === "" ? semuaAnime : semuaAnime.filter(a => a.judul.toLowerCase().includes(input)), input !== "");
};

window.bukaVideo = (judul, deskripsi, epsLinksStr, genre, posterUrl) => {
    const modal = document.getElementById('videoModal');
    const player = document.getElementById('videoPlayer');
    const info = document.getElementById('videoInfo');
    const epsLinks = JSON.parse(decodeURIComponent(epsLinksStr));
    const keys = Object.keys(epsLinks).sort();
    player.src = epsLinks[keys[0]];
    let episodeList = keys.map(k => `<button class="eps-btn" onclick="gantiVideo('${epsLinks[k]}')">Ep ${k}</button>`).join('');
    info.innerHTML = `<h2>${judul}</h2><p>${deskripsi}</p><h3>Daftar Episode</h3><div class="eps-scroll-container">${episodeList}</div>`;
    modal.style.display = 'block';
    window.tambahXp();
};

window.gantiVideo = (url) => { document.getElementById('videoPlayer').src = url; document.getElementById('videoPlayer').play(); };
window.tutupVideo = () => { document.getElementById('videoPlayer').pause(); document.getElementById('videoModal').style.display = 'none'; };
