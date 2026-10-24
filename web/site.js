document.documentElement.classList.add('js');

const ID = {
  'nav.how': 'Cara kerja', 'nav.run': 'Uji nyata', 'nav.tools': 'Tool', 'nav.proof': 'Bukti', 'nav.install': 'Pasang',
  'hero.eyebrow': 'Server MCP dan desk untuk Windows',
  'hero.title': 'Bilang ke agent cara memilahnya. Lihat foldernya bergerak.',
  'hero.lede': 'Taruh satu sesi foto, satu album, atau setumpuk kontrak di desk. Claude Code atau Antigravity membaca tiap file lewat MCP, memasukkannya ke Picks, Maybe, Rejects atau lane buatan Anda, lalu memotong atau mengecilkan salinannya kalau diminta. Tidak ada yang keluar dari disk Anda.',
  'hero.cta': 'Pasang dengan satu baris', 'hero.watch': 'Tonton uji nyata',
  'facts.kinds': 'Jenis file', 'facts.tools': 'Tool MCP', 'facts.tests': 'Tes lulus',
  'strip.a': 'Jalan di Claude Code, Antigravity, dan klien MCP lain', 'strip.b': 'Foto · RAW · video · musik · PDF · dokumen · arsip', 'strip.c': 'Edit selalu menulis salinan. File asli tidak disentuh.',
  'how.title': 'Tiga langkah, tanpa wizard impor',
  'how.1t': 'Arahkan ke satu folder', 'how.1p': 'Tambahkan Cullyard ke agent dengan satu perintah dan beri workspace, misalnya D:\\Shoots\\Bali. Desk terbuka di komputer Anda pada 127.0.0.1:4870.',
  'how.2t': 'Taruh file, lalu bilang maunya apa', 'how.2p': 'Seret file dari Explorer ke desk. Lalu ketik di agent: "simpan foto pelabuhan yang tajam, taruh set blue hour di Maybe, kontrak masuk Client docs."',
  'how.3t': 'Awasi kerjanya, lalu koreksi', 'how.3p': 'Kartu bergeser ke lane setiap kali agent memanggil tool. Tidak setuju? Seret kartunya atau tekan 1 sampai 9. Anda dan agent mengubah folder yang sama, jadi tidak ada yang selisih.',
  'run.title': 'Uji nyata, direkam apa adanya',
  'run.p': 'Ini desk saat sebuah skrip menjalankan server MCP asli seperti agent: memindai, membuat lane, memilah sepuluh dari sebelas file, mengecilkan satu foto, memotong satu klip, menyegel log di devnet, lalu memeriksa segelnya. Tanpa mockup, dan tidak dipercepat selain frame rate.',
  'run.c1': '10 file dipilah ke 4 lane', 'run.c2': '1 salinan WebP selebar 1200 px', 'run.c3': '1 klip tiga detik dipotong tanpa encode ulang', 'run.c4': '1 memo devnet yang cocok dengan hash log',
  'run.cap': 'Walkthrough, 1440 × 860, direkam dari Chrome headless.',
  'shots.a': 'Sebelum: semua masuk ke Inbox.', 'shots.b': 'Sesudah: lane terisi, log tersegel.', 'shots.c': 'Desk tersedia dalam bahasa Inggris dan Indonesia.',
  'tools.title': 'Yang bisa dipanggil agent Anda',
  'tools.p': 'Setiap tool mengembalikan JSON biasa dan gagal dengan pesan yang jelas. Path di luar workspace ditolak, pemindahan tidak pernah menimpa, dan edit selalu menulis file baru.',
  'tools.does': 'fungsinya',
  't.scan': 'Daftar semua file dengan jenis, ukuran, resolusi, durasi, tag, atau jumlah halaman.', 't.describe': 'Metadata untuk satu file.', 't.lanes': 'Lane yang ada dan file mana di lane mana.',
  't.create': 'Menambah lane seperti "Hero shots" atau "Final cut".', 't.move': 'Memindahkan file ke folder lane. Menolak menimpa.', 't.resize': 'Menulis salinan WebP, JPG, PNG, atau AVIF dengan ukuran baru.',
  't.trim': 'Memotong rentang waktu video atau audio tanpa encode ulang.', 't.digest': 'SHA-256 dari log pemilahan, dihitung lokal.', 't.seal': 'Menulis hash itu ke memo Solana devnet.',
  't.verify': 'Menghitung ulang hash dan mencocokkannya dengan chain.', 't.kinds': 'Jenis file yang dikenali Cullyard.',
  'proof.title': 'Bukti bahwa pemilahan terjadi, dan kapan',
  'proof.p': 'Fotografer menyerahkan hasil pilihan, editor menyerahkan potongan, asisten merapikan folder klien. Cullyard menyimpan log setiap pemindahan yang hanya bisa ditambah. Segel menulis SHA-256 log itu ke memo di Solana devnet, jadi siapa pun yang memegang log bisa mengecek bahwa log tidak diubah belakangan. File dan nama file Anda tidak pernah masuk chain, hanya hash-nya.',
  'proof.sig': 'Signature', 'proof.memo': 'Memo', 'proof.check': 'Cek lokal', 'proof.net': 'Jaringan',
  'install.title': 'Pasang', 'install.p': 'Butuh Node.js 20 atau lebih baru. FFmpeg sudah ikut di paket, jadi video dan audio langsung jalan di Windows. Ganti foldernya dengan milik Anda.',
  'install.other': 'Klien MCP lain', 'install.copy': 'Salin',
  'install.seal': 'Untuk menyegel, isi CULLYARD_KEYPAIR dengan file keypair devnet. Tanpa itu, memilah dan mengedit tetap sama, hanya seal_run yang menolak dengan sopan.',
  'lim.title': 'Yang belum bisa dilakukan',
  'lim.1': 'Cullyard tidak menilai foto sendiri. Agent Anda yang memutuskan; Cullyard memberi fakta dan tangannya.',
  'lim.2': 'Belum ada timeline editor. Potong dan ubah ukuran adalah langkah tunggal, bukan pengganti Premiere.',
  'lim.3': 'Segel memakai devnet. Opsi mainnet menunggu sampai ada yang memintanya dengan alur kerja nyata.',
  'kit.title': 'Media kit', 'kit.p': 'Semua di bawah ini berasal dari rekaman uji nyata yang sama dengan walkthrough di atas.',
  'kit.vcap': 'Film produk, 51 detik, 1920 × 1080, tanpa suara.',
  'kit.report': 'Laporan build', 'kit.reportd': 'Apa yang dibuat, cara mengeceknya, screenshot, dan batasannya.',
  'kit.deck': 'Pitch deck (PDF)', 'kit.deckd': 'Delapan slide: masalah, produk, cara kerja, segel, langkah berikutnya.',
  'kit.log': 'Transkrip agent', 'kit.logd': 'Setiap panggilan MCP dan balasannya dari uji nyata.',
  'kit.proof': 'proof.json', 'kit.proofd': 'Signature, memo, signer, dan hash lokal yang cocok.',
  'foot.report': 'Laporan build',
};

