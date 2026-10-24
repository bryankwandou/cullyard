// Shared strings for the desk. English is the default; the choice is remembered per browser.
export const STRINGS = {
  en: {
    inbox: 'Inbox', drop: 'Drop files here, or anywhere on the desk', dropHint: 'Photos, video, music, documents, PDFs. Anything.',
    activity: 'Agent activity', empty: 'Nothing here yet', newLane: 'New lane', laneName: 'Lane name',
    live: 'Live', offline: 'Desk offline', files: 'files', keys: 'Select a card, then press 1–9 to send it to a lane',
    action_move: 'moved', action_drop: 'dropped', action_seal: 'sealed the log on devnet', to: 'to',
    noActivity: 'When your agent sorts something, it shows up here.', create: 'Create', cancel: 'Cancel',
    uploaded: 'Added', failed: 'Failed',
  },
  id: {
    inbox: 'Kotak masuk', drop: 'Taruh file di sini, atau di mana saja di desk', dropHint: 'Foto, video, musik, dokumen, PDF. Apa saja.',
    activity: 'Aktivitas agent', empty: 'Belum ada isi', newLane: 'Lane baru', laneName: 'Nama lane',
    live: 'Aktif', offline: 'Desk terputus', files: 'file', keys: 'Pilih kartu, lalu tekan 1–9 untuk mengirimnya ke lane',
    action_move: 'memindahkan', action_drop: 'menambahkan', action_seal: 'menyegel log di devnet', to: 'ke',
    noActivity: 'Saat agent memilah sesuatu, catatannya muncul di sini.', create: 'Buat', cancel: 'Batal',
    uploaded: 'Ditambahkan', failed: 'Gagal',
  },
};

export function getLang() {
  try { return localStorage.getItem('cullyard-lang') === 'id' ? 'id' : 'en'; } catch { return 'en'; }
}

export function setLang(lang) {
  try { localStorage.setItem('cullyard-lang', lang); } catch { /* private window */ }
}
