import { db } from "./firebase-config.js";
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, limit, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
const storage = getStorage();

let hariAktif = "Senin";
let animeId = '';
let dataAnimeAktif = {};

// === VARIABEL FILTER ===
let genreAktif = 'Semua';
let kataKunciAktif = '';

const auth = getAuth();
const daftarNamaHari = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const googleProvider = new GoogleAuthProvider();

// ===== VARIABEL SETTINGS =====
const SETTINGS = {
  nama: localStorage.getItem('userName') || 'Belum Login',
  pp: localStorage.getItem('userPP') || '',
  autoplay: localStorage.getItem('autoplay') === 'true',
  skipIntro: localStorage.getItem('skipIntro') !== 'false',
  kualitas: localStorage.getItem('kualitas') || '1080p',
  bahasa: localStorage.getItem('bahasa') || 'Indonesia',
  notif: localStorage.getItem('notif') !== 'false',
  darkMode: localStorage.getItem('darkMode') !== 'false'
};

function formatViews(num) {
    num = num || 0;
    if(num >= 1000000) return (num/1000000).toFixed(1) + 'M';
    if(num >= 1000) return (num/1000).toFixed(1) + 'K';
    return num;
}

function formatTime(sec) {
    sec = Math.floor(sec);
    let m = Math.floor(sec / 60);
    let s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// FIX: Popup pake style.display biar cocok sama HTML lu
window.showPopup = function(pesan) {
  const popup = document.getElementById('popupNotifikasi');
  const text = document.getElementById('popupText');
  if(!popup || !text) return;
  text.innerHTML = pesan;
  popup.style.display = 'flex';
}

window.hidePopup = function() {
  const popup = document.getElementById('popupNotifikasi');
  if(popup) popup.style.display = 'none';
}

// POPUP PILIHAN - BUAT KUALITAS/BAHASA
window.showPopupPilihan = function(judul, opsiArray, selected, callback) {
  const popup = document.getElementById('popupPilihan');
  const text = document.getElementById('popupPilihanText');
  const list = document.getElementById('popupPilihanList');

  if (!popup) return alert('Error: popupPilihan HTML ga ketemu');

  text.innerText = judul;
  list.innerHTML = '';

  opsiArray.forEach(opsi => {
    const btn = document.createElement('button');
    btn.innerText = opsi + (opsi === selected ? ' ✓' : '');
    btn.style.cssText = 'padding:12px;border:none;border-radius:8px;background:#2a2a2a;color:#fff;font-size:15px;cursor:pointer;font-weight:500;margin-top:8px';
    if (opsi === selected) btn.style.background = '#e50914';

    btn.onclick = () => {
      callback(opsi);
      hidePopupPilihan();
    };
    list.appendChild(btn);
  });

  popup.style.display = 'flex'; // FIX: pake display bukan classList
}

window.hidePopupPilihan = function() {
  const popup = document.getElementById('popupPilihan');
  if(popup) popup.style.display = 'none';
}

// ===== NAVIGASI UTAMA =====
window.toggleMenu = function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  sidebar.classList.toggle('active');
  overlay.classList.toggle('active');
}

window.navigasiKe = async function(idHalaman, tutupSidebar = true) {
    document.querySelectorAll('.page').forEach(halaman => halaman.style.display = 'none');
    const halamanTujuan = document.getElementById(idHalaman);
    if (halamanTujuan) halamanTujuan.style.display = 'block';

    if (tutupSidebar && document.getElementById('sidebar').classList.contains('active')) {
        toggleMenu();
    }

    if (idHalaman === 'home') { window.muatAnime(); window.muatLeaderboard(); }
    else if (idHalaman === 'jadwal') { window.generateKalenderMingguan(); window.muatJadwalAnime(); }
    else if (idHalaman === 'profil') { window.muatProfil(); }
    else if (idHalaman === 'page-favorit') { window.renderHalamanFavorit(); }
    else if (idHalaman === 'urutan') { window.muatUrutanAZ(); }
    else if (idHalaman === 'pengaturan') { window.loadSettings(); }
};
// [FIX] FUNGSI RENDER PINTER PILIH GRID
function renderAnime(data) {
    const pageAktif = document.querySelector('.page[style*="block"]');
    let grid;

    if(pageAktif && pageAktif.id === 'genre') {
        grid = document.getElementById('genre-grid');
    } else if(pageAktif && pageAktif.id === 'urutan') {
        grid = document.getElementById('urutan-grid');
    } else if(pageAktif && pageAktif.id === 'page-favorit') {
        grid = document.getElementById('favorit-list');
    } else {
        grid = document.getElementById('home-grid');
    }

    if (!grid) return;

    if (data.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#666;padding:40px;">Anime kosong</p>`;
        return;
    }

    grid.innerHTML = '';
    data.forEach(anime => {
        grid.innerHTML += buatCard(anime);
    });
}

// ===== QUERY HOME LANGSUNG DARI DB =====
window.muatAnime = async function() {
  const grid = document.getElementById('home-grid');
  if (!grid) return;
  grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#666;padding:40px;">Loading...</p>';

  try {
    const q = query(collection(db, "anime"), orderBy("views", "desc"), limit(10));
    const snap = await getDocs(q);

    if (snap.empty) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#666;padding:40px;">Database kosong</p>';
      return;
    }

    grid.innerHTML = '';
    snap.forEach(doc => {
      let data = doc.data();
      data.idDokumen = doc.id;
      grid.innerHTML += buatCard(data);
    });

  } catch (err) {
    console.error('Error Firebase:', err);
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:red;padding:40px;">Error Firebase</p>';
  }
};

// FIX: onclick cuma lempar ID biar ga error kutip
function buatCard(data) {
  let poster = data.posterUrl || 'https://via.placeholder.com/300x400/222/666?text=No+Image';
  if(poster.includes('catbox.moe') || poster.includes('imgur.com') || poster.includes('postimg.cc')) {
    poster = `https://images.weserv.nl/?url=${encodeURIComponent(poster)}&w=300&h=400&fit=cover`;
  }

  let badgeBaru = '';
  if(data.isNew === true) {
    badgeBaru = '<div class="badge-baru">New</div>';
  }

  let totalEps = data.totalEpisode || '?';

  return `<div class="card" onclick="bukaDetail('${data.idDokumen}')">
    ${badgeBaru}
    <img src="${poster}" alt="${data.judul}" loading="lazy" referrerpolicy="no-referrer"
    onerror="this.src='https://via.placeholder.com/300x400/111/666?text=Gambar+Error'">

    <div class="card-rating">⭐ ${data.rating || 'N/A'}</div>

    <div class="card-info">
      <div class="card-meta">
        <span> ${formatViews(data.views || 0)} views</span>
        <span>• Eps ${totalEps}</span>
      </div>
      <div class="card-title">${data.judul}</div>
    </div>
  </div>`;
}

