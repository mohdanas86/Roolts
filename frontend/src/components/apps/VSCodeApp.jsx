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


    const [activeTab, setActiveTab] = useState('explore'); // explore, recommended, installed, compiler
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
    const [compilerOutput, setCompilerOutput] = useState(null);
    const [stdin, setStdin] = useState('');

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
            const response = await fetch(`/api/extensions/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Marketplace connection failed');
            const data = await response.json();
            if (data.extensions) {
                setSearchResults(data.extensions);
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
                const searchRes = await fetch(`/api/extensions/search?query=${encodeURIComponent(id)}`);
                if (searchRes.ok) {
                    const data = await searchRes.json();
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

    // Run the active editor file
    const runActiveFile = async () => {
        if (!activeFile || !activeFile.content) {
            addNotification({ type: 'error', message: 'No active file to run. Open a file in the editor first.' });
            return;
        }

        const lang = activeFile.language?.toLowerCase() || 'python';
        const filename = activeFile.name || 'script.py';

        setExecuting(true);
        setCompilerOutput(null);
        const startTime = Date.now();

        try {
            const result = await executorService.execute(activeFile.content, lang, filename, stdin);
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
            {/* Sidebar Navigation */}
            <div className="sidebar" style={{ width: '260px' }}>
                <div style={{ padding: '0 24px 32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'var(--accent-gradient)', padding: '8px', borderRadius: '10px' }}>
                        <VscExtensions size={24} color="white" />
                    </div>
                    <span style={{ fontWeight: '800', fontSize: '18px', letterSpacing: '-0.025em', fontFamily: 'var(--font-heading)' }}>Marketplace</span>
                </div>

                <div className={`panel-tab ${activeTab === 'compiler' ? 'panel-tab--active' : ''}`} style={{ justifyContent: 'flex-start', paddingLeft: '24px' }} onClick={() => setActiveTab('compiler')}>
                    <FiCpu size={18} /> Compiler
                </div>
                <div className={`panel-tab ${activeTab === 'explore' ? 'panel-tab--active' : ''}`} style={{ justifyContent: 'flex-start', paddingLeft: '24px' }} onClick={() => setActiveTab('explore')}>
                    <FiSearch size={18} /> Explore
                </div>
                <div className={`panel-tab ${activeTab === 'recommended' ? 'panel-tab--active' : ''}`} style={{ justifyContent: 'flex-start', paddingLeft: '24px' }} onClick={() => setActiveTab('recommended')}>
                    <FiStar size={18} /> Recommended
                </div>
                <div className={`panel-tab ${activeTab === 'installed' ? 'panel-tab--active' : ''}`} style={{ justifyContent: 'flex-start', paddingLeft: '24px' }} onClick={() => setActiveTab('installed')}>
                    <FiLayers size={18} /> Installed ({installedExtensions.length})
                </div>

                <div style={{ marginTop: 'auto', padding: '24px' }}>
                    <button className="btn btn--secondary" style={{ width: '100%' }} onClick={onBack}>
                        <FiChevronLeft /> Exit
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '32px 40px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                    <div>
                        <h2 style={{ fontSize: '28px', fontWeight: '800', margin: 0, fontFamily: 'var(--font-heading)' }}>
                            {activeTab === 'compiler' && 'Compiler'}
                            {activeTab === 'explore' && 'Discover Extensions'}
                            {activeTab === 'recommended' && 'Expert Picks'}
                            {activeTab === 'installed' && 'My Extensions'}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                            {activeTab === 'compiler' && 'Run and test your code directly.'}
                            {activeTab === 'explore' && 'Power up your development with premium extensions.'}
                            {activeTab === 'recommended' && 'Essential tools vetted for peak productivity.'}
                            {activeTab === 'installed' && 'Manage your IDE customizations.'}
                        </p>
                    </div>

                    {activeTab === 'compiler' && activeFile && (
                        <button
                            className="btn btn--primary glow-primary"
                            style={{ padding: '12px 28px', borderRadius: '12px', fontSize: '15px', fontWeight: '600' }}
                            onClick={runActiveFile}
                            disabled={isExecuting}
                        >
                            <FiPlay size={16} /> {isExecuting ? 'Running...' : 'Run Code'}
                        </button>
                    )}

                    {activeTab === 'explore' && (
                        <div style={{ position: 'relative', width: '320px' }}>
                            <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                className="input"
                                style={{ paddingLeft: '40px', paddingRight: searchQuery ? '40px' : '12px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}
                                placeholder="Search extensions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                    <FiX size={16} />
                                </button>
                            )}
                        </div>
                    )}

                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }} className="scrollbar-hide">
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
                                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FiCpu size={18} color="var(--accent-primary)" /> Supported Languages
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                                    {['Python', 'JavaScript', 'Java', 'C', 'C++', 'Go', 'Kotlin', 'C#', 'Ruby'].map(lang => (
                                        <div key={lang} style={{
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                            onClick={() => testCompiler(lang)}
                                            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                                            onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                                        >
                                            <span>{executorService.getLanguageIcon(lang.toLowerCase())}</span>
                                            <span>{lang}</span>
                                        </div>
                                    ))}
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }} className="staggered-list">
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
                .marketplace-icon-box {
                    width: 52px; height: 52px; border-radius: 12px;
                    background: rgba(255,255,255,0.03); display: flex;
                    align-items: center; justify-content: center; overflow: hidden;
                }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .loader { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid var(--accent-primary); border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite; margin: 0 auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default VSCodeApp;

