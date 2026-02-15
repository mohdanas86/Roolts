import React, { useState, useEffect } from 'react';
import { FiSearch, FiDownload, FiCheck, FiCpu, FiAlertCircle, FiTrash2, FiExternalLink, FiBox, FiPlay } from 'react-icons/fi';
import { useExtensionStore, useUIStore, useExecutionStore } from '../store';
import { executorService } from '../services/executorService';
import api from '../services/api';

const ExtensionsPanel = () => {
    const { installedExtensions, installExtension, uninstallExtension, isInstalled } = useExtensionStore();
    const { addNotification } = useUIStore();
    const { setCompilerStatus, setExecuting, setOutput, setError, setExecutionTime, setShowOutput } = useExecutionStore();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('marketplace'); // 'marketplace' or 'installed'
    const [installingId, setInstallingId] = useState(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'marketplace' && query) {
                searchExtensions(query);
            } else if (activeTab === 'marketplace' && !query) {
                setResults([]); // Clear results if query is empty to show home
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [query, activeTab]);

    const searchExtensions = async (searchQuery) => {
        setLoading(true);
        try {
            const res = await api.get(`/extensions/search?query=${encodeURIComponent(searchQuery)}`);
            if (res.data && res.data.extensions) {
                setResults(res.data.extensions);
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error("Search failed:", error);
            addNotification({ type: 'error', message: "Marketplace search failed" });
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async (ext) => {
        const extId = ext.namespace + '.' + ext.name;
        if (isInstalled(extId)) return;

        setInstallingId(extId);
        addNotification({ type: 'info', message: `Starting installation of ${ext.displayName || ext.name}...` });

        try {
            let downloadUrl = ext.files?.download || ext.downloadUrl;

            // Fallback: If download URL is missing (common in search results), fetch from details
            if (!downloadUrl) {
                try {
                    const detailRes = await api.get(`/extensions/search?query=${extId}`);
                    const detailData = detailRes.data;
                    const match = detailData.extensions?.find(e => e.namespace === ext.namespace && e.name === ext.name);
                    if (match && match.files?.download) {
                        downloadUrl = match.files.download;
                    }
                } catch (err) {
                    console.warn("Failed to fetch extension details for download URL", err);
                }
            }

            if (!downloadUrl) {
                throw new Error("Could not find download URL for this extension. It may not be available in the registry.");
            }

            const res = await api.post('/extensions/install', {
                downloadUrl,
                namespace: ext.namespace,
                name: ext.name,
                version: ext.version
            });

            const data = res.data;

            if (data.success) {
                const newExt = {
                    id: data.data.id,
                    name: ext.name,
                    displayName: ext.displayName || ext.name,
                    namespace: ext.namespace,
                    version: ext.version,
                    description: ext.description,
                    iconUrl: ext.files?.icon || ext.iconUrl,
                    snippets: data.data.snippets,
                    languages: data.data.languages,
                    themes: data.data.themes
                };

                installExtension(newExt);

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

                const extId = (ext.namespace + '.' + ext.name).toLowerCase();
                for (const [key, value] of Object.entries(langMap)) {
                    if (extId.includes(key)) {
                        useExecutionStore.getState().setCompilerStatus(value, {
                            available: true,
                            version: newExt.version || 'vsixtracted',
                            source: 'extension'
                        });
                        break;
                    }
                }

                addNotification({ type: 'success', message: `Successfully installed ${newExt.displayName}` });
                window.dispatchEvent(new Event('extension-installed'));
            } else {
                throw new Error(data.error || 'Installation failed');
            }
        } catch (error) {
            console.error("Install failed:", error);
            const errMsg = error.response?.data?.error || error.message;
            addNotification({ type: 'error', message: `Failed to install: ${errMsg}` });
        } finally {
            setInstallingId(null);
        }
    };

    const handleUninstall = (id) => {
        uninstallExtension(id);
        addNotification({ type: 'info', message: 'Extension uninstalled. Reload may be required.' });
    };

    const expertPicks = [
        { namespace: 'ms-python', name: 'python', displayName: 'Python', description: 'IntelliSense (Pylance), Linting, Debugging (multi-threaded, remote), Jupyter Notebooks, code formatting, refactoring, unit tests, and more.', icon: 'https://raw.githubusercontent.com/microsoft/vscode-python/main/icon.png' },
        { namespace: 'ms-vscode', name: 'cpptools', displayName: 'C/C++', description: 'C/C++ IntelliSense, debugging, and code browsing.', icon: 'https://raw.githubusercontent.com/microsoft/vscode-cpptools/main/Extension/icon.png' },
        { namespace: 'golang', name: 'Go', displayName: 'Go', description: 'Rich Go language support for Visual Studio Code.', icon: 'https://raw.githubusercontent.com/golang/vscode-go/master/images/go-logo.png' },
        { namespace: 'esbenp', name: 'prettier-vscode', displayName: 'Prettier', description: 'Code formatter using prettier', icon: 'https://raw.githubusercontent.com/prettier/prettier-vscode/main/images/icon.png' },
        { namespace: 'dracula-theme', name: 'theme-dracula', displayName: 'Dracula Official', description: 'Official Dracula Theme. A dark theme for many editors, shells, and more.', icon: 'https://raw.githubusercontent.com/dracula/visual-studio-code/master/icon.png' }
    ];

    // Dummy recommended for now
    const recommended = [
        { namespace: 'dbaeumer', name: 'vscode-eslint', displayName: 'ESLint', description: 'Integrates ESLint JavaScript into VS Code.', icon: 'https://raw.githubusercontent.com/microsoft/vscode-eslint/main/images/icon.png' },
        { namespace: 'VisualStudioExptTeam', name: 'vscodeintellij', displayName: 'IntelliJ IDEA Keybindings', description: 'Port of IntelliJ IDEA keybindings config', icon: '' }
    ];

    const installExpertPick = async (pick) => {
        // Need to search for it first to get the download URL if we don't have it hardcoded
        // Or call search API internally
        setLoading(true);
        try {
            // Search by exact ID if possible or just query
            const res = await api.get(`/extensions/search?query=${pick.namespace}.${pick.name}`);
            const data = res.data;
            if (data.extensions && data.extensions.length > 0) {
                // Try to match exact
                const match = data.extensions.find(e => e.namespace === pick.namespace && e.name === pick.name) || data.extensions[0];
                await handleInstall(match);
            } else {
                addNotification({ type: 'error', message: 'Extension not found in registry' });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
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


    const renderExtensionCard = (ext, isInstalledExt = false) => {
        const extId = isInstalledExt ? ext.id : (ext.namespace + '.' + ext.name);
        const installed = isInstalled(extId);
        const isInstalling = installingId === extId;

        return (
            <div
                key={extId}
                style={{
                    padding: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.borderColor = 'rgba(0,152,255,0.3)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                {/* Gradient accent */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, #0098FF 0%, #8A2BE2 100%)',
                    opacity: 0.6
                }} />

                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    {/* Icon */}
                    {ext.files?.icon || ext.icon || ext.iconUrl ? (
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            flexShrink: 0,
                            background: 'rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <img
                                src={ext.files?.icon || ext.icon || ext.iconUrl}
                                alt={ext.name || ext.displayName}
                                style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                            />
                        </div>
                    ) : (
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: 'linear-gradient(135deg, rgba(0,152,255,0.2) 0%, rgba(138,43,226,0.2) 100%)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(0,152,255,0.3)',
                            flexShrink: 0
                        }}>
                            <FiBox size={28} style={{ color: '#0098FF' }} />
                        </div>
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{
                            margin: '0 0 6px 0',
                            fontSize: '15px',
                            fontWeight: '600',
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {ext.displayName || ext.name}
                        </h4>

                        <div style={{
                            fontSize: '12px',
                            color: 'rgba(255,255,255,0.5)',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}>
                            <span>{ext.namespace}</span>
                            {ext.version && (
                                <>
                                    <span>•</span>
                                    <span>v{ext.version}</span>
                                </>
                            )}
                        </div>

                        <p style={{
                            fontSize: '13px',
                            color: 'rgba(255,255,255,0.7)',
                            lineHeight: '1.5',
                            margin: '0 0 12px 0',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                        }}>
                            {ext.description}
                        </p>

                        {/* Action Button */}
                        <div>
                            {installed ? (
                                isInstalledExt ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleUninstall(ext.id);
                                        }}
                                        style={{
                                            padding: '6px 14px',
                                            background: 'transparent',
                                            border: '1px solid rgba(255,77,79,0.5)',
                                            borderRadius: '6px',
                                            color: '#ff4d4f',
                                            fontSize: '12px',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s',
                                            marginRight: (extId.includes('python') || extId.includes('javascript') || extId.includes('java') || extId.includes('cpp') || extId.includes('c++') || extId.includes('go') || extId.includes('kotlin') || extId.includes('ruby') || extId.includes('csharp') || extId.includes('dotnet')) ? '8px' : '0'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(255,77,79,0.1)';
                                            e.currentTarget.style.borderColor = '#ff4d4f';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.borderColor = 'rgba(255,77,79,0.5)';
                                        }}
                                    >
                                        <FiTrash2 size={14} /> Uninstall
                                    </button>
                                ) : (
                                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                                        <div style={{
                                            padding: '6px 14px',
                                            background: 'rgba(0,200,83,0.15)',
                                            border: '1px solid rgba(0,200,83,0.3)',
                                            borderRadius: '6px',
                                            color: '#00c853',
                                            fontSize: '12px',
                                            fontWeight: '500',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <FiCheck size={14} /> Installed
                                        </div>
                                        {(extId.includes('python') || extId.includes('javascript') || extId.includes('java') || extId.includes('cpp') || extId.includes('c++') || extId.includes('go') || extId.includes('kotlin') || extId.includes('ruby') || extId.includes('csharp') || extId.includes('dotnet')) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    testCompiler(ext.name || ext.displayName);
                                                }}
                                                style={{
                                                    padding: '6px 14px',
                                                    background: 'linear-gradient(135deg, #0098FF 0%, #0078D4 100%)',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    color: '#fff',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    boxShadow: '0 2px 8px rgba(0,152,255,0.3)'
                                                }}
                                            >
                                                <FiPlay size={14} /> Test
                                            </button>
                                        )}
                                    </div>
                                )
                            ) : (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        isInstalledExt ? null : (ext.files ? handleInstall(ext) : installExpertPick(ext));
                                    }}
                                    disabled={isInstalling}
                                    style={{
                                        padding: '8px 20px',
                                        background: isInstalling ? 'rgba(0,152,255,0.3)' : 'linear-gradient(135deg, #0098FF 0%, #0078D4 100%)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: isInstalling ? 'not-allowed' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 2px 8px rgba(0,152,255,0.3)'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isInstalling) {
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,152,255,0.4)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isInstalling) {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,152,255,0.3)';
                                        }
                                    }}
                                >
                                    {isInstalling ? (
                                        <>
                                            <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                                            Installing...
                                        </>
                                    ) : (
                                        <>
                                            <FiDownload size={14} />
                                            Install
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <FiBox size={20} style={{ color: '#0098FF' }} />
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#fff' }}>Extensions Marketplace</h2>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            background: activeTab === 'marketplace' ? '#0098FF' : 'transparent',
                            color: activeTab === 'marketplace' ? '#fff' : 'rgba(255,255,255,0.7)',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500',
                            transition: 'all 0.2s'
                        }}
                        onClick={() => setActiveTab('marketplace')}
                    >
                        Explore
                    </button>
                    <button
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            background: activeTab === 'installed' ? '#0098FF' : 'transparent',
                            color: activeTab === 'installed' ? '#fff' : 'rgba(255,255,255,0.7)',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500',
                            transition: 'all 0.2s'
                        }}
                        onClick={() => setActiveTab('installed')}
                    >
                        Installed ({installedExtensions.length})
                    </button>
                </div>

                {/* Search Bar */}
                {activeTab === 'marketplace' && (
                    <div style={{ position: 'relative' }}>
                        <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} size={16} />
                        <input
                            type="text"
                            placeholder="Search extensions..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px 10px 36px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: '#fff',
                                fontSize: '13px',
                                outline: 'none'
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {activeTab === 'marketplace' ? (
                    loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                            <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 12px' }} />
                            <div>Loading extensions...</div>
                        </div>
                    ) : (
                        results.length > 0 ? (
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {results.map(ext => renderExtensionCard(ext))}
                            </div>
                        ) : (
                            <div>
                                {/* Hero Section */}
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(0,152,255,0.15) 0%, rgba(138,43,226,0.15) 100%)',
                                    padding: '32px',
                                    borderRadius: '12px',
                                    marginBottom: '32px',
                                    border: '1px solid rgba(0,152,255,0.2)'
                                }}>
                                    <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#fff', margin: '0 0 12px 0' }}>
                                        Discover Extensions
                                    </h1>
                                    <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: '1.6' }}>
                                        Power up your development with premium extensions.
                                        <br />Themes, snippets, language support, and more.
                                    </p>
                                </div>

                                {/* Expert Picks */}
                                <div style={{ marginBottom: '32px' }}>
                                    <h3 style={{
                                        fontSize: '16px',
                                        fontWeight: '600',
                                        color: '#fff',
                                        marginBottom: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span style={{ color: '#FFD700' }}>★</span>
                                        Expert Picks
                                    </h3>
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {expertPicks.map(pick => renderExtensionCard(pick))}
                                    </div>
                                </div>

                                {/* Recommended */}
                                <div>
                                    <h3 style={{
                                        fontSize: '16px',
                                        fontWeight: '600',
                                        color: '#fff',
                                        marginBottom: '16px'
                                    }}>
                                        Recommended
                                    </h3>
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {recommended.map(pick => renderExtensionCard(pick))}
                                    </div>
                                </div>
                            </div>
                        )
                    )
                ) : (
                    installedExtensions.length === 0 ? (
                        <div style={{
                            padding: '60px 20px',
                            textAlign: 'center',
                            color: 'rgba(255,255,255,0.5)'
                        }}>
                            <FiBox size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                            <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>No extensions installed</div>
                            <div style={{ fontSize: '13px', opacity: 0.7 }}>Browse the marketplace to find extensions</div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {installedExtensions.map(ext => renderExtensionCard(ext, true))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default ExtensionsPanel;