const EN = {};
const nodes = document.querySelectorAll('[data-i18n]');
nodes.forEach((n) => { EN[n.dataset.i18n] = n.textContent; });

function setLang(lang) {
  const dict = lang === 'id' ? ID : EN;
  nodes.forEach((n) => { const v = dict[n.dataset.i18n]; if (v) n.textContent = v; });
  document.documentElement.lang = lang;
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  try { localStorage.setItem('cullyard-lang', lang); } catch { /* storage blocked */ }
  heroScript = lang === 'id' ? PROMPTS.id : PROMPTS.en;
}
document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

// Hero: a small loop that types an instruction and files chips into lanes.
const PROMPTS = {
  en: ['keep the sharp harbor shots, park blue hour in Maybe', 'reject anything underexposed or blurry', 'trim the drone pass to 3 seconds'],
  id: ['simpan foto pelabuhan yang tajam, blue hour ke Maybe', 'buang yang terlalu gelap atau blur', 'potong drone pass jadi 3 detik'],
};
let heroScript = PROMPTS.en;
const FILES = [
  ['IMG_2041.jpg', '#c9773a', 0], ['IMG_2045.jpg', '#8ab6d6', 1], ['IMG_2043.jpg', '#3a3f47', 2], ['drone-pass.mp4', '#6b8f71', 0],
  ['IMG_2044.jpg', '#d9a441', 0], ['night-ferry.mp3', '#9a7fd1', 1], ['IMG_2046.jpg', '#b9b2a6', 2], ['contract.pdf', '#e06c5a', 1],
];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pile = document.getElementById('pile');
const lanes = [...document.querySelectorAll('.lane-demo')];
const typed = document.getElementById('typed');
const ticker = document.getElementById('ticker');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chip([name, color]) {
  const c = document.createElement('div');
  c.className = 'chip';
  const sw = document.createElement('i');
  sw.style.background = color;
  c.append(sw, name);
  return c;
}

