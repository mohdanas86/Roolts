import React, { useState } from 'react';
import { FiX, FiPlus } from 'react-icons/fi';
import { useUIStore, useFileStore } from '../store';
import { getFileIcon } from '../services/iconHelper.jsx';

function NewFileModal({ initialPath = '' }) {
    const { modals, closeModal, addNotification } = useUIStore();
    const { addFile } = useFileStore();
    const [fileName, setFileName] = useState(''); // Just the name, logic will prepend path
    const [language, setLanguage] = useState('javascript');
    const [isManualSelection, setIsManualSelection] = useState(false);

    // If initialPath is provided via some store or prop? 
    // actually NewFileModal is lazy loaded and likely doesn't receive props from App.jsx's Suspense easily unless passed.
    // However, it's rendered in App.jsx: <NewFileModal />. 
    // We should probably rely on a store or pass props if we can.
    // Better: useUIStore's openModal can pass data? 
    // "openModal('newFile', { path: '/src' })"

    // Let's check useUIStore in store/index.js if openModal accepts data.
    // Assuming standard zustand pattern, we might need to peek at store/index.js first to be sure.
    // But for now, let's assume we can get data from the modal state if we update the store.

    // changing plan: I'll read store/index.js first to see how modals are handled.
    if (!modals.newFile) return null;

    // extraction:
    const modalData = modals.newFile === true ? {} : modals.newFile; // handle bool or object
    const folderPath = modalData?.path || '';

    const extensionMap = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'javascript',
        'tsx': 'javascript',
        'py': 'python',
        'java': 'java',
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'json': 'json',
        'txt': 'plaintext',
        'md': 'plaintext',
        'c': 'c',
        'cpp': 'cpp',
        'cc': 'cpp',
        'cxx': 'cpp',
        'go': 'go',
        'kt': 'kotlin',
        'cs': 'csharp',
        'rb': 'ruby'
    };

    const handleFileNameChange = (e) => {
        const value = e.target.value;
        setFileName(value);

        if (!isManualSelection) {
            const ext = value.split('.').pop().toLowerCase();
            if (extensionMap[ext]) {
                setLanguage(extensionMap[ext]);
            }
        }
    };

    const handleLanguageChange = (e) => {
        setLanguage(e.target.value);
        setIsManualSelection(true);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleCreate();
        }
    };

    const handleCreate = () => {
        if (fileName.trim()) {
            const defaultTemplates = {
                python: 'def main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n',
                javascript: 'console.log("Hello, World!");\n',
                java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
                c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
                cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
                go: 'package main\n\nimport "fmt"\n\nint main() {\n    fmt.Println("Hello, World!")\n}\n',
                html: '<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>\n',
                kotlin: 'fun main() {\n    println("Hello, World!")\n}\n',
                csharp: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}\n',
                ruby: 'puts "Hello, World!"\n'
            };

            const content = defaultTemplates[language.toLowerCase()] || '';
            // Construct full path if folder is selected
            let finalName = fileName;
            // Clean up folderPath to avoid double slashes
            const cleanFolderPath = folderPath === '/' ? '' : folderPath;
            if (folderPath && !fileName.includes('/')) {
                // But wait, addFile logic in store usually takes just name and constructs /name or takes path?
                // Let's check store/index.js addFile
                // It takes (name, content, language). And constructs path = `/${name}`.
                // We need to modify addFile to accept a path or we need to pass a name that includes path?
                // Standard addFile implementation: path: `/${name}`.
                // If we pass "src/components/New.js" as name, path becomes "/src/components/New.js".
                // So we should prepend the path to the name.
                finalName = `${cleanFolderPath}/${fileName}`;
                if (finalName.startsWith('/')) finalName = finalName.substring(1); // Remove leading slash if present because addFile adds one?
                // store: path: `/${name}`. So if name is "src/foo.js", path is "/src/foo.js". Correct.
            }

            const newFileId = addFile(finalName, content, language);
            if (!newFileId) {
                addNotification({ type: 'error', message: `File "${fileName}" already exists.` });
                return;
            }

            setFileName('');
            setLanguage('javascript');
            setIsManualSelection(false);
            closeModal('newFile');
        }
    };

    return (
        <div className="modal-overlay" onClick={() => closeModal('newFile')}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                    <h3 className="modal__title">Create New File</h3>
                    <button className="btn btn--ghost btn--icon" onClick={() => closeModal('newFile')}>
                        <FiX />
                    </button>
                </div>
                <div className="modal__body">
                    <label className="label">File Name</label>
                    <input
                        type="text"
                        className="input"
                        placeholder="e.g., app.js, main.py"
                        value={fileName}
                        onChange={handleFileNameChange}
                        onKeyDown={handleKeyDown}
                        style={{ marginBottom: '16px' }}
                        autoFocus
                    />

                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Language
                        <span style={{ marginLeft: 'auto' }}>{getFileIcon(language)}</span>
                    </label>
                    <select
                        className="input"
                        value={language}
                        onChange={handleLanguageChange}
                    >
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="html">HTML</option>
                        <option value="css">CSS</option>
                        <option value="json">JSON</option>
                        <option value="plaintext">Plain Text</option>
                        <option value="c">C</option>
                        <option value="cpp">C++</option>
                        <option value="go">Go</option>
                        <option value="kotlin">Kotlin</option>
                        <option value="csharp">C#</option>
                        <option value="ruby">Ruby</option>
                    </select>
                </div>
                <div className="modal__footer">
                    <button className="btn btn--secondary" onClick={() => {
                        setFileName('');
                        setLanguage('javascript');
                        setIsManualSelection(false);
                        closeModal('newFile');
                    }}>
                        Cancel
                    </button>
                    <button className="btn btn--primary" onClick={handleCreate}>
                        <FiPlus /> Create File
                    </button>
                </div>
            </div>
        </div>
    );
}

export default NewFileModal;
