import React, { useState, useEffect, useCallback } from 'react';
import {
    FiChevronLeft, FiSearch, FiPackage, FiDownload,
    FiExternalLink, FiCheckCircle, FiInfo, FiActivity,
    FiStar, FiLayers, FiCheck, FiPlay, FiSettings,
    FiX, FiTerminal, FiCpu
} from 'react-icons/fi';
import { VscExtensions } from 'react-icons/vsc';
import { useUIStore, useExtensionStore, useExecutionStore, useFileStore } from '../../store';
import api from '../../services/api';
import { executorService } from '../../services/executorService';


/**
 * Extension Marketplace Component
 * A robust interface to browse, install, and integrate VS Code extensions.
 */
const VSCodeApp = ({ onBack }) => {
    const { addNotification } = useUIStore();
    const { installedExtensions, installExtension, uninstallExtension, isInstalled } = useExtensionStore();
    const { setCompilerStatus, setExecuting, setOutput, setError, setExecutionTime, setShowOutput, addToHistory } = useExecutionStore();
    const isExecuting = useExecutionStore(state => state.isExecuting);
    const executionOutput = useExecutionStore(state => state.output);
    const executionError = useExecutionStore(state => state.error);
    const executionTime = useExecutionStore(state => state.executionTime);
    const { files, activeFileId } = useFileStore();
    const activeFile = files.find(f => f.id === activeFileId);


    const [activeTab, setActiveTab] = useState('explore');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
    const [compilerOutput, setCompilerOutput] = useState(null);
    const [stdin, setStdin] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [languages, setLanguages] = useState([]);
    const [isLanguagesLoading, setIsLanguagesLoading] = useState(false);

    const fetchLanguages = useCallback(async () => {
        setIsLanguagesLoading(true);
        try {
            const data = await executorService.getLanguages();
            setLanguages(data);
        } catch (error) {
            console.error('Failed to load languages:', error);
            addNotification({ type: 'error', message: 'Failed to fetch language runtimes status' });
        } finally {
            setIsLanguagesLoading(false);
        }
    }, [addNotification]);

    useEffect(() => {
        if (activeTab === 'compiler') {
            fetchLanguages();
        }
    }, [activeTab, fetchLanguages]);


    const RECOMMENDED_IDS = [
        { id: 'ms-python.python', name: 'python', namespace: 'ms-python', displayName: 'Python', description: 'Rich support for the Python language with extension access points for IntelliSense, debugging, and more.', iconUrl: 'https://open-vsx.org/api/ms-python/python/2026.0.0/file/icon.png' },
        { id: 'ms-vscode.cpptools', name: 'cpptools', namespace: 'ms-vscode', displayName: 'C/C++', description: 'C/C++ IntelliSense, debugging, and browsing support for Roolts.', iconUrl: 'https://open-vsx.org/api/ms-vscode/cpptools/1.18.3/file/icon.png' },
        { id: 'dbaeumer.vscode-eslint', name: 'vscode-eslint', namespace: 'dbaeumer', displayName: 'ESLint', description: 'Integrates ESLint JavaScript into your development flow.', iconUrl: 'https://open-vsx.org/api/dbaeumer/vscode-eslint/2.4.2/file/icon.png' },
        { id: 'esbenp.prettier-vscode', name: 'prettier-vscode', namespace: 'esbenp', displayName: 'Prettier', description: 'Code formatter using Prettier for consistent code style.', iconUrl: 'https://open-vsx.org/api/esbenp/prettier-vscode/10.1.0/file/icon.png' }
    ];

    // Debounced search logic for 'explore' tab
    useEffect(() => {
        if (activeTab !== 'explore') return;
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim()) {
                fetchExtensions(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, activeTab]);

    const fetchExtensions = async (query) => {
        setIsLoading(true);
        console.log(`Searching marketplace for: ${query}`);
        try {
            const response = await api.get(`/extensions/search?query=${encodeURIComponent(query)}`);
            if (response.data && response.data.extensions) {
                setSearchResults(response.data.extensions);
            }
        } catch (error) {
            console.error('Error:', error);
            addNotification({ type: 'error', message: 'Marketplace search failed' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleInstall = async (ext) => {
        const id = `${ext.namespace}.${ext.name}`;
        setIsLoading(true);

        try {
            let installData = {
                downloadUrl: ext.files?.download || ext.downloadUrl,
                namespace: ext.namespace,
                name: ext.name
            };

            // If we're installing a recommended pick that doesn't have a downloadUrl yet
            if (!installData.downloadUrl) {
                console.log(`>>> downloadUrl missing, searching marketplace for info...`);
                try {
                    const searchRes = await api.get(`/extensions/search?query=${encodeURIComponent(id)}`);
                    const data = searchRes.data;
                    // Try exact match first, then loose match on name
                    let match = data.extensions?.find(e => `${e.namespace}.${e.name}` === id);
                    if (!match) {
                        match = data.extensions?.find(e =>
                            e.name.toLowerCase() === ext.name.toLowerCase() &&
                            e.namespace.toLowerCase() === ext.namespace.toLowerCase()
                        );
                    }

                    if (match?.files?.download) {
                        installData.downloadUrl = match.files.download;
                    } else if (match?.files?.package) {
                        installData.downloadUrl = match.files.package;
                    }
                } catch (err) {
                    console.error("Failed to fetch extension download URL details", err);
                }
            }

            if (!installData.downloadUrl) {
                throw new Error("Could not find download URL for extension");
            }

            // 1. Call backend to download and extract VSIX
            const response = await api.post('/extensions/install', installData);

            if (response.data.success) {
                const extData = response.data.data;
                const extensionData = {
                    id,
                    name: ext.name,
                    namespace: ext.namespace,
                    displayName: extData.displayName || ext.displayName || ext.name,
                    description: ext.description,
                    iconUrl: ext.files?.icon || ext.iconUrl,
                    version: extData.version || ext.version,
                    snippets: extData.snippets || [],
                    languages: extData.languages || []
                };

                installExtension(extensionData);

                // Compiler Integration Logic (Enhanced)
                const langMap = {
                    'python': 'python',
                    'javascript': 'javascript',
                    'js': 'javascript',
                    'java': 'java',
                    'cpp': 'cpp',
                    'c++': 'cpp',
                    'go': 'go',
                    'kotlin': 'kotlin',
                    'ruby': 'ruby',
                    'csharp': 'csharp'
                };

                for (const [key, value] of Object.entries(langMap)) {
                    if (id.toLowerCase().includes(key)) {
                        setCompilerStatus(value, {
                            available: true,
                            version: extensionData.version || 'vsixtracted',
                            source: 'extension'
                        });
                        break;
                    }
                }

                addNotification({ type: 'success', message: `Successfully installed ${extensionData.displayName}` });

                // Trigger global refresh for editor
                window.dispatchEvent(new CustomEvent('extension-installed', { detail: { id } }));
            } else {
                addNotification({ type: 'error', message: `Failed to install extension: ${response.data.error}` });
            }
        } catch (error) {
            console.error('Installation failed:', error);
            addNotification({ type: 'error', message: `Installation failed: ${error.message}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUninstall = (id) => {
        const ext = installedExtensions.find(e => e.id === id);
        uninstallExtension(id);

        // Cleanup Compiler Integration
        if (id.includes('python')) {
            setCompilerStatus('python', { available: null, version: null });
        }

        addNotification({ type: 'info', message: `Removed ${ext?.displayName || id}` });
    };

    const testCompiler = async (lang) => {
        addNotification({ type: 'info', message: `Testing compiler integration for ${lang}...` });

        // Map common extension/display names to executor language IDs
        const langMap = {
            'python': 'python',
            'javascript': 'javascript',
            'js': 'javascript',
            'java': 'java',
            'c++': 'cpp',
            'cpp': 'cpp',
            'c': 'c',
            'go': 'go',
            'ruby': 'ruby',
            'kotlin': 'kotlin',
            'c#': 'csharp',
            'csharp': 'csharp'
        };

        const execLang = Object.entries(langMap).find(([key]) => lang.toLowerCase().includes(key))?.[1] || lang.toLowerCase();

        let testCode = '';
        switch (execLang) {
            case 'python': testCode = 'print("Compiler test: OK")'; break;
            case 'javascript': testCode = 'console.log("Compiler test: OK")'; break;
            case 'java': testCode = 'public class Test { public static void main(String[] args) { System.out.println("Compiler test: OK"); } }'; break;
            case 'cpp': testCode = '#include <iostream>\nint main() { std::cout << "Compiler test: OK" << std::endl; return 0; }'; break;
            case 'c': testCode = '#include <stdio.h>\nint main() { printf("Compiler test: OK\\n"); return 0; }'; break;
            case 'go': testCode = 'package main\nimport "fmt"\nfunc main() { fmt.Println("Compiler test: OK") }'; break;
            case 'kotlin': testCode = 'fun main() { println("Compiler test: OK") }'; break;
            case 'csharp': testCode = 'using System; class Program { static void Main() { Console.WriteLine("Compiler test: OK"); } }'; break;
            case 'ruby': testCode = 'puts "Compiler test: OK"'; break;
            default: testCode = 'console.log("Compiler test: OK")';
        }

        const filename = `test.${execLang === 'python' ? 'py' : execLang === 'java' ? 'java' : execLang === 'cpp' ? 'cpp' : execLang === 'kotlin' ? 'kt' : execLang === 'csharp' ? 'cs' : execLang === 'ruby' ? 'rb' : execLang === 'go' ? 'go' : 'js'}`;

        setExecuting(true);
        setOutput('');
        setError(null);
        const startTime = Date.now();

        try {
            const result = await executorService.execute(testCode, execLang, filename);
            setExecutionTime(Date.now() - startTime);
            setShowOutput(true);

            if (result.success) {
                setOutput(result.output || 'Compiler test: OK');
                addNotification({ type: 'success', message: `${lang} compiler is working!` });
            } else {
                setError(result.error);
                addNotification({ type: 'error', message: `${lang} compiler test failed` });
            }
        } catch (error) {
            setError(error.message);
            addNotification({ type: 'error', message: `Test execution failed: ${error.message}` });
        } finally {
            setExecuting(false);
        }
    };

    // ── Open Web Preview for HTML/CSS/JS ──
    const openWebPreview = (content, lang) => {
        const allFiles = useFileStore.getState().files;
        let htmlContent = '';

        if (lang === 'html') {
            // Start with the HTML file's content
            htmlContent = content;

            // Auto-inject linked CSS and JS from project files
            const cssFiles = allFiles.filter(f => f.language === 'css' && f.id !== activeFile.id);
            const jsFiles = allFiles.filter(f => (f.language === 'javascript' || f.language === 'js') && f.id !== activeFile.id);

            // Inject CSS before </head> or at the top
            if (cssFiles.length > 0) {
                const cssBlock = cssFiles.map(f => `<style>/* ${f.name || 'style.css'} */\n${f.content}</style>`).join('\n');
                if (htmlContent.includes('</head>')) {
                    htmlContent = htmlContent.replace('</head>', cssBlock + '\n</head>');
                } else {
                    htmlContent = cssBlock + '\n' + htmlContent;
                }
            }

            // Inject JS before </body> or at the end
            if (jsFiles.length > 0) {
                const jsBlock = jsFiles.map(f => `<script>/* ${f.name || 'script.js'} */\n${f.content}</script>`).join('\n');
                if (htmlContent.includes('</body>')) {
                    htmlContent = htmlContent.replace('</body>', jsBlock + '\n</body>');
                } else {
                    htmlContent = htmlContent + '\n' + jsBlock;
                }
            }
        } else if (lang === 'css') {
            htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CSS Preview</title><style>${content}</style></head><body><h1>CSS Preview</h1><p>This is a preview of your CSS styles.</p><div class="container"><div class="box">Box 1</div><div class="box">Box 2</div><div class="box">Box 3</div></div></body></html>`;
        } else if (lang === 'javascript' || lang === 'js') {
            // For standalone JS, wrap in HTML with a console output panel
            htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>JS Preview</title><style>
body{font-family:monospace;background:#1e1e1e;color:#d4d4d4;margin:0;padding:20px}
#console{white-space:pre-wrap;padding:16px;background:#0d0d0d;border-radius:8px;min-height:200px;border:1px solid #333}
h3{color:#569cd6}
.log{color:#d4d4d4}.error{color:#f44747}.warn{color:#dcdcaa}
</style></head><body><h3>▶ JavaScript Console Output</h3><div id="console"></div><script>
(function(){
  const c=document.getElementById('console');
  function out(cls,args){const d=document.createElement('div');d.className=cls;d.textContent=[...args].map(a=>typeof a==='object'?JSON.stringify(a,null,2):String(a)).join(' ');c.appendChild(d)}
  console.log=(...a)=>out('log',a);
  console.error=(...a)=>out('error',a);
  console.warn=(...a)=>out('warn',a);
  window.onerror=(m,s,l,c,e)=>{out('error',['Error: '+m+' (line '+l+')']);return true};
})();
</script><script>${content}</script></body></html>`;
        }

        // Open in a new popup window
        const previewWindow = window.open('', '_blank', 'width=900,height=700,menubar=no,toolbar=no,location=no,status=no');
        if (previewWindow) {
            previewWindow.document.open();
            previewWindow.document.write(htmlContent);
            previewWindow.document.close();
            previewWindow.document.title = `Preview: ${activeFile.name || 'Untitled'}`;
        }
    };

    // Run the active editor file
    const runActiveFile = async () => {
        if (!activeFile || !activeFile.content) {
            addNotification({ type: 'error', message: 'No active file to run. Open a file in the editor first.' });
            return;
        }

        const lang = activeFile.language?.toLowerCase() || 'python';
        const filename = activeFile.name || 'script.py';

        // Web languages → open in preview window instead of backend executor
        if (['html', 'css', 'javascript', 'js'].includes(lang)) {
            openWebPreview(activeFile.content, lang);
            addNotification({ type: 'success', message: `Opened ${filename} in preview window` });
            return;
        }

        setExecuting(true);
        setCompilerOutput(null);
        const startTime = Date.now();

        try {
            const result = await executorService.executeWithProject(activeFile.content, lang, filename, stdin);
            const elapsed = Date.now() - startTime;
            setExecutionTime(elapsed);

            setCompilerOutput({
                success: result.success,
                output: result.output || '',
                error: result.error || '',
                time: elapsed,
                language: lang,
                filename: filename
            });

            if (result.success) {
                setOutput(result.output || 'Program executed successfully.');
                addNotification({ type: 'success', message: `${filename} executed successfully (${elapsed}ms)` });
            } else {
                setError(result.error);
                addNotification({ type: 'error', message: `Execution failed for ${filename}` });
            }

            addToHistory({ language: lang, filename, success: result.success });
        } catch (error) {
            setCompilerOutput({
                success: false,
                output: '',
                error: error.message,
                time: Date.now() - startTime,
                language: lang,
                filename: filename
            });
            setError(error.message);
            addNotification({ type: 'error', message: `Execution error: ${error.message}` });
        } finally {
            setExecuting(false);
        }
    };


    // Custom Context Menu logic
    const handleContextMenu = useCallback((e) => {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
            e.preventDefault();
            setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
        } else {
            setContextMenu({ visible: false, x: 0, y: 0 });
        }
    }, []);

    const removeHighlight = () => {
        window.getSelection().removeAllRanges();
        setContextMenu({ visible: false, x: 0, y: 0 });
        addNotification({ type: 'info', message: 'Highlight removed' });
    };

    useEffect(() => {
        const hideMenu = () => setContextMenu({ visible: false, x: 0, y: 0 });
        window.addEventListener('click', hideMenu);
        return () => window.removeEventListener('click', hideMenu);
    }, []);

    // Sync compilers on mount based on installed extensions
    useEffect(() => {
        installedExtensions.forEach(ext => {
            const id = ext.id;
            if (id.includes('python')) {
                setCompilerStatus('python', { available: true, version: ext.version || 'VSCode-Integrated', source: 'extension' });
            } else if (id.includes('cpp') || id.includes('c++')) {
                setCompilerStatus('cpp', { available: true, version: ext.version || 'VSCode-Integrated', source: 'extension' });
            }
        });
    }, []);



    const renderExtensionCard = (ext, isExplore = false) => {
        const id = isExplore ? `${ext.namespace}.${ext.name}` : ext.id;
        const installed = isInstalled(id);

        return (
            <div key={id} className={`marketplace-card ${installed ? 'marketplace-card--installed' : ''} marketplace-card-glass animate-fade-in-up`}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'start' }}>
                    <div className="marketplace-icon-box">
                        {(ext.files?.icon || ext.iconUrl) ? (
                            <img
                                src={ext.files?.icon || ext.iconUrl}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentNode.innerHTML = '<div style="color: #64748b"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></div>';
                                }}
                            />
                        ) : (
                            <FiPackage size={24} color="#64748b" />
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div className="marketplace-card__title" style={{ fontSize: '16px', color: '#f1f5f9', fontWeight: '700', fontFamily: 'var(--font-heading)' }}>{ext.displayName || ext.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: '500' }}>{ext.namespace}</div>
                    </div>
                    {installed && <div className="marketplace-badge marketplace-badge--verified pulse-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiCheck size={10} /> Installed</div>}
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '14px 0', height: '60px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {ext.description || "No description provided."}
                </p>

                <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
                    {installed ? (
                        <>
                            <button className="btn btn--secondary" style={{ flex: 1, borderRadius: '8px' }} onClick={() => handleUninstall(id)}>
                                Uninstall
                            </button>
                            {(id.includes('python') || id.includes('javascript') || id.includes('java') || id.includes('cpp') || id.includes('c++') || id.includes('go') || id.includes('dotnet') || id.includes('csharp')) && (
                                <button className="btn btn--primary glow-primary" style={{ flex: 1, borderRadius: '8px' }} onClick={() => testCompiler(id.split('.')[1] || id)}>
                                    <FiPlay size={14} /> Test
                                </button>
                            )}
                        </>
                    ) : (
                        <button className="btn btn--primary glow-primary" style={{ width: '101%', borderRadius: '8px' }} onClick={() => handleInstall(ext)}>
                            <FiDownload size={14} /> Put in program
                        </button>
                    )}
                </div>
            </div>

        );
    };

    return (
        <div className="marketplace-container" onContextMenu={handleContextMenu}>
            {/* Compact Tab Bar (replaces heavy sidebar) */}
            <div className="ext-tab-bar">
                <div className="ext-tab-bar-left">
                    <button className="btn btn--ghost btn--icon" onClick={onBack} title="Back to Apps" style={{ marginRight: '4px' }}>
                        <FiChevronLeft size={16} />
                    </button>
                    <VscExtensions size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span className="ext-tab-bar-title">Extensions</span>
                </div>
                <div className="ext-tab-bar-tabs">
                    <button className={`ext-tab ${activeTab === 'compiler' ? 'ext-tab--active' : ''}`} onClick={() => setActiveTab('compiler')}>
                        <FiCpu size={13} /> Compiler
                    </button>
                    <button className={`ext-tab ${activeTab === 'explore' ? 'ext-tab--active' : ''}`} onClick={() => setActiveTab('explore')}>
                        <FiSearch size={13} /> Explore
                    </button>
                    <button className={`ext-tab ${activeTab === 'recommended' ? 'ext-tab--active' : ''}`} onClick={() => setActiveTab('recommended')}>
                        <FiStar size={13} /> Picks
                    </button>
                    <button className={`ext-tab ${activeTab === 'installed' ? 'ext-tab--active' : ''}`} onClick={() => setActiveTab('installed')}>
                        <FiLayers size={13} /> Installed ({installedExtensions.length})
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="ext-header">
                    <div style={{ flex: 1 }}>
                        <h2 className="ext-header-title">
                            {activeTab === 'compiler' && 'Compiler'}
                            {activeTab === 'explore' && 'Discover Extensions'}
                            {activeTab === 'recommended' && 'Expert Picks'}
                            {activeTab === 'installed' && 'My Extensions'}
                        </h2>
                        <p className="ext-header-subtitle">
                            {activeTab === 'compiler' && 'Run and test your code directly.'}
                            {activeTab === 'explore' && 'Power up your development.'}
                            {activeTab === 'recommended' && 'Vetted for peak productivity.'}
                            {activeTab === 'installed' && 'Manage your IDE customizations.'}
                        </p>
                    </div>

                    {activeTab === 'compiler' && activeFile && (
                        <button
                            className="btn btn--primary glow-primary"
                            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', flexShrink: 0 }}
                            onClick={runActiveFile}
                            disabled={isExecuting}
                        >
                            <FiPlay size={14} /> {isExecuting ? 'Running...' : 'Run Code'}
                        </button>
                    )}

                    {activeTab === 'explore' && (
                        <div style={{ position: 'relative', width: '100%', maxWidth: '280px', flexShrink: 0 }}>
                            <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} size={14} />
                            <input
                                className="input"
                                style={{ paddingLeft: '32px', paddingRight: searchQuery ? '32px' : '10px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', fontSize: '12px' }}
                                placeholder="Search extensions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                    <FiX size={14} />
                                </button>
                            )}
                        </div>
                    )}

                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} className="scrollbar-hide">
                    {/* Compiler Tab */}
                    {activeTab === 'compiler' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Active File Info */}
                            {activeFile ? (
                                <div className="marketplace-card marketplace-card-glass animate-fade-in-up" style={{ padding: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', fontWeight: '700' }}>
                                            {executorService.getLanguageIcon(activeFile.language || 'python')}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9' }}>{activeFile.name}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Language: {activeFile.language || 'unknown'} • {activeFile.content?.split('\n').length || 0} lines</div>
                                        </div>
                                        <button
                                            className="btn btn--primary glow-primary"
                                            style={{ padding: '10px 24px', borderRadius: '10px' }}
                                            onClick={runActiveFile}
                                            disabled={isExecuting}
                                        >
                                            <FiPlay size={16} /> {isExecuting ? 'Running...' : 'Run'}
                                        </button>
                                    </div>

                                    {/* Code Preview */}
                                    <div style={{
                                        background: '#0d1117',
                                        borderRadius: '10px',
                                        padding: '16px',
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                        fontSize: '12px',
                                        lineHeight: '1.6',
                                        color: '#e6edf3',
                                        whiteSpace: 'pre-wrap',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        {activeFile.content?.substring(0, 1500) || '// Empty file'}
                                        {activeFile.content?.length > 1500 && '\n...'}
                                    </div>

                                    {/* Runtime Input (Stdin) */}
                                    <div style={{ marginTop: '16px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <FiTerminal size={12} /> Standard Input (stdin)
                                        </div>
                                        <textarea
                                            className="input"
                                            value={stdin}
                                            onChange={(e) => setStdin(e.target.value)}
                                            placeholder="Enter input for your program here..."
                                            style={{
                                                width: '100%',
                                                minHeight: '80px',
                                                padding: '12px',
                                                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                                fontSize: '13px',
                                                background: 'rgba(0,0,0,0.2)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                color: 'var(--text-primary)',
                                                resize: 'vertical'
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '80px 20px', opacity: 0.5 }}>
                                    <FiTerminal size={48} style={{ marginBottom: '16px' }} />
                                    <p style={{ fontSize: '16px' }}>No file open</p>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Open a file in the editor to compile and run it.</p>
                                </div>
                            )}

                            {/* Execution Output */}
                            {compilerOutput && (
                                <div className="marketplace-card marketplace-card-glass animate-fade-in-up" style={{ padding: '0', overflow: 'hidden' }}>
                                    <div style={{
                                        padding: '14px 20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        background: compilerOutput.success ? 'rgba(63, 185, 80, 0.08)' : 'rgba(248, 81, 73, 0.08)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <FiTerminal style={{ color: compilerOutput.success ? '#3fb950' : '#f85149' }} />
                                            <span style={{ fontWeight: '600', fontSize: '14px' }}>Output</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{compilerOutput.filename} • {compilerOutput.time}ms</span>
                                        </div>
                                        {compilerOutput.success ? (
                                            <span style={{ fontSize: '12px', color: '#3fb950', fontWeight: '600' }}>✓ Success</span>
                                        ) : (
                                            <span style={{ fontSize: '12px', color: '#f85149', fontWeight: '600' }}>✗ Failed</span>
                                        )}
                                    </div>
                                    <div style={{
                                        padding: '16px 20px',
                                        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                        fontSize: '13px',
                                        lineHeight: '1.6',
                                        background: '#0d1117',
                                        color: '#e6edf3',
                                        whiteSpace: 'pre-wrap',
                                        maxHeight: '300px',
                                        overflowY: 'auto',
                                        minHeight: '60px'
                                    }}>
                                        {compilerOutput.output && <div>{compilerOutput.output}</div>}
                                        {compilerOutput.error && <div style={{ color: '#ff7b72' }}>{compilerOutput.error}</div>}
                                        {!compilerOutput.output && !compilerOutput.error && <div style={{ opacity: 0.4 }}>No output</div>}
                                    </div>
                                </div>
                            )}

                            {/* Installed Compilers Status */}
                            <div className="marketplace-card marketplace-card-glass animate-fade-in-up" style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <FiCpu size={18} color="var(--accent-primary)" /> Local Runtimes Status
                                    </h3>
                                    <button
                                        className="btn btn--ghost"
                                        onClick={fetchLanguages}
                                        disabled={isLanguagesLoading}
                                        style={{ padding: '4px 8px', fontSize: '11px', height: 'auto' }}
                                    >
                                        {isLanguagesLoading ? 'Refreshing...' : 'Refresh Status'}
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                                    {(languages.length > 0 ? languages : [
                                        { id: 'python', name: 'Python', available: false },
                                        { id: 'javascript', name: 'JavaScript', available: false },
                                        { id: 'java', name: 'Java', available: false },
                                        { id: 'c', name: 'C', available: false },
                                        { id: 'cpp', name: 'C++', available: false },
                                        { id: 'go', name: 'Go', available: false },
                                        { id: 'kotlin', name: 'Kotlin', available: false },
                                        { id: 'csharp', name: 'C#', available: false },
                                        { id: 'ruby', name: 'Ruby', available: false }
                                    ]).map(lang => (
                                        <div key={lang.id} style={{
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '8px',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                            onClick={() => testCompiler(lang.name)}
                                            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                                            onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>{executorService.getLanguageIcon(lang.id)}</span>
                                                <span style={{ fontWeight: '500' }}>{lang.name}</span>
                                            </div>
                                            <div
                                                title={lang.runtime_status || (lang.available ? 'Ready' : 'Missing')}
                                                style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: lang.available ? (lang.type === 'system' ? '#3498db' : '#3fb950') : '#484f58',
                                                    boxShadow: lang.available ? `0 0 8px ${lang.type === 'system' ? 'rgba(52, 152, 219, 0.4)' : 'rgba(63, 185, 80, 0.4)'}` : 'none'
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3fb950' }} /> Portable Ready
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3498db' }} /> System Path
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#484f58' }} /> Not Found
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {activeTab === 'explore' && !searchQuery && (
                        <div className="marketplace-hero animate-fade-in-up">
                            <div className="marketplace-hero__content">
                                <span className="marketplace-hero__badge">Featured Extension</span>
                                <h1 className="marketplace-hero__title">Python for Roolts</h1>
                                <p className="marketplace-hero__subtitle">
                                    Full intelligence, linting, and debugging for Python.
                                    Integrated directly with the portable Roolts compiler for zero-setup development.
                                </p>
                                <button className="btn btn--primary" style={{ marginTop: '24px', padding: '12px 24px' }} onClick={() => handleInstall(RECOMMENDED_IDS[0])}>
                                    <FiDownload /> Install Now
                                </button>
                            </div>
                            <div style={{ position: 'absolute', right: '-20px', top: '50%', transform: 'translateY(-50%) rotate(5deg)', opacity: 0.2 }}>
                                <img src={RECOMMENDED_IDS[0].iconUrl} alt="" style={{ width: '280px', height: '280px' }} />
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }} className="staggered-list">
                        {activeTab === 'explore' ? (
                            isLoading ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px' }}>
                                    <div className="loader"></div>
                                    <p style={{ color: 'var(--text-secondary)', marginTop: '20px' }}>Querying Open VSX Registry...</p>
                                </div>
                            ) : searchResults.length > 0 ? (
                                searchResults.map(ext => renderExtensionCard(ext, true))
                            ) : (
                                !searchQuery ? (
                                    RECOMMENDED_IDS.map(ext => renderExtensionCard(ext))
                                ) : (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                                        <FiSearch size={48} style={{ marginBottom: '16px' }} />
                                        <p>No extensions found for "{searchQuery}"</p>
                                    </div>
                                )
                            )
                        ) : activeTab === 'recommended' ? (
                            RECOMMENDED_IDS.map(ext => renderExtensionCard(ext))
                        ) : activeTab === 'installed' ? (
                            installedExtensions.length > 0 ? (
                                installedExtensions.map(ext => renderExtensionCard(ext))
                            ) : (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                                    <FiLayers size={48} style={{ marginBottom: '16px' }} />
                                    <p>No extensions installed yet.</p>
                                </div>
                            )
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu.visible && (
                <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '6px', zIndex: 1000, boxShadow: 'var(--shadow-lg)', minWidth: '180px' }}>
                    <div className="btn btn--ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={removeHighlight}>
                        <FiActivity size={14} /> Remove Highlight
                    </div>
                </div>
            )}

            <style>{`
                .marketplace-container {
                    display: flex; flex-direction: column; height: 100%; overflow: hidden;
                }
                .ext-tab-bar {
                    display: flex; align-items: center; gap: 8px;
                    padding: 8px 12px; border-bottom: 1px solid var(--border-primary);
                    background: var(--bg-secondary); flex-shrink: 0; flex-wrap: wrap;
                }
                .ext-tab-bar-left {
                    display: flex; align-items: center; gap: 6px;
                }
                .ext-tab-bar-title {
                    font-weight: 700; font-size: 14px; font-family: var(--font-heading);
                }
                .ext-tab-bar-tabs {
                    display: flex; gap: 2px; flex: 1; flex-wrap: wrap;
                }
                .ext-tab {
                    display: flex; align-items: center; gap: 4px;
                    padding: 5px 10px; border-radius: 6px;
                    background: transparent; border: none;
                    color: var(--text-secondary); font-size: 12px;
                    cursor: pointer; transition: all 0.15s; font-family: var(--font-body);
                    white-space: nowrap;
                }
                .ext-tab:hover { background: var(--bg-tertiary); color: var(--text-primary); }
                .ext-tab--active {
                    background: rgba(var(--accent-primary-rgb), 0.12);
                    color: var(--accent-primary); font-weight: 600;
                }
                .ext-header {
                    padding: 16px 16px 12px; border-bottom: 1px solid var(--border-primary);
                    display: flex; justify-content: space-between; align-items: center;
                    background: var(--bg-secondary); gap: 12px; flex-wrap: wrap; flex-shrink: 0;
                }
                .ext-header-title {
                    font-size: 18px; font-weight: 700; margin: 0; font-family: var(--font-heading);
                }
                .ext-header-subtitle {
                    color: var(--text-secondary); font-size: 12px; margin-top: 2px;
                }
                .marketplace-icon-box {
                    width: 44px; height: 44px; border-radius: 10px;
                    background: rgba(255,255,255,0.03); display: flex;
                    align-items: center; justify-content: center; overflow: hidden;
                    flex-shrink: 0;
                }
                .marketplace-card {
                    padding: 16px; border-radius: 12px;
                    background: rgba(255,255,255,0.02); border: 1px solid var(--border-primary);
                    transition: all 0.2s ease;
                }
                .marketplace-card:hover {
                    border-color: rgba(var(--accent-primary-rgb), 0.3);
                    background: rgba(var(--accent-primary-rgb), 0.03);
                }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .loader { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid var(--accent-primary); border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite; margin: 0 auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default VSCodeApp;