async function typeLine(text) {
  typed.textContent = '';
  for (const ch of text) { typed.textContent += ch; await sleep(reduce ? 0 : 26); }
}

async function heroLoop() {
  let round = 0;
  for (;;) {
    pile.replaceChildren(...FILES.map((f) => chip(f)));
    lanes.forEach((l) => l.querySelector('.slot').replaceChildren());
    await typeLine(heroScript[round % heroScript.length]);
    await sleep(500);
    for (let i = 0; i < FILES.length; i++) {
      const f = FILES[i];
      const lane = lanes[f[2]];
      pile.firstElementChild?.remove();
      const c = chip(f);
      c.classList.add('fly');
      lane.querySelector('.slot').append(c);
      lane.classList.add('hot');
      ticker.innerHTML = `move_to_lane <b>${f[0]}</b> → ${lane.querySelector('h4').textContent.slice(2)}`;
      await sleep(reduce ? 200 : 620);
      lane.classList.remove('hot');
    }
    ticker.innerHTML = 'seal_run → <b>devnet memo confirmed</b>';
    await sleep(2600);
    round++;
  }
}
if (pile) heroLoop();

// Scroll reveal
const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach((n) => io.observe(n));

// Nav border on scroll
const nav = document.querySelector('.nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });

// Tabs with arrow-key support
const tabs = [...document.querySelectorAll('[role="tab"]')];
function pick(tab) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
  tab.focus();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => pick(t));
  t.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') pick(tabs[(i + 1) % tabs.length]);
    if (e.key === 'ArrowLeft') pick(tabs[(i - 1 + tabs.length) % tabs.length]);
  });
});

// Copy buttons
document.querySelectorAll('.copy').forEach((b) => b.addEventListener('click', async () => {
  const code = b.parentElement.querySelector('code').textContent;
  try {
    await navigator.clipboard.writeText(code);
    const label = b.textContent;
    b.textContent = '✓';
    b.classList.add('done');
    setTimeout(() => { b.textContent = label; b.classList.remove('done'); }, 1600);
  } catch { /* clipboard blocked; the text is still selectable */ }
}));

// Devnet proof from the recorded run
fetch('/proof.json').then((r) => (r.ok ? r.json() : null)).then((p) => {
  if (!p) return;
  const sig = document.getElementById('sig');
  sig.textContent = p.signature;
  sig.href = p.explorer;
  document.getElementById('memo').textContent = p.memo;
  document.getElementById('match').textContent = p.match ? 'match' : 'mismatch';
}).catch(() => {});

let saved = 'en';
try { saved = localStorage.getItem('cullyard-lang') || 'en'; } catch { /* storage blocked */ }
if (saved === 'id') setLang('id');
