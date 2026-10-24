// File kinds Cullyard understands. Anything unknown is still tracked as "other";
// the desk never refuses a file because of its extension.

const MAP = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'avif', 'svg'],
  raw: ['cr2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'rw2', 'dng', 'pef', 'srw'],
  video: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'mts', 'm2ts', 'wmv', 'flv', '3gp'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'aif'],
  pdf: ['pdf'],
  document: ['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages', 'xls', 'xlsx', 'csv', 'ods', 'ppt', 'pptx', 'odp', 'key', 'epub', 'json', 'xml', 'html'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
  design: ['psd', 'ai', 'fig', 'sketch', 'xd', 'blend', 'kra', 'afphoto', 'afdesign', 'pen'],
  code: ['js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'cs', 'rb', 'php', 'sh', 'ps1', 'css', 'sql'],
};

const BY_EXT = new Map();
for (const [kind, exts] of Object.entries(MAP)) for (const e of exts) BY_EXT.set(e, kind);

export const KINDS = [...Object.keys(MAP), 'other'];

export function extOf(name) {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function kindOf(name) {
  return BY_EXT.get(extOf(name)) ?? 'other';
}

// Text-like documents whose first bytes are worth showing to an agent.
export const TEXTUAL = new Set(['txt', 'md', 'csv', 'json', 'xml', 'html', 'rtf', ...MAP.code]);
