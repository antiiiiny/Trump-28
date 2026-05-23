export interface StoredColyseusSession {
  roomId: string;
  sessionId: string;
  reconnectionToken?: string;
  playerId?: string;
  seat?: number;
  name?: string;
}

const STORAGE_KEY = 'colyseus_session';
const WINDOW_NAME_PREFIX = 'colyseus_session:';

function readWindowNameSession(): StoredColyseusSession | null {
  if (typeof window === 'undefined' || !window.name.startsWith(WINDOW_NAME_PREFIX)) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(window.name.slice(WINDOW_NAME_PREFIX.length))) as StoredColyseusSession;
  } catch {
    return null;
  }
}

function writeWindowNameSession(session: StoredColyseusSession) {
  if (typeof window === 'undefined') {
    return;
  }

  window.name = `${WINDOW_NAME_PREFIX}${encodeURIComponent(JSON.stringify(session))}`;
}

function clearWindowNameSession() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.name.startsWith(WINDOW_NAME_PREFIX)) {
    window.name = '';
  }
}

export function readStoredColyseusSession(): StoredColyseusSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredColyseusSession;
      if (parsed.roomId && parsed.sessionId) {
        return parsed;
      }
    }
  } catch {
    // ignore storage read failures
  }

  return readWindowNameSession();
}

export function writeStoredColyseusSession(session: StoredColyseusSession) {
  const serialized = JSON.stringify(session);

  try {
    sessionStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // ignore storage write failures
  }

  writeWindowNameSession(session);
}

export function clearStoredColyseusSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage clear failures
  }

  clearWindowNameSession();
}