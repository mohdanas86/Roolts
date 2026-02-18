import { openDB } from 'idb';

const DB_NAME = 'roolts-notes-db';
const DB_VERSION = 2;

export const initDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            // Notes store
            if (!db.objectStoreNames.contains('notes')) {
                const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
                notesStore.createIndex('updatedAt', 'updatedAt');
            }
            // Media store for large files (images/videos)
            if (!db.objectStoreNames.contains('media')) {
                db.createObjectStore('media', { keyPath: 'id' });
            }
            // Notebooks store
            if (!db.objectStoreNames.contains('notebooks')) {
                db.createObjectStore('notebooks', { keyPath: 'id' });
            }
        },
    });
};

export const notesDB = {
    async getAllNotes() {
        const db = await initDB();
        return db.getAll('notes');
    },

    async saveNote(note) {
        const db = await initDB();
        return db.put('notes', {
            ...note,
            updatedAt: new Date().toISOString()
        });
    },

    async deleteNote(id) {
        const db = await initDB();
        return db.delete('notes', id);
    },

    async saveMedia(file) {
        const db = await initDB();
        const id = crypto.randomUUID();

        // Convert file to ArrayBuffer for reliable storage
        const arrayBuffer = await file.arrayBuffer();

        await db.put('media', {
            id,
            data: arrayBuffer,  // Store as ArrayBuffer
            type: file.type,
            name: file.name,
            createdAt: new Date().toISOString()
        });

        return id;
    },

    async getMedia(id) {
        const db = await initDB();
        const record = await db.get('media', id);

        if (record && record.data) {
            // Convert ArrayBuffer back to Blob
            const blob = new Blob([record.data], { type: record.type });
            return { ...record, blob };
        }

        return null;
    },

    async getAllNotebooks() {
        const db = await initDB();
        const notebooks = await db.getAll('notebooks');
        if (notebooks.length === 0) {
            const defaultNb = { id: 'default', name: 'My Notes', createdAt: new Date().toISOString() };
            await db.put('notebooks', defaultNb);
            return [defaultNb];
        }
        return notebooks;
    },

    async saveNotebook(notebook) {
        const db = await initDB();
        return db.put('notebooks', notebook);
    },

    async deleteNotebook(id) {
        const db = await initDB();
        return db.delete('notebooks', id);
    }
};
