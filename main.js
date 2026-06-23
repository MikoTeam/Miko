import { db } from "./firebase-config.js";
import { collection, getDocs, doc, getDoc, query, orderBy, limit, addDoc, serverTimestamp, onSnapshot, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// Cache data lokal agar tidak boros kuota query Firestore
let listSemuaAnime = [];
let hariAktif = "Senin"; 
const auth = getAuth();

// Urutan nama hari untuk komponen kalender mingguan
const daftarNamaHari = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

// ==========================================
// 1. SISTEM NAVIGATION UTAMA (TABS)
// ==========================================
window.navigasiKe = function(idHalaman, elemenTombol) {
    document.querySelectorAll('.page').forEach(halaman => {
        halaman.style.display = 'none';
    });
    
    const halamanTujuan = document.getElementById(idHalaman);
    if (halamanTujuan) {
        halamanTujuan.style.display = 'block';
    }
    
    document.querySelectorAll('.nav-btn').forEach(tombol => {
        tombol.classList.remove('active');
    });
    
    if (elemenTombol) {
        elemenTombol.classList.add('active');
    }

    if (idHalaman === 'home') {
        window.muatAnime();
        window.muatLeaderboard();
    } else if (idHalaman === 'jadwal') {
        window.generateKalenderMingguan();
        window.muatJadwalAnime();
    } else if (idHalaman === 'profil') {
        window.muatProfil();
    } else if (idHalaman === 'page-favorit') {
        window.renderHalamanFavorit();
    }
};

// ==========================================
// 2. FUNGSI PROFIL (UPDATE XP DINAMIS)
// ==========================================
window.muatProfil = async function() {
    const user = auth.currentUser;
    const xpDisplay = document.getElementById("xpDisplay");
    if (user && xpDisplay) {
        try {
            const userSnap = await getDoc(doc(db, "users", user.uid));
            if (userSnap.exists()) {
                const data = userSnap.data();
                xpDisplay.innerText = `XP Anda: ${(data.xp || 0).toLocaleString()} XP`;
            }
        } catch (e) {
            console.error("Gagal memuat profil:", e);
        }
    }
};

// ==========================================
// 3. LOGIKA KALENDER TANGGAL DINAMIS
// ==========================================
window.generateKalenderMingguan = function() {
    const tabsContainer = document.getElementById("dayTabsContainer");
    if (!tabsContainer) return;
    const sekarang = new Date();
    const hariSekarang = sekarang.getDay();
    const selisihKeSenin = hariSekarang === 0 ? -6 : 1 - hariSekarang;
    let tanggalSenin = new Date(sekarang);
    tanggalSenin.setDate(sekarang.getDate() + selisihKeSenin);
    let htmlTabs = "";
    for (let i = 0; i < 7; i++) {
        let tanggalHariIni = new Date(tanggalSenin);
        tanggalHariIni.setDate(tanggalSenin.getDate() + i);
        const namaHari = daftarNamaHari[i];
        const angkaTanggal = tanggalHariIni.getDate(); 
        const singkatanHari = namaHari === "Minggu" ? "Mingg" : namaHari.substring(0, 3);
        const statusActiveBubble = (namaHari === hariAktif) ? "active" : "";
        htmlTabs += `
            <div class="day-tab-item" onclick="gantiHari('${namaHari}', this)">
                <span class="day-bubble ${statusActiveBubble}">${singkatanHari}</span>
                <span class="day-sub">${angkaTanggal}</span>
            </div>
        `;
    }
    tabsContainer.innerHTML = htmlTabs;
};

window.gantiHari = function(namaHari, elemen) {
    hariAktif = namaHari;
    document.querySelectorAll('.day-bubble').forEach(bubble => bubble.classList.remove('active'));
    elemen.querySelector('.day-bubble').classList.add('active');
    window.muatJadwalAnime();
};

// ==========================================
// 4. AMBIL DATA JADWAL TAYANG
// ==========================================
window.muatJadwalAnime = async function() {
    const containerJadwal = document.getElementById("jadwal-anime-list");
    if (!containerJadwal) return;
    containerJadwal.innerHTML = `<p style="text-align: center; color: #f39c12; margin-top: 30px; font-size:14px;">Memuat jadwal database...</p>`;
    try {
        if (listSemuaAnime.length === 0) {
            const animeSnapshot = await getDocs(collection(db, "anime"));
            listSemuaAnime = [];
            animeSnapshot.forEach((doc) => {
                listSemuaAnime.push({ id: doc.id, idDokumen: doc.id, ...doc.data() });
            });
        }
        const namaHariKecil = hariAktif.toLowerCase().trim();
        const docRefJadwal = doc(db, "jadwal", namaHariKecil);
        const docSnapJadwal = await getDoc(docRefJadwal);
        if (!docSnapJadwal.exists()) {
            containerJadwal.innerHTML = `<p style="text-align: center; color: #777; margin-top: 30px; font-size:14px;">Tidak ada jadwal tayang hari ${hariAktif}.</p>`;
            return;
        }
        const dataJadwal = docSnapJadwal.data();
        let listNamaJadwalHariIni = [];
        Object.values(dataJadwal).forEach(val => {
            if (Array.isArray(val)) listNamaJadwalHariIni = listNamaJadwalHariIni.concat(val);
            else if (typeof val === 'string') listNamaJadwalHariIni.push(val);
        });
        const listNamaNormal = listNamaJadwalHariIni.map(nama => String(nama).toLowerCase().trim());
        const animeSesuaiJadwal = listSemuaAnime.filter(anime => {
            const judulUtama = anime.judul ? String(anime.judul).toLowerCase().trim() : "";
            const idDokumenSatu = anime.id ? String(anime.id).toLowerCase().trim() : "";
            return listNamaNormal.includes(judulUtama) || listNamaNormal.includes(idDokumenSatu);
        });
        containerJadwal.innerHTML = animeSesuaiJadwal.map(data => {
            let totalEps = data.epsLinks && typeof data.epsLinks === 'object' ? Object.keys(data.epsLinks).length : 0;
            if (!totalEps && data.totalEpisode) totalEps = data.totalEpisode;
            const judul = data.judul || "Untitled Anime";
            const poster = data.posterUrl || "https://via.placeholder.com/150";
            
            const dataEncode = btoa(unescape(encodeURIComponent(JSON.stringify({
                judul: judul,
                deskripsi: data.deskripsi || '',
                epsLinks: data.epsLinks || {},
                genre: data.genre || 'Anime',
                poster: poster,
                idDokumen: data.idDokumen
            }))));

            return `
                <div class="schedule-card" onclick="window.bukaVideoEncoded('${dataEncode}')">
                    <div class="schedule-poster" style="background-image: url('${poster}');"></div>
                    <div class="schedule-details">
                        <h4>${judul}</h4>
                        <div class="sched-eps">${totalEps} Eps</div>
                        <div class="sched-views">👁️ ${data.views || 0} View</div>
                        <div class="sched-time-status">${data.jamTayang || '00:00 WIB'} (${data.statusTayang || 'Belum Tayang'})</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Gagal memuat jadwal:", e);
    }
};

// ==========================================
// 5. LEADERBOARD & ANIME GRID
// ==========================================
window.muatLeaderboard = async function() {
    const listLeaderboard = document.getElementById("leaderboard-list");
    if (!listLeaderboard) return;
    try {
        const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(3));
        const querySnapshot = await getDocs(q);
        let urutan = 1;
        let htmlContent = "";
        querySnapshot.forEach((doc) => {
            const dataUser = doc.data();
            const namaTampil = dataUser.nama || dataUser.username || "User";
            const xpTampil = dataUser.xp !== undefined ? dataUser.xp : 0;
            htmlContent += `<div class="rank-item"><span class="rank-num">${urutan}</span><span class="user-name">${namaTampil}</span><span class="user-xp">${xpTampil.toLocaleString()} XP</span></div>`;
            urutan++;
        });
        listLeaderboard.innerHTML = htmlContent;
    } catch (e) { console.error("Gagal memuat leaderboard:", e); }
};

window.muatAnime = async function() {
    const grid = document.querySelector(".anime-grid");
    if (!grid) return;
    try {
        const querySnapshot = await getDocs(collection(db, "anime"));
        listSemuaAnime = [];
        querySnapshot.forEach((doc) => {
            listSemuaAnime.push({ id: doc.id, idDokumen: doc.id, ...doc.data() });
        });
        window.renderGridAnime(listSemuaAnime);
    } catch (e) { console.error("Gagal memuat anime:", e); }
};

window.renderGridAnime = function(dataAnime) {
    const grid = document.querySelector(".anime-grid");
    if (!grid) return;
    grid.innerHTML = dataAnime.map(data => {
        let totalEps = data.epsLinks && typeof data.epsLinks === 'object' ? Object.keys(data.epsLinks).length : 0;
        const judul = data.judul || "Untitled Anime";
        const poster = data.posterUrl || "https://via.placeholder.com/150";
        
        const dataEncode = btoa(unescape(encodeURIComponent(JSON.stringify({
            judul: judul,
            deskripsi: data.deskripsi || '',
            epsLinks: data.epsLinks || {},
            genre: data.genre || 'Anime',
            poster: poster,
            idDokumen: data.idDokumen
        }))));

        return `<div class="anime-item" onclick="window.bukaVideoEncoded('${dataEncode}')">
                <div class="poster" style="background-image: url('${poster}'); pointer-events: none;"><div class="overlay-info" style="pointer-events: none;"><span class="views" style="pointer-events: none;">👁️ ${data.views || 0}</span><span class="eps" style="pointer-events: none;">🎬 ${totalEps} Eps</span></div></div>
                <p class="anime-title" style="pointer-events: none;">${judul}</p></div>`;
    }).join('');
};

window.bukaVideoEncoded = function(encoded) {
    const data = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    window.bukaVideo(data.judul, data.deskripsi, encodeURIComponent(JSON.stringify(data.epsLinks)), data.genre, data.poster, data.idDokumen);
};

window.inisialisasiPencarian = function() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;
    searchInput.addEventListener("input", (e) => {
        const kataKunci = e.target.value.toLowerCase().trim();
        const hasilFilter = listSemuaAnime.filter(anime => 
            (anime.judul || "").toLowerCase().includes(kataKunci) || (anime.id || "").toLowerCase().includes(kataKunci)
        );
        window.renderGridAnime(hasilFilter);
    });
};

// ==========================================
// 6. VIDEO PLAYER, KOMENTAR, FAVORIT & MODAL
// ==========================================
window.toggleFavorit = async function(judul, posterUrl, animeId) {
    const user = auth.currentUser;
    if (!user) { alert("Login dulu untuk simpan favorit!"); return; }
    const userRef = doc(db, "users", user.uid);
    const dataFav = { animeId, judul, posterUrl };
    const userSnap = await getDoc(userRef);
    const favList = userSnap.exists() ? (userSnap.data().favorit || []) : [];
    const isFavorited = favList.find(a => a.animeId === animeId);
    if (isFavorited) {
        await updateDoc(userRef, { favorit: arrayRemove(isFavorited) });
        alert("Dihapus dari favorit");
    } else {
        await updateDoc(userRef, { favorit: arrayUnion(dataFav) });
        alert("Berhasil disimpan ke akun!");
    }
};

// PERBAIKAN: Fungsi ini sekarang akan menampilkan data dari Firestore
window.renderHalamanFavorit = async function() {
    const user = auth.currentUser;
    const container = document.getElementById("favorit-list");
    if (!container) return;
    
    if (!user) {
        container.innerHTML = `<p style="text-align:center; color:#777; margin-top:20px;">Silakan login untuk melihat favorit Anda.</p>`;
        return;
    }

    container.innerHTML = `<p style="text-align:center; color:#777; margin-top:20px;">Memuat favorit...</p>`;
    
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const fav = userSnap.exists() ? (userSnap.data().favorit || []) : [];
    
    if (fav.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#777; margin-top:20px;">Belum ada anime favorit.</p>`;
        return;
    }
    
    container.innerHTML = fav.map(data => `
        <div class="anime-item" onclick="window.location.href='index.html?id=${data.animeId}'">
            <div class="poster" style="background-image: url('${data.posterUrl}');"></div>
            <p class="anime-title">${data.judul}</p>
        </div>
    `).join('');
};

window.bukaVideo = (judul, deskripsi, epsLinksStr, genre, posterUrl, animeId) => {
    const modal = document.getElementById('videoModal');
    const info = document.getElementById('videoInfo');
    if (!modal || !info) return;
    const epsLinks = JSON.parse(decodeURIComponent(epsLinksStr));
    
    info.innerHTML = `
        <div id="mediaContainer" class="video-wrapper" style="margin:0 !important; padding:0 !important;">
            <div id="posterPreview" style="width:100%; aspect-ratio:16/9; background:url('${posterUrl}') center/cover;"></div>
        </div>
        <div style="padding: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="flex:1;">
                    <h2 class="modal-anime-title" style="margin:0;">${judul}</h2>
                    <div class="modal-anime-genre">${genre}</div>
                </div>
                <img src="https://cdn.phototourl.com/free/2026-06-22-f75bfb57-fc0f-4cd5-9aa1-fe612555a4e9.png" onclick="window.toggleFavorit('${judul}', '${posterUrl}', '${animeId}')" style="width:28px; cursor:pointer;" title="Simpan ke Favorit">
            </div>
            <hr class="modal-divider">
            <p class="modal-anime-desc">${deskripsi}</p>
            <hr class="modal-divider"><h3 class="modal-eps-title">Daftar Episode</h3>
            <div id="eps-list-container" style="display:flex; flex-wrap:wrap; gap:8px;">
                ${Object.keys(epsLinks).filter(k => epsLinks[k] && epsLinks[k].trim() !== "").map(k => `<button class="eps-btn" onclick="pilihEpisode('${epsLinks[k]}', '${animeId}')">${k}</button>`).join('') || '<p>Belum ada episode.</p>'}
            </div>
            
            <div id="comments-wrapper" style="display:none; margin-top:20px;">
                <div class="comments-section">
                    <div class="comments-count">Komentar</div>
                    <div class="comment-form">
                        <input type="text" id="inputKomentar" class="comment-input" placeholder="Tulis komentar...">
                        <button class="comment-submit-btn" onclick="window.kirimKomentar('${animeId}')">➤</button>
                    </div>
                    <div id="comments-list"></div>
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
};

window.pilihEpisode = (url, animeId) => {
    const mediaBox = document.getElementById('mediaContainer');
    const commWrapper = document.getElementById('comments-wrapper');
    if (!mediaBox) return;
    
    mediaBox.innerHTML = `<video id="playerVideo" src="${url}" controls autoplay playsinline style="width:100%; aspect-ratio:16/9; background:#000;"></video>`;
    
    if(commWrapper) {
        commWrapper.style.display = 'block';
        window.renderKomentar(animeId);
    }
};

window.kirimKomentar = async (animeId) => {
    const input = document.getElementById("inputKomentar");
    if (!input.value) return;
    const user = auth.currentUser;
    await addDoc(collection(db, "anime", animeId, "comments"), {
        username: user ? user.displayName : "Guest",
        text: input.value,
        createdAt: serverTimestamp()
    });
    input.value = "";
};

window.renderKomentar = (animeId) => {
    const q = query(collection(db, "anime", animeId, "comments"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById("comments-list");
        if(!list) return;
        list.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return `<div class="comment-item">
                        <div class="comment-user">${data.username}</div>
                        <div class="comment-text">${data.text}</div>
                    </div>`;
        }).join('');
    });
};

window.tutupVideo = () => { 
    const modal = document.getElementById('videoModal');
    if (modal) modal.style.display = 'none';
};

window.addEventListener('DOMContentLoaded', () => {
    window.muatAnime();
    window.muatLeaderboard();
    window.inisialisasiPencarian();
});
    