// === MUAT GENRE DARI KOLEKSI GENRE - TANPA INDEX ===
window.muatGenre = async function() {
    const list = document.getElementById('genreFilter');
    if (!list) return;

    try {
        const snap = await getDocs(collection(db, "genre"));
        let html = '<button class="genre-btn active" onclick="resetFilter()">Semua</button>';

        snap.forEach(doc => {
            let nama = doc.data().nama;
            if (nama) {
                let namaLower = nama.toLowerCase();
                html += `<button class="genre-btn" onclick="filterByGenre('${namaLower}', this)">${nama}</button>`;
            }
        });

        list.innerHTML = html;
        window.terapkanFilter();
    } catch(e) {
        console.error("Error muat genre:", e);
    }
}

window.pindahKeGenre = function(genre) {
    localStorage.setItem('genreTerpilih', genre);
    window.location.hash = '#genre';
    setTimeout(() => window.navigasiKe('genre'), 100);
}

window.filterByGenre = function(genre, btn) {
    genreAktif = genre;
    document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window.terapkanFilter();
}

window.resetFilter = function() {
    genreAktif = 'Semua';
    document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.genre-btn').classList.add('active');
    window.terapkanFilter();
}

// [FIX] FILTER TANPA INDEX - AMBIL SEMUA DULU BARU FILTER DI HP
window.terapkanFilter = async function() {
  const grid = document.getElementById('genre-grid');
  if (!grid) return;
  grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#666;padding:40px;">Loading...</p>';

  try {
    const snap = await getDocs(collection(db, "anime"));
    let hasil = [];

    snap.forEach(doc => {
      let data = doc.data();
      data.idDokumen = doc.id;

      if (genreAktif && genreAktif !== 'Semua') {
        let genres = data.genre || [];
        if (typeof genres === 'string') genres = genres.split(',');
        genres = genres.map(g => g.trim().toLowerCase());
        if (!genres.includes(genreAktif.toLowerCase())) return;
      }

      if (kataKunciAktif && !data.judul.toLowerCase().includes(kataKunciAktif.toLowerCase())) {
        return;
      }
      hasil.push(data);
    });

    hasil.sort((a,b) => (b.views || 0) - (a.views || 0));
    renderAnime(hasil.slice(0, 20));
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:red;padding:40px;">Error query</p>';
  }
}

// [QUERY DB] SEARCH LANGSUNG KE FIREBASE
function aktifinSearch() {
  const search = document.getElementById('searchInput');
  if (!search) return;
  search.addEventListener('input', async (e) => {
    kataKunciAktif = e.target.value;

    const grid = document.getElementById('home-grid');
    if (!grid) return;

    if (!kataKunciAktif.trim()) {
      window.muatAnime();
      return;
    }

    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#666;padding:40px;">Mencari...</p>';

    try {
      const snap = await getDocs(collection(db, "anime"));
      let hasil = [];
      snap.forEach(doc => {
        let data = doc.data();
        data.idDokumen = doc.id;
        if (data.judul.toLowerCase().includes(kataKunciAktif.toLowerCase())) {
          if (genreAktif && genreAktif !== 'Semua') {
            let genres = data.genre || [];
            if (typeof genres === 'string') genres = genres.split(',');
            genres = genres.map(g => g.trim().toLowerCase());
            if (!genres.includes(genreAktif.toLowerCase())) return;
          }
          hasil.push(data);
        }
      });

      renderAnime(hasil);
    } catch (err) {
      console.error(err);
    }
  });
}

// FIX: bukaDetail ambil data dari Firebase pake ID
window.bukaDetail = async function(id) {
  animeId = id;
  const docRef = doc(db, "anime", id);
  const docSnap = await getDoc(docRef);

  if(!docSnap.exists()) {
    showPopup('Anime ga ketemu');
    return;
  }

  const data = docSnap.data();
  dataAnimeAktif = data;
  dataAnimeAktif.idDokumen = id;

  const modal = document.getElementById('modalDetail');

  document.getElementById('detail-banner-img').src = data.posterUrl || '';
  document.getElementById('detail-judul').innerText = data.judul || 'No Title';
  document.getElementById('detail-judul-eng').innerText = data.judulEng || '';
  document.getElementById('detail-rating').innerText = data.rating || 'N/A';
  document.getElementById('detail-studio').innerText = data.studio || 'Studio';
  document.getElementById('detail-tanggal').innerText = data.tanggalRilis || '2026';
  document.getElementById('detail-tipe').innerText = data.tipe || 'TV';
  document.getElementById('detail-views').innerText = formatViews(data.views || 0);
  document.getElementById('detail-deskripsi').innerText = data.deskripsi || 'Belum ada sinopsis.';
  document.getElementById('detail-follow').innerText = formatViews(data.followers || 0);
  document.getElementById('detail-jadwal').innerText = 'Jadwal Rilis ' + (data.jadwalRilis || '');

  // FIX: Cek dulu ada ga elementnya, biar ga error
  const genreBox = document.getElementById('detail-genres');
  if(genreBox) {
    genreBox.innerHTML = '';
    if(Array.isArray(data.genre)) {
      data.genre.forEach(g => {
        genreBox.innerHTML += `<span class="genre-pill" onclick="pindahKeGenre('${g.trim()}')">${g.trim()}</span>`;
      });
    } else if(typeof data.genre === 'string') {
      data.genre.split(',').forEach(g => {
        genreBox.innerHTML += `<span class="genre-pill" onclick="pindahKeGenre('${g.trim()}')">${g.trim()}</span>`;
      });
    }
  }

  const listEps = document.getElementById('list-eps');
  listEps.innerHTML = '';
  if(data.epsLinks && typeof data.epsLinks === 'object') {
    Object.keys(data.epsLinks).sort((a,b) => a-b).forEach(eps => {
      listEps.innerHTML += `<button class="eps-btn" onclick="event.stopPropagation(); bukaPlayer('${data.epsLinks[eps]}', ${eps}, '${data.judul.replace(/'/g, "\\'")}')">Eps ${eps}</button>`;
    });
  } else {
    listEps.innerHTML = '<p style="color:#666;">Belum ada episode</p>';
  }

  if(data.epsLinks && Object.keys(data.epsLinks).length > 0) {
    const epsTerbaru = Math.max(...Object.keys(data.epsLinks).map(Number));
    document.querySelector('.btn-tonton').onclick = (e) => {
      e.stopPropagation();
      bukaPlayer(data.epsLinks[epsTerbaru], epsTerbaru, data.judul);
    };
  } else {
    document.querySelector('.btn-tonton').onclick = (e) => {
      e.stopPropagation();
      showPopup('Admin Lagi Malas Up');
    };
  }

  updateTombolFollow();
  modal.classList.add('active');
}

