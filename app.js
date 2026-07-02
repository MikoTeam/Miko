import { auth, provider, db } from "./firebase-config.js";
import { signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- DETEKTIF LOGIN (Anti-refresh) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        tampilkanProfil(user);
        muatAnime();
        muatTopXp(); // Panggil fungsi top XP
    } else {
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }
});

let semuaAnime = [];

// --- FUNGSI TOP XP (BARU) ---
async function muatTopXp() {
    const xpCard = document.querySelector(".xp-card");
    if (!xpCard) return;
    
    try {
        const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(3));
        const querySnapshot = await getDocs(q);
        
        let html = `<h3>👑 TOP 3 XP USERS</h3>`;
        querySnapshot.forEach((doc, index) => {
            const user = doc.data();
            html += `<p style="font-size:13px; margin-top:5px;">${index + 1}. ${user.nama} (${user.xp} XP)</p>`;
        });
        xpCard.innerHTML = html;
    } catch (e) { console.error("Error Top XP:", e); }
}

// --- FUNGSI LOGIN ---
window.loginGoogle = async () => {
    try {
        await signInWithPopup(auth, provider);
        // Sesi akan ditangani oleh onAuthStateChanged
    } catch (e) { alert("Login Gagal: " + e.message); }
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
            muatTopXp(); // Update top XP setelah XP user bertambah
        }
    } catch (e) { console.error("Error XP:", e); }
};

// --- FUNGSI ANIME & VIDEO (Sama seperti sebelumnya) ---
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
    if (modal && player) {
        const keys = Object.keys(epsLinks).sort();
        player.src = epsLinks[keys[0]];
        player.load();
        window.tambahXp();
        let episodeList = keys.map(k => `<button class="eps-btn" onclick="gantiVideo('${epsLinks[k]}')">Ep ${k}</button>`).join('');
        const genreTags = genre ? genre.split(',').map(g => `<span class="genre-tag">${g.trim()}</span>`).join('') : '';
        info.innerHTML = `
            <h2>${judul}</h2>
            <div style="margin: 10px 0;">${genreTags}</div>
            <p>${deskripsi}</p>
            <h3>Daftar Episode</h3>
            <div class="eps-scroll-container">${episodeList}</div>`;
        modal.style.display = 'block';
    }
};

window.gantiVideo = (url) => { document.getElementById('videoPlayer').src = url; document.getElementById('videoPlayer').play(); window.tambahXp(); };

// --- FUNGSI FAVORIT & NAVIGASI ---
window.tambahFavorit = (judul, posterUrl, deskripsi, epsLinksStr, genre) => {
    let favs = JSON.parse(localStorage.getItem('favoritMiko') || '[]');
    if (!favs.find(a => a.judul === judul)) {
        favs.push({ judul, posterUrl, deskripsi, epsLinksStr, genre });
        localStorage.setItem('favoritMiko', JSON.stringify(favs));
        alert("Berhasil ditambah ke favorit!");
    } else { alert("Sudah ada di favorit!"); }
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
                <p>${data.judul}</p>
            </div>
        `;
    });
};

window.hapusFavorit = (judul) => {
    let favs = JSON.parse(localStorage.getItem('favoritMiko') || '[]');
    favs = favs.filter(a => a.judul !== judul);
    localStorage.setItem('favoritMiko', JSON.stringify(favs));
    window.muatFavorit();
};

window.pindah = (id) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    if(id === 'favorit') window.muatFavorit();
};

window.pilihHari = async (btn, hari) => {
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('jadwal-content');
    content.innerHTML = `<p>Memuat...</p>`;
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
                        <div class="item-info"><strong>${a.judul}</strong></div>
                    </div>`;
                }
            }
            content.innerHTML = html;
        } else { content.innerHTML = `<p>Belum ada jadwal.</p>`; }
    } catch (e) { console.error("Error Jadwal:", e); }
};

window.tutupVideo = () => { document.getElementById('videoPlayer').pause(); document.getElementById('videoModal').style.display = 'none'; };
    
