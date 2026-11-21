export const DEFAULT_CLOUD_SERVER_URL =
  'https://ais-pre-r5x5wtnw27q4ecv62ssc6v-919656900103.us-east1.run.app';

const SERVER_STORAGE_KEY = 'deadzone_server_url_v1';

declare global {
  interface Window {
    __DEADZONE_SERVER_URL__?: string;
  }
}

export function isStandaloneFileMode(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_CLOUD_SERVER_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|127\.0\.0\.1|192\.168\.|10\.)/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

export function getInjectedServerUrl(): string {
  if (typeof window === 'undefined') return '';
  const injected = window.__DEADZONE_SERVER_URL__;
  return typeof injected === 'string' && injected.trim() ? normalizeServerUrl(injected) : '';
}

export function getStandaloneServerUrl(): string {
  try {
    const saved = localStorage.getItem(SERVER_STORAGE_KEY);
    if (saved && saved.trim()) return normalizeServerUrl(saved);
  } catch {
    // ignore storage errors
  }
  return getInjectedServerUrl() || DEFAULT_CLOUD_SERVER_URL;
}

export function setStandaloneServerUrl(rawUrl: string): string {
  const normalized = normalizeServerUrl(rawUrl);
  try {
    localStorage.setItem(SERVER_STORAGE_KEY, normalized);
  } catch {
    // ignore storage errors
  }
  return normalized;
}

export function resetStandaloneServerUrl(): string {
  try {
    localStorage.removeItem(SERVER_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
  return getInjectedServerUrl() || DEFAULT_CLOUD_SERVER_URL;
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (isStandaloneFileMode()) {
    return `${getStandaloneServerUrl()}${cleanPath}`;
  }
  return cleanPath;
}

export function getServerWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3000/ws';
  if (isStandaloneFileMode()) {
    const httpBase = getStandaloneServerUrl();
    const wsBase = httpBase.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
    return `${wsBase}/ws`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}