window.tutupDetail = function(e) {
  if(!e || e.target.classList.contains('modal') || e.target.classList.contains('back-btn')) {
    document.getElementById('modalDetail').classList.remove('active');
  }
}

// === FUNGSI FAVORIT ===
function getFavorit() {
  return JSON.parse(localStorage.getItem('favoritAnime') || '[]');
}

function simpanFavorit(arr) {
  localStorage.setItem('favoritAnime', JSON.stringify(arr));
}

window.toggleFollow = function() {
  if(!dataAnimeAktif.idDokumen) return;

  let fav = getFavorit();
  const idx = fav.findIndex(f => f.id === dataAnimeAktif.idDokumen);

  if(idx === -1) {
    fav.push({id: dataAnimeAktif.idDokumen, judul: dataAnimeAktif.judul, poster: dataAnimeAktif.posterUrl});
    dataAnimeAktif.followers = (dataAnimeAktif.followers || 0) + 1;
  } else {
    fav.splice(idx, 1);
    dataAnimeAktif.followers = Math.max(0, (dataAnimeAktif.followers || 1) - 1);
  }

  simpanFavorit(fav);
  document.getElementById('detail-follow').innerText = formatViews(dataAnimeAktif.followers);
  updateTombolFollow();
}

function updateTombolFollow() {
  const btn = document.querySelector('.btn-follow');
  if(!btn || !dataAnimeAktif.idDokumen) return;

  const fav = getFavorit();
  const ada = fav.find(f => f.id === dataAnimeAktif.idDokumen);

  if(ada) {
    btn.classList.add('active');
    btn.innerHTML = '✓ Mengikuti';
  } else {
    btn.classList.remove('active');
    btn.innerHTML = 'Ikuti';
  }
}

// ===== SETTINGS FUNCTIONS =====
window.loadSettings = function() {
  const elNama = document.getElementById('namaSekarang');
  if(!elNama) return;

  elNama.textContent = SETTINGS.nama;
  document.getElementById('kualitasText').textContent = SETTINGS.kualitas;
  document.getElementById('bahasaText').textContent = SETTINGS.bahasa;
  document.getElementById('toggleAutoPlay').checked = SETTINGS.autoplay;
  document.getElementById('toggleSkipIntro').checked = SETTINGS.skipIntro;
  document.getElementById('toggleNotif').checked = SETTINGS.notif;
  document.getElementById('toggleDark').checked = SETTINGS.darkMode;

  if(SETTINGS.pp) {
    document.getElementById('userAvatar').src = SETTINGS.pp;
  }
  document.getElementById('cacheSize').textContent = '12.5 MB';
}

window.gantiNama = async function() {
  const namaBaru = prompt('Masukkan nama baru:', SETTINGS.nama);
  if(namaBaru === null) return;
  if(namaBaru.trim() === '') return showPopup('Nama tidak boleh kosong');
  if(namaBaru.length > 20) return showPopup('Maksimal 20 karakter');

  const user = auth.currentUser;
  if(!user) return showPopup('Login Dulu Mbut');

  SETTINGS.nama = namaBaru.trim();
  localStorage.setItem('userName', SETTINGS.nama);

  try {
    // 1. Update Firebase Auth displayName
    await updateProfile(user, { displayName: SETTINGS.nama });

    // 2. Update Firestore database users/{uid}
    await setDoc(doc(db, "users", user.uid), {
      nama: SETTINGS.nama
    }, { merge: true });

    // 3. Update UI
    document.getElementById('userName').textContent = SETTINGS.nama;
    document.getElementById('userNameInfo').textContent = SETTINGS.nama;
    document.getElementById('namaSekarang').textContent = SETTINGS.nama;

    showPopup('Nama berhasil diganti jadi ' + SETTINGS.nama);
  } catch(err) {
    console.error(err);
    showPopup('Gagal ganti nama: ' + err.message);
  }
}

window.gantiPP = function() {
  document.getElementById('inputPP').click();
}

window.uploadPP = async function(e) {
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > 2 * 1024 * 1024) return showPopup('Foto maks 2MB wok');

  const user = auth.currentUser;
  if(!user) return showPopup('Login dulu wok');

  showPopup('Mengupload foto...');

  try {
    // 1. Upload ke Firebase Storage
    const storageRef = ref(storage, 'profilePics/' + user.uid + '.jpg');
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    // 2. Update Firebase Auth photoURL
    await updateProfile(user, { photoURL: url });

    // 3. Update Firestore database users/{uid}
    await setDoc(doc(db, "users", user.uid), {
      photoURL: url
    }, { merge: true });

    // 4. Update UI + localStorage
    document.getElementById('userAvatar').src = url;
    SETTINGS.photo = url;
    localStorage.setItem('userPhoto', url);

    hidePopup();
    showPopup('Foto profil berhasil diganti!');
  } catch(err) {
    console.error(err);
    hidePopup();
    showPopup('Gagal upload: ' + err.message);
  }
}

