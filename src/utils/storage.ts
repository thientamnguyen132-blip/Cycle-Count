import { CycleCountItem, CycleCountSession } from '../types';

const DB_NAME = 'SPX_CYCLE_COUNT_DB';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const ITEMS_STORE = 'items';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ITEMS_STORE)) {
        const itemStore = db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
        itemStore.createIndex('sessionId', 'sessionId', { unique: false });
        itemStore.createIndex('orderId', 'orderId', { unique: false });
        itemStore.createIndex('sessionAndOrder', ['sessionId', 'orderId'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Memory / LocalStorage fallback
const LOCAL_STORAGE_SESSIONS_KEY = 'spx_cc_sessions_backup';
const LOCAL_STORAGE_ACTIVE_KEY = 'spx_cc_active_session_id';

export async function saveSessionWithItems(
  session: CycleCountSession,
  items: CycleCountItem[]
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([SESSIONS_STORE, ITEMS_STORE], 'readwrite');
    const sessionStore = tx.objectStore(SESSIONS_STORE);
    const itemStore = tx.objectStore(ITEMS_STORE);

    sessionStore.put(session);

    for (const item of items) {
      itemStore.put(item);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        setActiveSessionId(session.id);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB write failed, fallback to localStorage/memory:', err);
    // Save metadata in localStorage
    const sessions = getSessionsFromLocalStorage();
    const existingIdx = sessions.findIndex((s) => s.id === session.id);
    if (existingIdx >= 0) {
      sessions[existingIdx] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
    try {
      localStorage.setItem(`spx_cc_items_${session.id}`, JSON.stringify(items));
    } catch {
      console.warn('LocalStorage limit reached for items');
    }
    setActiveSessionId(session.id);
  }
}

export async function getAllSessions(): Promise<CycleCountSession[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(SESSIONS_STORE, 'readonly');
    const store = tx.objectStore(SESSIONS_STORE);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const list = (request.result as CycleCountSession[]) || [];
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return getSessionsFromLocalStorage();
  }
}

export async function getSessionItems(sessionId: string): Promise<CycleCountItem[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(ITEMS_STORE, 'readonly');
    const store = tx.objectStore(ITEMS_STORE);
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const items = (request.result as CycleCountItem[]) || [];
        // Preserve original row index sequence
        items.sort((a, b) => a.rowIndex - b.rowIndex);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    const raw = localStorage.getItem(`spx_cc_items_${sessionId}`);
    if (raw) {
      try {
        const items = JSON.parse(raw) as CycleCountItem[];
        items.sort((a, b) => a.rowIndex - b.rowIndex);
        return items;
      } catch {
        return [];
      }
    }
    return [];
  }
}

export async function updateItemCheckStatus(
  item: CycleCountItem,
  newStatus: 'Checked' | 'Pending',
  checkedTime: string | null
): Promise<CycleCountItem> {
  const updatedItem: CycleCountItem = {
    ...item,
    cycleCountStatus: newStatus,
    cycleCountTime: newStatus === 'Checked' ? checkedTime : null,
    updatedAt: new Date().toISOString(),
  };

  try {
    const db = await openDB();
    const tx = db.transaction([ITEMS_STORE, SESSIONS_STORE], 'readwrite');
    const itemStore = tx.objectStore(ITEMS_STORE);
    const sessionStore = tx.objectStore(SESSIONS_STORE);

    itemStore.put(updatedItem);

    // Update checked count in session
    const sessReq = sessionStore.get(item.sessionId);
    sessReq.onsuccess = () => {
      const sess = sessReq.result as CycleCountSession | undefined;
      if (sess) {
        if (item.cycleCountStatus !== newStatus) {
          sess.checkedOrders += newStatus === 'Checked' ? 1 : -1;
          sess.updatedAt = new Date().toISOString();
          sessionStore.put(sess);
        }
      }
    };

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not update IndexedDB:', err);
  }

  return updatedItem;
}

export async function updateItemRecord(item: CycleCountItem): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(ITEMS_STORE, 'readwrite');
    const itemStore = tx.objectStore(ITEMS_STORE);
    itemStore.put(item);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not update item record in IndexedDB:', err);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([SESSIONS_STORE, ITEMS_STORE], 'readwrite');
    const sessionStore = tx.objectStore(SESSIONS_STORE);
    const itemStore = tx.objectStore(ITEMS_STORE);

    sessionStore.delete(sessionId);

    // Delete items for this session
    const index = itemStore.index('sessionId');
    const request = index.openCursor(sessionId);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // fallback
  }

  // Clear local storage backups
  const sessions = getSessionsFromLocalStorage().filter((s) => s.id !== sessionId);
  localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
  localStorage.removeItem(`spx_cc_items_${sessionId}`);

  if (getActiveSessionId() === sessionId) {
    localStorage.removeItem(LOCAL_STORAGE_ACTIVE_KEY);
  }
}

export function getActiveSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LOCAL_STORAGE_ACTIVE_KEY);
}

export function setActiveSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_ACTIVE_KEY, sessionId);
}

function getSessionsFromLocalStorage(): CycleCountSession[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
