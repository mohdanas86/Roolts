import { useEffect } from 'react';
import { useFileStore, useSettingsStore, useTerminalStore } from '../store';

/**
 * SyncManager Component
 * 
 * Listens for 'storage' events on the window object.
 * When a persisted store key changes in localStorage (due to another tab),
 * it forces the corresponding Zustand store to rehydrate.
 * 
 * This ensures "Everything Everywhere" - changes in one tab immediately reflect in others.
 */
const SyncManager = () => {
    useEffect(() => {
        const handleStorage = (e) => {
            // Only care about our app's storage keys
            if (!e.key) return;

            if (e.key === 'roolts-files-storage') {
                useFileStore.persist?.rehydrate?.();
            } else if (e.key === 'roolts-settings-storage') {
                useSettingsStore.persist?.rehydrate?.();
            } else if (e.key === 'roolts-github-storage') {

            } else if (e.key === 'roolts-terminal-storage') {
                useTerminalStore.persist?.rehydrate?.();
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return null; // Renderless component
};

export default SyncManager;