window.pilihKualitas = function() {
  const opsi = ['360p', '480p', '720p', '1080p', '2k', '3k', '4k'];

  showPopupPilihan('Pilih Kualitas', opsi, SETTINGS.kualitas || '1080p', (pilih) => {
    SETTINGS.kualitas = pilih;
    localStorage.setItem('kualitas', pilih);
    document.getElementById('kualitasText').textContent = pilih;
    showPopup('Kualitas diset ke ' + pilih);
  });
}

window.pilihBahasa = function() {
  const opsi = ['Indonesia', 'English', '日本語', '中国', 'Jawa', 'Sunda'];

  showPopupPilihan('Pilih Bahasa Sistem', opsi, SETTINGS.bahasa || 'Indonesia', (pilih) => {
    SETTINGS.bahasa = pilih;
    localStorage.setItem('bahasa', pilih);
    document.getElementById('bahasaText').textContent = pilih;
    showPopup('Bahasa Sistem Telah Diubah Ke ' + pilih);
  });
}

window.unduhanOffline = function() {
  showPopup('Fitur unduhan offline sedang dikembangkan');
}

window.hapusCache = function() {
  const opsi = ['Batal', 'Hapus'];

  showPopupPilihan('Hapus Cache', opsi, 'Batal', (pilih) => {
    if(pilih === 'Hapus') {
      localStorage.clear();

      SETTINGS.kualitas = '1080p';
      SETTINGS.bahasa = 'Indonesia';

      document.getElementById('kualitasText').textContent = '1080p';
      document.getElementById('bahasaText').textContent = 'Indonesia';

      const cacheEl = document.getElementById('cacheSize');
      if(cacheEl) cacheEl.textContent = '0 MB';

      showPopup('Cache berhasil dihapus!<br>Silakan refresh aplikasi');
    }
  });
}

window.tentangAplikasi = function() {
  showPopup('AnimeKu v1.0.0\nAplikasi Streaming Anime<br>Sedang Tahap Pengembangan');
}

window.bantuanSupport = function() {
  showPopup('Butuh bantuan?<br><br>📧 Email: MikoTeam.id@gmail.com<br>📱 Telegram: @MikoSenpaiii');
}

let autoNext = false;

