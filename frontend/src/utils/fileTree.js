
/**
 * fileTree.js
 * Utility to convert flat file list to tree structure based on paths.
 */

export const buildFileTree = (files) => {
    const root = [];
    const map = {};

    // Helper to find or create folder
    const findFolder = (parentChildren, name) => {
        return parentChildren.find(item => item.type === 'folder' && item.name === name);
    };

    files.forEach(file => {
        // Clean path (remove leading slash)
        const pathParts = file.path.split('/').filter(p => p !== '');

        let currentLevel = root;

        // Iterate through path parts except the last one (filename)
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            let folder = findFolder(currentLevel, part);

            if (!folder) {
                folder = {
                    id: `folder-${part}-${i}`, // Simple ID generation
                    name: part,
                    type: 'folder',
                    children: [],
                    path: '/' + pathParts.slice(0, i + 1).join('/')
                };
                currentLevel.push(folder);
            }

            currentLevel = folder.children;
        }

        // Add file to the final level
        currentLevel.push({
            ...file,
            type: 'file'
        });
    });

    // Sort: Folders first, then files, alphabetical
    // DISABLED: To allow manual ordering (based on 'files' array order)
    /*
    const sortTree = (items) => {
        items.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'folder' ? -1 : 1;
        });
        items.forEach(item => {
            if (item.type === 'folder') {
                sortTree(item.children);
            }
        });
    };

    sortTree(root);
    */
    return root;
};
