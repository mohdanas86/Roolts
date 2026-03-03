import { openDB } from 'idb';

const DB_NAME = 'roolts-main-db';
const STORE_NAME = 'zustand-store';
const DB_VERSION = 1;

const dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
        }
    },
});

export const indexedDBStorage = {
    getItem: async (name) => {
        const db = await dbPromise;
        const value = await db.get(STORE_NAME, name);
        return value || null;
    },
    setItem: async (name, value) => {
        const db = await dbPromise;
        await db.put(STORE_NAME, value, name);
    },
    removeItem: async (name) => {
        const db = await dbPromise;
        await db.delete(STORE_NAME, name);
    },
};
