export const setIndexedDB = (key: string, value: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('UBP_Studio_DB', 1);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('keyval')) {
        db.createObjectStore('keyval');
      }
    };

    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const tx = db.transaction('keyval', 'readwrite');
      const store = tx.objectStore('keyval');
      store.put(value, key);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

export const getIndexedDB = (key: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('UBP_Studio_DB', 1);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('keyval')) {
        db.createObjectStore('keyval');
      }
    };

    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const tx = db.transaction('keyval', 'readonly');
      const store = tx.objectStore('keyval');
      const req = store.get(key);

      req.onsuccess = () => {
        db.close();
        resolve(req.result);
      };

      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

export const clearIndexedDB = (key: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('UBP_Studio_DB', 1);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('keyval')) {
        db.createObjectStore('keyval');
      }
    };

    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const tx = db.transaction('keyval', 'readwrite');
      const store = tx.objectStore('keyval');
      store.delete(key);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};
