export function escapeIdentifier(str) {
  return String(str).replace(/`/g, '``');
}

export function safeDecodeURIComponent(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

export function parseJsonHeader(value, fallback) {
  const decoded = safeDecodeURIComponent(value);
  if (!decoded) return fallback;

  try {
    return JSON.parse(decoded);
  } catch {
    return fallback;
  }
}

export function estimateRowBytes(row) {
  try {
    return Buffer.byteLength(JSON.stringify(row || {}), 'utf8');
  } catch {
    return 0;
  }
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