window.bukaPlayer = function(playerUrl, epsNo, judul) {
  if(!playerUrl || playerUrl === 'undefined' || playerUrl === '') {
    showPopup('Link player Eps ' + epsNo + ' belum ada');
    return;
  }

  tutupDetail();
  dataAnimeAktif.epsSekarang = epsNo;
  const semuaEps = Object.keys(dataAnimeAktif.epsLinks || {}).map(Number).sort((a,b) => a-b);
  const epsPrev = semuaEps[semuaEps.indexOf(epsNo) - 1];
  const epsNext = semuaEps[semuaEps.indexOf(epsNo) + 1];

  const epsData = dataAnimeAktif.epsLinks[epsNo] || {};
  let qualityList = [];
  if(epsData['360p']) qualityList.push('360p');
  if(epsData['480p']) qualityList.push('480p');
  if(epsData['720p']) qualityList.push('720p');
  if(epsData['1080p']) qualityList.push('1080p');
  if(qualityList.length === 0) qualityList = ['360p'];
  let qualitySekarang = qualityList[0];

  let playerContainer = document.getElementById('playerContainer');
  if(!playerContainer) {
    playerContainer = document.createElement('div');
    playerContainer.id = 'playerContainer';
    playerContainer.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;z-index:9999;overflow-y:auto;';
    document.body.appendChild(playerContainer);
  }

  let epsButtons = '';
  semuaEps.forEach(e => {
    epsButtons += `<button onclick="gantiEps(${e})" style="padding:13px;background:${e==epsNo?'#e50914':'#181818'};color:#fff;border:none;border-radius:7px;font-weight:500;font-size:14px">${e}</button>`;
  });

  playerContainer.innerHTML = `
    <div style="width:100%;min-height:100vh;background:#000">
      <div style="padding:12px 16px;background:#0a0a0a;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10">
        <button onclick="tutupPlayer()" style="background:none;border:none;color:#fff;font-size:22px;padding:0">←</button>
        <h3 style="color:#fff;margin:0;font-size:15px;font-weight:600;text-align:center;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${judul} - Episode ${epsNo}</h3>
        <button onclick="videoFullscreen()" style="background:none;border:none;color:#fff;font-size:19px;padding:0">⛶</button>
      </div>

      <div style="width:100%;background:#000;position:relative" id="videoWrapper">
        <video id="videoPlayer" src="${epsData[qualitySekarang] || playerUrl}" autoplay playsinline style="width:100%;aspect-ratio:16/9;background:#000;display:block"></video>

        <div id="customControls" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none;opacity:1;transition:opacity 0.3s">

          <div style="height:80px;background:linear-gradient(180deg,rgba(0,0,0,0.7) 0%,transparent 100%);pointer-events:none"></div>

          <div style="flex:1;display:flex;align-items:center;justify-content:center;pointer-events:auto">
            <div style="display:flex;align-items:center;gap:32px">

              ${epsPrev? `<div onclick="gantiEps(${epsPrev})" style="text-align:center;color:#fff;cursor:pointer">
                <div style="display:flex;align-items:center;gap:3px;justify-content:center;margin:0 auto 3px">
                  <div style="width:3.5px;height:23px;background:#fff;border-radius:2px"></div>
                  <div style="width:0;height:0;border-right:18px solid #fff;border-top:11px solid transparent;border-bottom:11px solid transparent"></div>
                </div>
                <div style="font-size:12px;font-weight:500">Prev</div>
              </div>` : '<div style="width:48px"></div>'}

              <div onclick="skipVideo(-10)" style="text-align:center;color:#fff;cursor:pointer">
                <svg width="28" height="28" viewBox="0 0 24 24" style="margin:0 auto 3px;display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4))">
                  <path d="M12 5V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M8 5l2-2v4" fill="#fff"/>
                </svg>
                <div style="font-size:12px;font-weight:500">10</div>
              </div>

              <div onclick="togglePlay()" id="btnPlay" style="background:#fff;width:76px;height:76px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 28px rgba(0,0,0,0.6)">
                <div id="playIconBox" style="display:flex;gap:5px">
                  <div style="width:5px;height:24px;background:#000;border-radius:2px"></div>
                  <div style="width:5px;height:24px;background:#000;border-radius:2px"></div>
                </div>
              </div>

              <div onclick="skipVideo(10)" style="text-align:center;color:#fff;cursor:pointer">
                <svg width="28" height="28" viewBox="0 0 24 24" style="margin:0 auto 3px;display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4))">
                  <path d="M12 5V1l4 4-4 4V6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M16 5l-2-2v4" fill="#fff"/>
                </svg>
                <div style="font-size:12px;font-weight:500">10</div>
              </div>

              ${epsNext? `<div onclick="gantiEps(${epsNext})" style="text-align:center;color:#fff;cursor:pointer">
                <div style="display:flex;align-items:center;gap:3px;justify-content:center;margin:0 auto 3px">
                  <div style="width:0;height:0;border-left:18px solid #fff;border-top:11px solid transparent;border-bottom:11px solid transparent"></div>
                  <div style="width:3.5px;height:23px;background:#fff;border-radius:2px"></div>
                </div>
                <div style="font-size:12px;font-weight:500">Next</div>
              </div>` : '<div style="width:48px"></div>'}
            </div>
          </div>

          <div style="padding:10px 16px;background:linear-gradient(0deg,rgba(0,0,0,0.8) 0%,transparent 100%);pointer-events:auto">
            <input type="range" id="progressBar" min="0" max="100" value="0" style="width:100%;height:3px;background:#3a3a3a;outline:none;cursor:pointer;margin-bottom:6px;-webkit-appearance:none;border-radius:2px">
            <style>
              #progressBar::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#e50914;cursor:pointer;margin-top:-4.5px;border:2px solid #000}
              #progressBar::-webkit-slider-runnable-track{height:3px;background:linear-gradient(to right,#e50914 0%,#e50914 var(--val),#3a3a3a var(--val),#3a3a3a 100%);border-radius:2px}
            </style>

            <div style="display:flex;justify-content:space-between;align-items:center;color:#e0e0e0;font-size:11px;font-weight:500">
              <span id="timeNow">00:00 / 00:00</span>
              <div style="display:flex;gap:14px;align-items:center">
                <div onclick="toggleAutoNext()" id="btnAuto" style="display:flex;align-items:center;gap:4px;cursor:pointer">
                  <div style="width:0;height:0;border-left:6px solid #e0e0e0;border-top:4px solid transparent;border-bottom:4px solid transparent"></div>
                  <span>Autonext</span>
                </div>
                <div onclick="bukaPopupSpeed()" id="btnSpeed" style="background:#2a2a2a;padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;border:1px solid #444;font-weight:600;min-width:28px;text-align:center">1x</div>
                <div onclick="videoFullscreen()" style="cursor:pointer;font-size:17px">⛶</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="padding:18px 16px">
        <h2 style="color:#fff;margin:0 0 3px 0;font-size:21px;font-weight:700">${judul}</h2>
        <p style="color:#a0a0a0;margin:0 0 14px 0;font-size:12px">Episode ${epsNo} • 2.1M views • Studio</p>
        <p style="color:#b0b0b0;line-height:1.6;font-size:13.5px;margin-bottom:24px">${dataAnimeAktif.deskripsi || 'Belum ada sinopsis.'}</p>
        <h3 style="color:#fff;margin:0 0 10px 0;font-size:16px;font-weight:700">Episode List</h3>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:7px;padding-bottom:30px">${epsButtons}</div>
      </div>
    </div>
  `;
  playerContainer.style.display = 'block';

  let hideTimer;
  function showControls() {
    const ctr = document.getElementById('customControls');
    ctr.style.opacity = '1';
    clearTimeout(hideTimer);
    if(!video.paused) hideTimer = setTimeout(() => ctr.style.opacity = '0', 3000);
  }

  const video = document.getElementById('videoPlayer');
  const progressBar = document.getElementById('progressBar');
  const wrapper = document.getElementById('videoWrapper');
  const playIconBox = document.getElementById('playIconBox');
  const timeNow = document.getElementById('timeNow');

  wrapper.onclick = (e) => {
    if(e.target.id === 'progressBar') return;
    showControls();
  };

  video.addEventListener('loadedmetadata', () => {
    timeNow.innerText = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
    progressBar.max = video.duration;
  });

  video.addEventListener('timeupdate', () => {
    timeNow.innerText = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
    progressBar.value = video.currentTime;
    progressBar.style.setProperty('--val', (video.currentTime / video.duration) * 100 + '%');
  });

  progressBar.oninput = () => {
    video.currentTime = progressBar.value;
  };

  video.addEventListener('play', () => {
    playIconBox.innerHTML = '<div style="display:flex;gap:5px"><div style="width:5px;height:24px;background:#000;border-radius:2px"></div><div style="width:5px;height:24px;background:#000;border-radius:2px"></div></div>';
    showControls();
  });

  video.addEventListener('pause', () => {
    playIconBox.innerHTML = '<div style="width:0;height:0;border-left:16px solid #000;border-top:12px solid transparent;border-bottom:12px solid transparent;margin-left:2px"></div>';
    document.getElementById('customControls').style.opacity = '1';
  });

  video.addEventListener('ended', () => {
    if(autoNext && epsNext) gantiEps(epsNext);
  });
}

window.skipVideo = function(detik) {
  const video = document.getElementById('videoPlayer');
  if(video) video.currentTime += detik;
}

window.togglePlay = function() {
  const video = document.getElementById('videoPlayer');
  if(video.paused) video.play();
  else video.pause();
}

window.bukaPopupSpeed = function() {
  const video = document.getElementById('videoPlayer');
  const speedAktif = video.playbackRate;
  const speeds = [0.1, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 10];

  const list = speeds.map(s => {
    const aktif = s === speedAktif;
    return `<div onclick="setSpeed(${s})" style="padding:12px;text-align:center;border-radius:6px;background:${aktif?'#e50914':'#2a2a2a'};color:#fff;font-size:14px;cursor:pointer;font-weight:500">${s}x</div>`;
  }).join('');

  document.getElementById('popupPilihanText').innerText = 'Kecepatan Putar';
  document.getElementById('popupPilihanList').innerHTML = list;
  document.getElementById('popupPilihan').style.display = 'flex';
}

