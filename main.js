import { auth, provider, db } from "./firebase-config.js";
import { signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- DETEKTIF LOGIN (BARU: Menjaga sesi agar tidak hilang saat refresh) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Jika user terdeteksi login, langsung buka aplikasi
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        tampilkanProfil(user);
        muatAnime();
    } else {
        // Jika tidak ada user, tampilkan layar login
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }
});

let semuaAnime = [];

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
        // Catatan: Setelah login berhasil, onAuthStateChanged di atas akan otomatis mengurus perpindahan layar
    } catch (e) { 
        console.error("Login Error:", e);
        alert("Login Gagal: " + e.message); 
    }
};

// --- FUNGSI PROFIL & XP ---
async function tampilkanProfil(user) {
    try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        document.getElementById('profileContent').innerHTML = `
            <img src="${data.photo}" style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid #f39c12; margin-bottom:10px;">
            <h3>${data.nama}</h3>
            <p class="role" style="color:#f39c12;">● Premium Member</p>
            <div style="margin-top:20px; text-align:left; border-top:1px solid #333; padding-top:15px;">
                <p>📧 ${data.email}</p>
                <div style="display:flex; justify-content:space-between; margin-top:15px;">
                    <span>Level: ${data.level}</span>
                    <span>XP: ${data.xp}</span>
                </div>
            </div>
        `;
    } catch (e) { console.error("Error Profil:", e); }
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
        }
    } catch (e) { console.error("Error XP:", e); }
};

// --- FUNGSI VIDEO ---
window.gantiVideo = (url) => { 
    const player = document.getElementById('videoPlayer');
    player.src = url; 
    player.play(); 
    window.tambahXp();
};

// --- FUNGSI ANIME ---
window.muatAnime = async function() {
    const grid = document.querySelector(".anime-grid");
    if (!grid) return;
    try {
        const querySnapshot = await getDocs(collection(db, "anime"));
        semuaAnime = [];
        querySnapshot.forEach((doc) => semuaAnime.push({ id: doc.id, ...doc.data() }));
        renderGrid(semuaAnime);
    } catch (e) { console.error(e); }
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
                <p style="text-align:center; font-size: 12px; margin-top:8px;">${data.judul}</p>
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
    if (modal && player) {
        const keys = Object.keys(epsLinks).sort();
        player.src = epsLinks[keys[0]];
        player.load();
        window.tambahXp();
        let episodeList = keys.map(k => `<button class="eps-btn" onclick="gantiVideo('${epsLinks[k]}')">Ep ${k}</button>`).join('');
        const genreTags = genre ? genre.split(',').map(g => `<span class="genre-tag">${g.trim()}</span>`).join('') : '';
        info.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <button onclick="tambahFavorit('${judul}', '${posterUrl}', '${deskripsi}', '${epsLinksStr}', '${genre}')" style="background:transparent; border:none; color:#e74c3c; font-size:24px; cursor:pointer;">❤️</button>
                <h2 style="margin:0;">${judul}</h2>
            </div>
            <div style="margin: 10px 0;">${genreTags}</div>
            <p style="margin-top:15px; font-size:14px; color:#ccc;">${deskripsi}</p>
            <h3 style="margin-top:20px;">Daftar Episode</h3>
            <div class="eps-scroll-container">${episodeList}</div>`;
        modal.style.display = 'block';
    }
};

// --- FUNGSI FAVORIT ---
window.tambahFavorit = (judul, posterUrl, deskripsi, epsLinksStr, genre) => {
    let favs = JSON.parse(localStorage.getItem('favoritMiko') || '[]');
    if (!favs.find(a => a.judul === judul)) {
        favs.push({ judul, posterUrl, deskripsi, epsLinksStr, genre });
        localStorage.setItem('favoritMiko', JSON.stringify(favs));
        alert("Berhasil ditambah ke favorit!");
    } else { alert("Sudah ada di favorit!"); }
};

window.hapusFavorit = (judul) => {
    let favs = JSON.parse(localStorage.getItem('favoritMiko') || '[]');
    favs = favs.filter(a => a.judul !== judul);
    localStorage.setItem('favoritMiko', JSON.stringify(favs));
    window.muatFavorit();
};

window.muatFavorit = () => {
    const grid = document.getElementById('favorit-grid');
    if (!grid) return;
    const favs = JSON.parse(localStorage.getItem('favoritMiko') || '[]');
    grid.innerHTML = "";
    favs.forEach(data => {
        grid.innerHTML += `
            <div class="anime-item" style="position:relative;">
                <button onclick="hapusFavorit('${data.judul}')" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); border:none; color:white; border-radius:50%; width:25px; height:25px; cursor:pointer;">×</button>
                <div class="poster" style="background-image: url('${data.posterUrl}');" 
                onclick="bukaVideo('${data.judul}', '${data.deskripsi}', '${data.epsLinksStr}', '${data.genre}', '${data.posterUrl}')"></div>
                <p style="text-align:center; font-size: 12px; margin-top:8px;">${data.judul}</p>
            </div>
        `;
    });
};

// --- NAVIGASI ---
window.pindah = (id) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(id)) btn.classList.add('active');
    });
    if(id === 'favorit') window.muatFavorit();
};

window.pilihHari = async (btn, hari) => {
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('jadwal-content');
    content.innerHTML = `<p style="text-align:center;">Memuat...</p>`;
    try {
        const docSnap = await getDoc(doc(db, "jadwal", hari));
        if (docSnap.exists()) {
            let html = ``;
            for (const id of docSnap.data().animeIds) {
                const animeSnap = await getDoc(doc(db, "anime", id));
                if (animeSnap.exists()) {
                    const a = animeSnap.data();
                    html += `
                    <div class="item-card" onclick="bukaVideo('${a.judul}', '${a.deskripsi}', '${encodeURIComponent(JSON.stringify(a.epsLinks))}', '${a.genre || ''}', '${a.posterUrl}')">
                        <div class="thumb-small" style="background-image:url('${a.posterUrl}'); background-size:cover;"></div>
                        <div class="item-info">
                            <strong style="font-size:16px;">${a.judul}</strong><br>
                            <small style="color:#f39c12;">${a.jamTayang || "-"} WIB</small>
                            <span style="color:#00e676; font-size:12px; margin-left:8px; font-weight:bold;">${a.epsRilis || "New"}</span>
                        </div>
                    </div>`;
                }
            }
            content.innerHTML = html;
        } else { content.innerHTML = `<p style="text-align:center;">Belum ada jadwal.</p>`; }
    } catch (e) { console.error("Error Jadwal:", e); }
};

window.tutupVideo = () => { document.getElementById('videoPlayer').pause(); document.getElementById('videoModal').style.display = 'none'; };
        
