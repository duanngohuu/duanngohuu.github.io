// Shared IndexedDB storage + Service Worker registration for offline flashcard use.
(() => {
  try {
    const DB_NAME = 'fc-sheet-library';
    const DB_VERSION = 2;
    const LESSON_STORE = 'lessons';
    const LIBRARY_STORE = 'library';
    let dbPromise = null;

    function openDb() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) return reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(LESSON_STORE)) {
            const lessons = db.createObjectStore(LESSON_STORE, { keyPath: 'lessonId' });
            lessons.createIndex('courseId', 'courseId', { unique: false });
            lessons.createIndex('checkedAt', 'checkedAt', { unique: false });
          }
          if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
            const library = db.createObjectStore(LIBRARY_STORE, { keyPath: 'key' });
            library.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Không mở được IndexedDB.'));
        request.onblocked = () => reject(new Error('IndexedDB đang bị khóa bởi tab cũ.'));
      });
      return dbPromise;
    }

    async function get(storeName, key) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    }

    async function put(storeName, value) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
        request.onsuccess = () => resolve(value);
        request.onerror = () => reject(request.error);
      });
    }

    async function getLesson(lessonId) {
      return get(LESSON_STORE, lessonId);
    }

    async function putLesson(record) {
      return put(LESSON_STORE, record);
    }

    async function getLibrary(key) {
      const record = await get(LIBRARY_STORE, key);
      return record?.value ?? null;
    }

    async function putLibrary(key, value) {
      return put(LIBRARY_STORE, {
        key,
        value,
        updatedAt: new Date().toISOString()
      });
    }

    async function requestPersistentStorage() {
      try {
        if (!navigator.storage?.persist) return false;
        const already = await navigator.storage.persisted?.();
        return already || await navigator.storage.persist();
      } catch (_) {
        return false;
      }
    }

    async function registerServiceWorker() {
      if (!('serviceWorker' in navigator)) return null;
      try {
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        registration.update().catch(() => {});
        return registration;
      } catch (error) {
        console.warn('[service-worker disabled]', error);
        return null;
      }
    }

    window.flashcardOffline = {
      dbName: DB_NAME,
      dbVersion: DB_VERSION,
      openDb,
      getLesson,
      putLesson,
      getLibrary,
      putLibrary,
      requestPersistentStorage,
      registerServiceWorker
    };

    requestPersistentStorage();
    if (document.readyState === 'loading') {
      window.addEventListener('load', registerServiceWorker, { once: true });
    } else {
      registerServiceWorker();
    }
  } catch (error) {
    try { console.warn('[offline-store disabled]', error); } catch (_) {}
  }
})();