window.setSpeed = function(speed) {
  const video = document.getElementById('videoPlayer');
  video.playbackRate = speed;
  const btn = document.getElementById('btnSpeed');
  btn.innerText = speed + 'x';
  btn.style.color = speed >= 3? '#e50914' : '#e0e0e0';
  btn.style.borderColor = speed >= 3? '#e50914' : '#444';
  hidePopupPilihan();
}

window.toggleAutoNext = function() {
  autoNext =!autoNext;
  const btn = document.getElementById('btnAuto');
  btn.querySelector('div').style.borderLeftColor = autoNext? '#e50914' : '#e0e0e0';
  btn.querySelector('span').style.color = autoNext? '#e50914' : '#e0e0e0';
}

window.gantiEps = function(epsNo) {
  const url = dataAnimeAktif.epsLinks[epsNo];
  bukaPlayer(url, epsNo, dataAnimeAktif.judul);
}

window.videoFullscreen = function() {
  const video = document.getElementById('videoPlayer');
  if(video.requestFullscreen) video.requestFullscreen();
  else if(video.webkitRequestFullscreen) video.webkitRequestFullscreen();
}

window.tutupPlayer = function() {
  const playerContainer = document.getElementById('playerContainer');
  if(playerContainer) {
    const video = document.getElementById('videoPlayer');
    if(video) video.pause();
    playerContainer.style.display = 'none';
    playerContainer.innerHTML = '';
  }
}

