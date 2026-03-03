import { openDB } from 'idb';

const DB_NAME = 'roolts-snapshots-db';
const STORE_NAME = 'snapshots';

const initDB = async () => {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        },
    });
};

export const snapshotsDB = {
    async getAll() {
        const db = await initDB();
        return db.getAll(STORE_NAME);
    },
    async add(snapshot) {
        const db = await initDB();
        return db.put(STORE_NAME, snapshot);
    },
    async delete(id) {
        const db = await initDB();
        return db.delete(STORE_NAME, id);
    },
    async update(id, updates) {
        const db = await initDB();
        const existing = await db.get(STORE_NAME, id);
        if (existing) {
            return db.put(STORE_NAME, { ...existing, ...updates });
        }
        return null;
    }
};
