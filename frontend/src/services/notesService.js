/**
 * Notes Service
 * Local storage-based notes management for Roolts
 */

const NOTES_STORAGE_KEY = 'roolts_notes';

// Generate unique ID
const generateId = () => `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Get notes from localStorage
const getStoredNotes = () => {
    try {
        const stored = localStorage.getItem(NOTES_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Failed to load notes:', error);
        return [];
    }
};

// Save notes to localStorage
const saveNotes = (notes) => {
    try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
        return true;
    } catch (error) {
        console.error('Failed to save notes:', error);
        return false;
    }
};

export const notesService = {
    /**
     * Get all notes
     */
    getAllNotes: () => {
        return getStoredNotes();
    },

    /**
     * Get a single note by ID
     */
    getNote: (noteId) => {
        const notes = getStoredNotes();
        return notes.find(note => note.id === noteId) || null;
    },

    /**
     * Create a new note
     */
    createNote: (title = 'Untitled Note', content = '') => {
        const notes = getStoredNotes();
        const newNote = {
            id: generateId(),
            title,
            content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            pinned: false,
            color: 'default',
            tags: []
        };

        notes.unshift(newNote);
        saveNotes(notes);
        return newNote;
    },

    /**
     * Update a note
     */
    updateNote: (noteId, updates) => {
        const notes = getStoredNotes();
        const index = notes.findIndex(note => note.id === noteId);

        if (index === -1) {
            return null;
        }

        notes[index] = {
            ...notes[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        saveNotes(notes);
        return notes[index];
    },

    /**
     * Delete a note
     */
    deleteNote: (noteId) => {
        const notes = getStoredNotes();
        const filteredNotes = notes.filter(note => note.id !== noteId);

        if (filteredNotes.length === notes.length) {
            return false;
        }

        saveNotes(filteredNotes);
        return true;
    },

    /**
     * Pin/unpin a note
     */
    togglePin: (noteId) => {
        const notes = getStoredNotes();
        const note = notes.find(n => n.id === noteId);

        if (!note) {
            return null;
        }

        note.pinned = !note.pinned;
        note.updatedAt = new Date().toISOString();

        // Sort: pinned first, then by updatedAt
        notes.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        saveNotes(notes);
        return note;
    },

    /**
     * Set note color
     */
    setColor: (noteId, color) => {
        return notesService.updateNote(noteId, { color });
    },

    /**
     * Add tag to note
     */
    addTag: (noteId, tag) => {
        const note = notesService.getNote(noteId);
        if (!note) return null;

        const tags = [...new Set([...note.tags, tag])];
        return notesService.updateNote(noteId, { tags });
    },

    /**
     * Remove tag from note
     */
    removeTag: (noteId, tag) => {
        const note = notesService.getNote(noteId);
        if (!note) return null;

        const tags = note.tags.filter(t => t !== tag);
        return notesService.updateNote(noteId, { tags });
    },

    /**
     * Search notes
     */
    searchNotes: (query) => {
        const notes = getStoredNotes();
        const lowerQuery = query.toLowerCase();

        return notes.filter(note =>
            note.title.toLowerCase().includes(lowerQuery) ||
            note.content.toLowerCase().includes(lowerQuery) ||
            note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    },

    /**
     * Get notes by tag
     */
    getNotesByTag: (tag) => {
        const notes = getStoredNotes();
        return notes.filter(note => note.tags.includes(tag));
    },

    /**
     * Get all tags
     */
    getAllTags: () => {
        const notes = getStoredNotes();
        const allTags = notes.flatMap(note => note.tags);
        return [...new Set(allTags)];
    },

    /**
     * Duplicate a note
     */
    duplicateNote: (noteId) => {
        const note = notesService.getNote(noteId);
        if (!note) return null;

        return notesService.createNote(
            `${note.title} (Copy)`,
            note.content
        );
    },

    /**
     * Export note as text file
     */
    exportNote: (noteId) => {
        const note = notesService.getNote(noteId);
        if (!note) return null;

        const content = `# ${note.title}\n\n${note.content}\n\n---\nCreated: ${note.createdAt}\nUpdated: ${note.updatedAt}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
        a.click();

        URL.revokeObjectURL(url);
        return true;
    },

    /**
     * Export all notes as JSON
     */
    exportAllNotes: () => {
        const notes = getStoredNotes();
        const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `roolts_notes_${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
        return true;
    },

    /**
     * Import notes from JSON
     */
    importNotes: (jsonString) => {
        try {
            const importedNotes = JSON.parse(jsonString);
            if (!Array.isArray(importedNotes)) {
                throw new Error('Invalid notes format');
            }

            const currentNotes = getStoredNotes();
            const existingIds = new Set(currentNotes.map(n => n.id));

            // Filter out duplicates and regenerate IDs
            const newNotes = importedNotes.map(note => ({
                ...note,
                id: existingIds.has(note.id) ? generateId() : note.id
            }));

            saveNotes([...currentNotes, ...newNotes]);
            return newNotes.length;
        } catch (error) {
            console.error('Failed to import notes:', error);
            return null;
        }
    },

    /**
     * Create quick note from code snippet
     */
    createFromCode: (code, language, fileName) => {
        const title = `Code: ${fileName || language || 'Snippet'}`;
        const content = `\`\`\`${language || ''}\n${code}\n\`\`\``;
        return notesService.createNote(title, content);
    },

    /**
     * Get recent notes (last 5)
     */
    getRecentNotes: () => {
        const notes = getStoredNotes();
        return notes
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 5);
    },

    /**
     * Get pinned notes
     */
    getPinnedNotes: () => {
        const notes = getStoredNotes();
        return notes.filter(note => note.pinned);
    },

    /**
     * Clear all notes
     */
    clearAllNotes: () => {
        localStorage.removeItem(NOTES_STORAGE_KEY);
        return true;
    }
};

export default notesService;