// ===== CARD JADWAL QUERY DB =====
window.muatJadwalAnime = async function() {
    const containerJadwal = document.getElementById("jadwal-anime-list");
    if (!containerJadwal) return;
    containerJadwal.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">Loading...</p>';

    try {
        const namaHariKecil = hariAktif.toLowerCase().trim();
        const docRefJadwal = doc(db, "jadwal", namaHariKecil);
        const docSnapJadwal = await getDoc(docRefJadwal);

        if (!docSnapJadwal.exists()) {
            containerJadwal.innerHTML = `<p style="text-align:center;color:#777;margin-top:30px;">Belum ada jadwal Anime hari ${hariAktif}.</p>`;
            return;
        }

        const dataJadwal = docSnapJadwal.data();
        let listNamaJadwalHariIni = [];
        Object.values(dataJadwal).forEach(val => {
            if (Array.isArray(val)) listNamaJadwalHariIni = listNamaJadwalHariIni.concat(val);
            else if (typeof val === 'string') listNamaJadwalHariIni.push(val);
        });

        const listNamaNormal = listNamaJadwalHariIni.map(nama => String(nama).toLowerCase().trim());
        const animeSnapshot = await getDocs(collection(db, "anime"));

        const animeSesuaiJadwal = [];
        animeSnapshot.forEach(doc => {
            let data = doc.data();
            data.idDokumen = doc.id;
            const judulUtama = data.judul? String(data.judul).toLowerCase().trim() : "";
            const idDokumenSatu = data.idDokumen? String(data.idDokumen).toLowerCase().trim() : "";
            if(listNamaNormal.includes(judulUtama) || listNamaNormal.includes(idDokumenSatu)) {
                animeSesuaiJadwal.push(data);
            }
        });

        if(animeSesuaiJadwal.length === 0) {
            containerJadwal.innerHTML = `<p style="text-align:center;color:#777;margin-top:30px;">Belum ada jadwal anime hari ${hariAktif}.</p>`;
            return;
        }

        containerJadwal.innerHTML = animeSesuaiJadwal.map(data => {
            let totalEps = data.totalEpisode || '?';
            const judul = data.judul || "Untitled Anime";
            let poster = data.posterUrl || "https://via.placeholder.com/150";
            if(poster.includes('catbox.moe') || poster.includes('imgur.com')) {
              poster = `https://images.weserv.nl/?url=${encodeURIComponent(poster)}&w=150&h=200&fit=cover`;
            }
            const jadwal = data.jadwalUpdate;
            const jamTxt = jadwal && jadwal.jam? jadwal.jam + ' WIB' : '-';
            const statusTxt = jadwal && jadwal.hari && jadwal.hari!== 'Sudah Tayang'? 'Belum Tayang' : 'Sudah Tayang';
            const warnaTxt = statusTxt === 'Belum Tayang'? '#ff9800' : '#4caf50';

            return `
                <div class="schedule-card" onclick="bukaDetail('${data.idDokumen}')"
                style="display:flex;gap:12px;padding:12px;background:#0f0f0f;border-radius:10px;border:1px solid #222;margin-bottom:12px;cursor:pointer">
                    <div class="schedule-poster" style="width:80px;height:110px;background-image:url('${poster}');background-size:cover;background-position:center;border-radius:6px;flex-shrink:0"></div>
                    <div class="schedule-details" style="flex:1;display:flex;flex-direction:column;gap:5px;font-size:13px;color:#ddd">
                        <h4 style="margin:0;font-size:15px;color:#fff;font-weight:700;line-height:1.3">${judul}</h4>
                        <div class="sched-eps" style="color:#4fc3f7;font-weight:600">${totalEps} Eps</div>
                        <div class="sched-views" style="color:#aaa">Views ${formatViews(data.views || 0)}</div>
                       <div class="sched-time-status" style="font-weight:600">Jam ${jamTxt} <span style="color:${warnaTxt}">(${statusTxt})</span></div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Gagal muat jadwal:", e);
        containerJadwal.innerHTML = `<p style="text-align:center;color:red;margin-top:30px;">Error load jadwal</p>`;
    }
};

window.generateKalenderMingguan = function() {
    const tabsContainer = document.getElementById("dayTabsContainer");
    if (!tabsContainer) return;
    const sekarang = new Date();
    const hariSekarang = sekarang.getDay();
    const selisihKeSenin = hariSekarang === 0? -6 : 1 - hariSekarang;
    let tanggalSenin = new Date(sekarang);
    tanggalSenin.setDate(sekarang.getDate() + selisihKeSenin);
    let htmlTabs = "";
    for (let i = 0; i < 7; i++) {
        let tanggalHariIni = new Date(tanggalSenin);
        tanggalHariIni.setDate(tanggalSenin.getDate() + i);
        const namaHari = daftarNamaHari[i];
        const angkaTanggal = tanggalHariIni.getDate();
        const singkatanHari = namaHari === "Minggu"? "Mingg" : namaHari.substring(0, 3);
        const statusActiveBubble = (namaHari === hariAktif)? "active" : "";
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

let loginTabAktif = 'google';

window.showPopupLogin = function() {
  document.getElementById('popupLogin').style.display = 'flex';
  switchTab('google');
}

window.hidePopupLogin = function() {
  document.getElementById('popupLogin').style.display = 'none';
  document.getElementById('inputEmail').value = '';
  document.getElementById('inputPass').value = '';
}

window.switchTab = function(tab) {
  loginTabAktif = tab;
  const tabGoogle = document.getElementById('tabGoogle');
  const tabEmail = document.getElementById('tabEmail');
  const formGoogle = document.getElementById('formGoogle');
  const formEmail = document.getElementById('formEmail');

  if(tab === 'google') {
    tabGoogle.style.background = '#e50914';
    tabGoogle.style.color = '#fff';
    tabEmail.style.background = 'transparent';
    tabEmail.style.color = '#999';
    formGoogle.style.display = 'block';
    formEmail.style.display = 'none';
  } else {
    tabEmail.style.background = '#e50914';
    tabEmail.style.color = '#fff';
    tabGoogle.style.background = 'transparent';
    tabGoogle.style.color = '#999';
    formEmail.style.display = 'block';
    formGoogle.style.display = 'none';
  }
}

window.loginGoogle = async function() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    await setDoc(doc(db, "users", user.uid), {
      nama: user.displayName || 'User',
      email: user.email,
      photoURL: user.photoURL,
      xp: 0,
      level: 1,
      lastLogin: serverTimestamp()
    }, { merge: true });

    hidePopupLogin();
    showPopup('Berhasil masuk via Google! Selamat datang ' + user.displayName);
  } catch (err) {
    console.error(err);
    showPopup('Login gagal: ' + err.message);
  }
}

window.loginEmail = async function() {
  const email = document.getElementById('inputEmail').value.trim();
  const pass = document.getElementById('inputPass').value.trim();

  if(!email ||!pass) {
    showPopup('Email & password wajib diisi wok');
    return;
  }
  if(pass.length < 6) {
    showPopup('Password minimal 6 karakter');
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    hidePopupLogin();
    showPopup('Berhasil masuk!');
  } catch (err) {
    if(err.code === 'auth/user-not-found') {
      showPopup('Akun ga ketemu. Daftar dulu ya');
    } else if(err.code === 'auth/wrong-password') {
      showPopup('Password salah wok');
    } else {
      showPopup('Error: ' + err.message);
    }
  }
}

window.registerEmail = async function() {
  const email = document.getElementById('inputEmail').value.trim();
  const pass = document.getElementById('inputPass').value.trim();

  if(!email ||!pass) {
    showPopup('Email & password wajib diisi wok');
    return;
  }
  if(!email.includes('@')) {
    showPopup('Format email salah');
    return;
  }
  if(pass.length < 6) {
    showPopup('Password minimal 6 karakter');
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const user = result.user;

    await setDoc(doc(db, "users", user.uid), {
      nama: email.split('@')[0],
      email: email,
      photoURL: '',
      xp: 0,
      level: 1,
      createdAt: serverTimestamp()
    });

    hidePopupLogin(); // FIX: biar popup nutup abis daftar
    showPopup('Akun berhasil dibuat! Selamat datang');
  } catch (err) {
    if(err.code === 'auth/email-already-in-use') {
      showPopup('Email udah terdaftar. Login aja');
    } else {
      showPopup('Error: ' + err.message);
    }
  }
}

// FIX: Fungsi buat ganti mode Daftar/Masuk
window.switchKeDaftar = function() {
  const btn = document.querySelector('#formEmail button');
  const teks = document.querySelector('#formEmail p');
  if(!btn ||!teks) return;

  btn.innerText = 'Daftar';
  btn.setAttribute('onclick', 'registerEmail()');
  teks.innerHTML = 'Udah punya akun? <span style="color:#e50914;cursor:pointer" onclick="switchKeMasuk()">Masuk disini</span>';
}

window.switchKeMasuk = function() {
  const btn = document.querySelector('#formEmail button');
  const teks = document.querySelector('#formEmail p');
  if(!btn ||!teks) return;

  btn.innerText = 'Masuk';
  btn.setAttribute('onclick', 'loginEmail()');
  teks.innerHTML = 'Belum punya akun? <span style="color:#e50914;cursor:pointer" onclick="switchKeDaftar()">Daftar disini</span>';
}
window.logout = function() {
  signOut(auth).then(() => {
    showPopup('Lu udah logout');
  }).catch(err => {
    showPopup('Error logout: ' + err.message);
  });
}

window.muatProfil = async function() { // <-- TAMBAH async DISINI
  const user = auth.currentUser;

  if(user) {
    try {
      // AMBIL DULU DATA DARI FIRESTORE BIAR SINKRON
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const data = snap.exists()? snap.data() : {};

      // Pake data Firestore > kalo ga ada baru pake data Google
      const nama = data.nama || user.displayName || user.email.split('@')[0];
      const foto = data.photoURL || user.photoURL || 'https://via.placeholder.com/70/222/666?text=User';
      const xp = data.xp || 0;
      const level = data.level || 1;

      // Save ke localStorage biar Pengaturan kebaca
      localStorage.setItem('userName', nama);
      localStorage.setItem('userPhoto', foto);

      // Update UI Profil
      document.getElementById('userName').innerText = nama;
      document.getElementById('userEmail').innerText = user.email;
      document.getElementById('userKode').innerText = user.uid.substring(0, 8).toUpperCase();
      document.getElementById('userAvatar').src = foto;
      document.getElementById('userNameInfo').innerText = nama;
      document.getElementById('namaSekarang').innerText = nama;
      document.getElementById('loginMetode').innerText = user.providerData[0].providerId === 'google.com'? 'Google' : 'Email';

      // Update XP + Level
      document.getElementById('statExp').innerText = xp;
      document.getElementById('userLevel').innerText = 'Lvl ' + level;
      document.getElementById('xpMax').innerText = level * 120;
      document.getElementById('xpBar').style.width = ((xp % 120) / 120 * 100) + '%';

      document.getElementById('btn-logout').innerText = 'Keluar Akun';
      document.getElementById('btn-logout').onclick = logout;
      document.getElementById('btn-logout').style.background = '#e50914';
    } catch(err) {
      console.error('Gagal muat profil:', err);
      showPopup('Gagal load data profil');
    }
  } else {
    document.getElementById('userName').innerText = 'Belum Login';
    document.getElementById('userEmail').innerText = '-';
    document.getElementById('userKode').innerText = '-';
    document.getElementById('userNameInfo').innerText = '-';
    document.getElementById('userAvatar').src = 'https://via.placeholder.com/70/222/666?text=User';
    document.getElementById('namaSekarang').innerText = 'Belum Login';

    document.getElementById('btn-logout').innerText = 'Login dengan Google';
    document.getElementById('btn-logout').onclick = showPopupLogin;
    document.getElementById('btn-logout').style.background = '#2a2a2a';
  }
}

// Auto load user pas buka app
onAuthStateChanged(auth, (user) => {
  window.muatProfil();
  if(user) {
    SETTINGS.nama = user.displayName || user.email.split('@')[0];
    SETTINGS.pp = user.photoURL || '';
  }
});

window.renderHalamanFavorit = async function() {
    const list = document.getElementById('favorit-list');
    if (!list) return;

    const fav = getFavorit();
    list.innerHTML = '';

    if (fav.length === 0) {
        list.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#666;padding:40px;">Login Dulu Mbut Baru Bisa</p>';
        return;
    }

    fav.forEach(f => {
        list.innerHTML += `
            <div class="card" onclick='bukaDetail("${f.id}")'>
                <img src="${f.poster}" alt="${f.judul}">
                <div class="card-info">
                    <div class="card-title">${f.judul}</div>
                </div>
            </div>
        `;
    });
};

window.muatLeaderboard = async function() {
    const list = document.querySelector('.leaderboard');
    if (!list) return;

    list.innerHTML = `<h3 class="section-title">Top 3 Player Paling Sultan</h3><p style="text-align:center;color:#666;padding:20px;">Loading...</p>`;

    try {
        const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(3));
        const snap = await getDocs(q);

        if (snap.empty) {
            list.innerHTML = `<h3 class="section-title">Top 3 Player Paling Sultan</h3><p style="text-align:center;color:#666;padding:20px;">Belum ada player</p>`;
            return;
        }

        let html = '<h3 class="section-title">Top 3 Player Paling Sultan</h3>';
        let rank = 1;

        snap.forEach(doc => {
            let data = doc.data();
            let avatar = data.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nama || 'User')}&background=222&color=fff&size=52`;
            let nama = data.nama || 'User';
            let level = data.level || 1;
            let xp = data.xp || 0;

            let verifLink = '';
            if (typeof data.verif === 'string' && data.verif.startsWith('http')) {
                verifLink = data.verif;
            } else if (data.verif === true) {
                verifLink = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e4/Twitter_Verified_Badge.svg/2048px-Twitter_Verified_Badge.svg.png';
            }

            let rankColor = rank === 1? '#FFD700' : rank === 2? '#E0E0E0' : '#D2691E';
            let borderColor = rankColor + '60';

            html += `
            <div class="player-card rank-${rank}">
                <span class="rank-num">#${rank}</span>
                <img src="${avatar}" class="player-avatar" style="border-color:${borderColor}">
                <div class="player-info">
                    <div class="player-name-row">
                        <span class="player-name">${nama}</span>
                        ${verifLink? `<img src="${verifLink}" class="verif-icon" alt="verified">` : ''}
                    </div>
                    <div class="player-meta">
                        <span class="lvl-text">Level ${level}</span>
                        <span class="xp-text">${xp.toLocaleString()} XP</span>
                    </div>
                </div>
            </div>
            `;
            rank++;
        });

        list.innerHTML = html;

    } catch (err) {
        console.error('Error leaderboard:', err);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    aktifinSearch();

    if (document.getElementById('home')) {
        window.muatAnime();
        window.muatLeaderboard();
    }
    if(document.getElementById('genre')) {
        window.muatGenre();
    }
    if(document.getElementById('pengaturan')) {
        window.loadSettings();
    }
});

// ===== POPUP TITIK 3 PROFIL =====
window.toggleProfileMenu = function() {
  const popup = document.getElementById('profileMenuPopup');
  if (popup) popup.classList.toggle('active');
}

// ===== LISTENER KLIK LUAR POPUP - CUMA 1 BIAR GA TABRAKAN =====
document.addEventListener('click', function(e) {
  const menu = document.getElementById('profileMenuPopup');
  const btn = document.querySelector('.profile-menu-btn');
  if (menu && btn &&!menu.contains(e.target) &&!btn.contains(e.target)) {
    menu.classList.remove('active');
  }

  const popupLogin = document.getElementById('popupLogin');
  if (popupLogin && popupLogin.classList.contains('active') && e.target === popupLogin) {
    hidePopupLogin();
  }

  const popupPilihan = document.getElementById('popupPilihan');
  if (popupPilihan && popupPilihan.style.display === 'flex' && e.target === popupPilihan) {
    hidePopupPilihan();
  }

  const popupNotif = document.getElementById('popupNotifikasi');
  if (popupNotif && popupNotif.style.display === 'flex' && e.target === popupNotif) {
    hidePopup();
  }
});

// ===== LISTENER CHANGE SETTING - CUMA 1 KALI =====
document.addEventListener('change', function(e) {
  if(e.target.id === 'toggleNotif') {
    SETTINGS.notif = e.target.checked;
    localStorage.setItem('notif', SETTINGS.notif);
  }
  if(e.target.id === 'toggleDark') {
    SETTINGS.darkMode = e.target.checked;
    document.body.classList.toggle('dark', SETTINGS.darkMode);
    localStorage.setItem('darkMode', SETTINGS.darkMode);
  }
  if(e.target.id === 'toggleAutoPlay') {
    SETTINGS.autoplay = e.target.checked;
    localStorage.setItem('autoplay', SETTINGS.autoplay);
  }
  if(e.target.id === 'toggleSkipIntro') {
    SETTINGS.skipIntro = e.target.checked;
    localStorage.setItem('skipIntro', SETTINGS.skipIntro);
  }
});
