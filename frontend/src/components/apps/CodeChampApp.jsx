import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiCode, FiZap, FiTarget, FiBox, FiCpu, FiTrendingUp, FiSearch, FiCheckCircle, FiCopy, FiExternalLink, FiX, FiRefreshCw, FiClock, FiPlay, FiTerminal, FiSliders, FiAlertTriangle, FiInfo, FiChevronDown } from 'react-icons/fi';
import { useFileStore, useUIStore, useExecutionStore, useCodeChampStore } from '../../store';
import { aiService } from '../../services/api';
import { executorService } from '../../services/executorService';
import socketService from '../../services/socketService';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function CodeChampApp({ onClose }) {
    const { files, activeFileId } = useFileStore();
    const { addNotification } = useUIStore();
    const activeFile = files.find(f => f.id === activeFileId);

    const {
        analysis, setAnalysis,
        testCases, setTestCases,
        detectedProblem, setDetectedProblem,
        activeTab, setActiveTab,
        hasAnalyzedOnce, setHasAnalyzedOnce,
        lastContentHash, setLastContentHash,
        tone, setTone,
        scraperUrl, setScraperUrl,
        scraperTarget, setScraperTarget,
        scraperResult, setScraperResult
    } = useCodeChampStore();

    const [toneOpen, setToneOpen] = useState(false);
    const TONE_OPTIONS = [
        { value: 'standard', label: '📋 Standard', desc: 'Balanced analysis' },
        { value: 'beginner', label: '🎓 Beginner', desc: 'Simple explanations' },
        { value: 'concise', label: '⚡ Concise', desc: 'Short & direct' },
        { value: 'detailed', label: '🔬 Detailed', desc: 'In-depth analysis' },
        { value: 'humorous', label: '😄 Humorous', desc: 'Fun & witty' },
    ];
    const currentToneLabel = TONE_OPTIONS.find(t => t.value === tone)?.label || '📋 Standard';

    const [isLoading, setIsLoading] = useState(false);
    const [isScraping, setIsScraping] = useState(false);
    const [isStale, setIsStale] = useState(false);
    const [runOutput, setRunOutput] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [stdin, setStdin] = useState('');
    const [showStdin, setShowStdin] = useState(false);
    const [guiUrl, setGuiUrl] = useState(null);
    const { setExecuting, setOutput, setError, setExecutionTime, addToHistory, isExecuting: isGlobalExecuting } = useExecutionStore();

    // --- LeetCode Function Mode (always enabled in CodeChamp) ---
    const [lcResults, setLcResults] = useState(null);
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const hasMounted = useRef(false);

    // Clear results when active file changes, but keep test cases if they were just set/detected
    useEffect(() => {
        setLcResults(null);
    }, [activeFileId]);

    const analyzeCode = useCallback(async (isManual = false) => {
        if (!activeFile || !activeFile.content) return;
        // Skip if code is too short for meaningful analysis
        if (activeFile.content.trim().length < 20) return;

        // Content hash to avoid duplicate AI calls for identical code
        const contentHash = btoa(unescape(encodeURIComponent(activeFile.content.slice(0, 500)))) + activeFile.content.length;
        if (!isManual && contentHash === lastContentHash) return;
        setLastContentHash(contentHash);

        if (isManual) setHasAnalyzedOnce(true);

        setIsLoading(true);
        const lang = activeFile.language.toLowerCase();

        try {
            const response = await aiService.analyzeCodeChamp(activeFile.content, lang, 'analyze', '', '', tone);
            // Robust response handling
            const data = response.data || response;
            if (data.error) throw new Error(data.error);

            setAnalysis(data);
            setIsStale(false);
            setHasAnalyzedOnce(true); // Ensure auto-analysis is enabled after any success
            addNotification({ type: 'success', message: 'Analysis updated!' });
        } catch (error) {
            console.error('CodeChamp analysis failed:', error);
            if (error.name !== 'CanceledError') {
                addNotification({
                    type: 'error',
                    message: 'AI Analysis failed. Click Analyze to retry.'
                });
            }
        }
        setIsLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFile?.id, activeFile?.content?.length]);

    // Initial analysis on mount / when active file changes — runs once per file
    useEffect(() => {
        if (!activeFile?.content || activeFile.content.trim().length < 20) return;
        // On first mount or file change, trigger analysis if none exists
        if (!hasMounted.current) {
            hasMounted.current = true;
            if (!analysis) {
                analyzeCode(true);
            }
            return;
        }
        // When switching to a new file, always re-analyze
        analyzeCode(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFile?.id]);

    // Listen for GUI app ready
    useEffect(() => {
        const handleAppReady = (data) => {
            const { port } = data;
            const hostname = window.location.hostname;
            const protocol = window.location.protocol;
            const appUrl = `${protocol}//${hostname}:${port}/vnc.html?resize=remote&autoconnect=true`;
            setGuiUrl(appUrl);
            setIsRunning(false);
        };

        const handleExecFinished = () => {
            setIsRunning(false);
        };

        socketService.on('exec:app-ready', handleAppReady);
        socketService.on('exec:finished', handleExecFinished);
        socketService.on('exec:error', handleExecFinished);

        return () => {
            socketService.off('exec:app-ready', handleAppReady);
            socketService.off('exec:finished', handleExecFinished);
            socketService.off('exec:error', handleExecFinished);
        };
    }, []);

    // Auto-analyze on code change with debounce (5s)
    useEffect(() => {
        if (!activeFile?.content || activeFile.content.trim().length < 20) return;

        setIsStale(true);

        const timer = setTimeout(() => {
            if (activeFile?.content) {
                analyzeCode(false);
            }
        }, 5000); // 5s debounce to save bandwidth

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFile?.content]);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        addNotification({ type: 'success', message: 'Copied to clipboard' });
    };

    // Run active file code
    const runCode = async () => {
        if (!activeFile || !activeFile.content) {
            addNotification({ type: 'error', message: 'No active file to run.' });
            return;
        }

        setIsRunning(true);
        setGuiUrl(null);
        setRunOutput(null);

        // Use Global Execution Store for consistency
        setExecuting(true);
        setOutput('');
        setError(null);

        // Socket execution automatically redirects to GUI sandbox if imports are detected
        executorService.executeInteractive(activeFile.content, activeFile.language);

        addNotification({ type: 'info', message: 'Starting execution...' });
    };

    // --- LeetCode: Run test cases ---
    const runLeetcodeTests = async () => {
        if (!activeFile || !activeFile.content) {
            addNotification({ type: 'error', message: 'No active file to test.' });
            return;
        }
        const validCases = testCases.filter(tc => tc.input.trim() || tc.expected.trim());
        if (validCases.length === 0) {
            addNotification({ type: 'error', message: 'Add at least one test case.' });
            return;
        }

        const lang = activeFile.language?.toLowerCase() || 'python';
        const filename = activeFile.name || 'script.py';
        setIsTestRunning(true);
        setLcResults(null);

        try {
            // Directly call executor with leetcode_mode forced on and test cases
            const executorApi = (await import('axios')).default.create({
                baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/executor` : '/api/executor',
                timeout: 60000,
                headers: { 'Content-Type': 'application/json' }
            });
            const response = await executorApi.post('/execute', {
                code: activeFile.content,
                language: lang,
                filename,
                input: stdin,
                leetcode_mode: true,
                test_cases: validCases
            });
            const result = response.data;

            // Try to find and parse the JSON results blob from the end of the output
            let realSuccess = result.success;
            let summary = null;

            if (result.output) {
                const lines = result.output.trim().split('\n');
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    if (line.startsWith('{') && line.endsWith('}')) {
                        try {
                            summary = JSON.parse(line);
                            if (summary && typeof summary.failed !== 'undefined') {
                                realSuccess = result.success && (summary.failed === 0);
                            }
                            break;
                        } catch (e) {
                            // Not the results JSON, keep looking
                        }
                    }
                }
            }

            setLcResults({
                success: realSuccess,
                output: result.output || '',
                error: result.error || '',
                summary: summary
            });

            if (realSuccess) {
                addNotification({ type: 'success', message: 'All tests passed!' });
            } else {
                addNotification({ type: 'error', message: summary?.failed > 0 ? `${summary.failed} tests failed.` : 'Some tests failed or errored.' });
            }
        } catch (error) {
            setLcResults({ success: false, output: '', error: error.message });
            addNotification({ type: 'error', message: `Test run failed: ${error.message}` });
        } finally {
            setIsTestRunning(false);
        }
    };

    // --- LeetCode: Auto-detect problem & generate test cases from AI ---
    const autoDetectTestCases = async () => {
        if (!activeFile || !activeFile.content) {
            addNotification({ type: 'error', message: 'No active file to analyze.' });
            return;
        }
        const lang = activeFile.language?.toLowerCase() || 'python';
        setIsDetecting(true);
        setDetectedProblem(null);

        try {
            const response = await aiService.generateLeetcodeTestCases(activeFile.content, lang);
            const data = response.data || response;
            if (data.error) {
                addNotification({ type: 'error', message: data.error });
                return;
            }
            setDetectedProblem({
                name: data.problem_name || 'Unknown Problem',
                url: data.problem_url || ''
            });
            // Auto-fill test cases — replace existing ones to avoid bleeding
            const aiCases = (data.test_cases || []).map(tc => ({
                input: tc.input || '',
                expected: tc.expected || ''
            }));
            if (aiCases.length > 0) {
                setTestCases(aiCases);
                if (data.warning) {
                    addNotification({ type: 'warning', message: data.warning });
                } else {
                    addNotification({ type: 'success', message: `Detected: ${data.problem_name}. ${aiCases.length} test cases generated!` });
                }
            } else {
                addNotification({ type: 'warning', message: 'Problem detected but no test cases could be generated.' });
            }
        } catch (error) {
            console.error('Auto-detect failed:', error);
            // Extract meaningful error from Axios response (handles 422 and other errors)
            const errData = error?.response?.data;
            const errMsg = errData?.error || error?.message || 'Unknown error';

            // If the backend returned partial data (like test cases with warning), use it
            if (errData?.test_cases && errData.test_cases.length > 0) {
                setTestCases(errData.test_cases.map(tc => ({ input: tc.input || '', expected: tc.expected || '' })));
                if (errData.problem_name) {
                    setDetectedProblem({ name: errData.problem_name, url: errData.problem_url || '' });
                }
                addNotification({ type: 'warning', message: errData.warning || 'Partial detection — please verify test cases.' });
            } else {
                addNotification({ type: 'error', message: `Auto-detect failed: ${errMsg}` });
            }
        } finally {
            setIsDetecting(false);
        }
    };

    return (
        <div className="code-champ-app" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-primary)',
                background: 'linear-gradient(90deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <FiZap size={20} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>CodeChamp</h2>
                            {analysis?.is_mock ? (
                                <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'rgba(248,81,73,0.1)', color: '#f85149', borderRadius: '4px', border: '1px solid rgba(248,81,73,0.2)' }}>OFFLINE</span>
                            ) : hasAnalyzedOnce ? (
                                <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'rgba(63,185,80,0.1)', color: '#3fb950', borderRadius: '4px', border: '1px solid rgba(63,185,80,0.2)' }}>ONLINE</span>
                            ) : null}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AI-Powered Competitive Coding Assistant</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Tone Selector */}
                    <div style={{ position: 'relative' }}>
                        <button
                            className="btn btn--ghost"
                            onClick={() => setToneOpen(!toneOpen)}
                            style={{
                                borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px',
                                border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)'
                            }}
                            title="Change analysis tone"
                        >
                            <span>{currentToneLabel}</span>
                            <FiChevronDown size={12} style={{ transition: 'transform 0.2s', transform: toneOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
                        </button>
                        {toneOpen && (
                            <div style={{
                                position: 'absolute', top: '100%', right: 0, marginTop: '6px',
                                background: 'var(--bg-elevated, var(--bg-secondary))', border: '1px solid var(--border-primary)',
                                borderRadius: '10px', padding: '6px', minWidth: '200px', zIndex: 100,
                                boxShadow: '0 12px 40px rgba(0,0,0,0.4)'
                            }}>
                                {TONE_OPTIONS.map(opt => (
                                    <div
                                        key={opt.value}
                                        onClick={() => { setTone(opt.value); setToneOpen(false); }}
                                        style={{
                                            padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                                            display: 'flex', flexDirection: 'column', gap: '2px',
                                            background: tone === opt.value ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                            transition: 'background 0.15s'
                                        }}
                                        onMouseOver={e => e.currentTarget.style.background = tone === opt.value ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255,255,255,0.04)'}
                                        onMouseOut={e => e.currentTarget.style.background = tone === opt.value ? 'rgba(99, 102, 241, 0.12)' : 'transparent'}
                                    >
                                        <span style={{ fontSize: '13px', fontWeight: '600' }}>{opt.label}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.desc}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        className="btn btn--primary border border-red-500"
                        onClick={runCode}
                        disabled={isRunning || !activeFile}
                        title="Run Program"

                    >
                        {isRunning ? <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : <FiPlay size={14} fill="currentColor" />}
                        <span style={{ marginLeft: '6px' }}>{isRunning ? 'RUNNING...' : 'RUN'}</span>
                    </button>
                    <button className="btn btn--ghost btn--icon" onClick={() => analyzeCode(true)} disabled={isLoading} title="Refresh Analysis">
                        <FiRefreshCw className={isLoading ? 'spinner' : ''} />
                    </button>
                    <button className="btn btn--ghost btn--icon" onClick={onClose}>
                        <FiX />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }} className="scrollbar-hide">
                {/* GUI VNC Preview Inline */}
                {guiUrl && (
                    <div style={{
                        marginBottom: '16px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '1px solid var(--accent-primary)',
                        height: '350px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        position: 'relative'
                    }}>
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: '32px',
                            background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', zIndex: 10
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700', color: 'var(--accent-primary)' }}>
                                <FiBox size={14} /> GUI SANDBOX ACTIVE
                            </div>
                            <button className="btn btn--ghost btn--icon" onClick={() => setGuiUrl(null)} style={{ padding: '2px' }}>
                                <FiX size={12} />
                            </button>
                        </div>
                        <iframe
                            src={guiUrl}
                            style={{ width: '100%', height: 'calc(100% - 32px)', border: 'none', marginTop: '32px' }}
                            title="GUI Preview"
                        />
                    </div>
                )}

                {/* Runtime Input (Stdin) */}
                <div style={{ marginBottom: '16px' }}>
                    <div
                        onClick={() => setShowStdin(!showStdin)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: showStdin ? '10px 10px 0 0' : '10px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FiTerminal size={14} color="var(--accent-primary)" />
                            <span style={{ fontWeight: '600' }}>Program Input (stdin)</span>
                            {stdin && !showStdin && <span style={{ fontSize: '11px', color: 'var(--success)' }}>• Input set</span>}
                        </div>
                        <span style={{ fontSize: '10px', opacity: 0.5 }}>{showStdin ? 'COLLAPSE' : 'EXPAND'}</span>
                    </div>
                    {showStdin && (
                        <div style={{
                            padding: '12px',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--border-primary)',
                            borderTop: 'none',
                            borderRadius: '0 0 10px 10px'
                        }}>
                            <textarea
                                value={stdin}
                                onChange={(e) => setStdin(e.target.value)}
                                placeholder="Enter input that your program will read at runtime..."
                                style={{
                                    width: '100%',
                                    minHeight: '60px',
                                    padding: '10px',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '12px',
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    color: 'var(--text-primary)',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                    )}
                </div>
                {/* Inline Run Output */}
                {runOutput && (
                    <div style={{
                        marginBottom: '16px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: `1px solid ${runOutput.success ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)'}`,
                    }}>
                        <div style={{
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: runOutput.success ? 'rgba(63,185,80,0.06)' : 'rgba(248,81,73,0.06)',
                            borderBottom: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                <FiTerminal style={{ color: runOutput.success ? '#3fb950' : '#f85149' }} />
                                <span style={{ fontWeight: '600' }}>Output</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{runOutput.time}ms</span>
                            </div>
                            <button
                                className="btn btn--ghost btn--icon"
                                onClick={() => setRunOutput(null)}
                                style={{ padding: '2px' }}
                            >
                                <FiX size={12} />
                            </button>
                        </div>
                        <div style={{
                            padding: '12px 14px',
                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                            fontSize: '12px',
                            lineHeight: '1.5',
                            background: '#0d1117',
                            color: '#e6edf3',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '150px',
                            overflowY: 'auto'
                        }}>
                            {runOutput.output && <div>{runOutput.output}</div>}
                            {runOutput.error && <div style={{ color: '#ff7b72' }}>{runOutput.error}</div>}
                            {!runOutput.output && !runOutput.error && <div style={{ opacity: 0.4 }}>No output</div>}
                        </div>
                    </div>
                )}

                {!analysis && !isLoading ? (
                    <div style={{ textAlign: 'center', marginTop: '100px', opacity: 0.6 }}>
                        <FiSearch size={48} style={{ marginBottom: '16px' }} />
                        <p>Open a file and click analyze to see results</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Summary Metrics */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '16px'
                        }}>
                            <MetricCard
                                icon={<FiClock />}
                                label="Time Complexity"
                                value={(isLoading || isStale) ? '...' : (analysis?.timeComplexity || 'N/A')}
                                color="#3b82f6"
                                isStale={isStale || isLoading}
                            />
                            <MetricCard
                                icon={<FiBox />}
                                label="Space Complexity"
                                value={(isLoading || isStale) ? '...' : (analysis?.spaceComplexity || 'N/A')}
                                color="#8b5cf6"
                                isStale={isStale || isLoading}
                            />
                            <MetricCard
                                icon={<FiTrendingUp />}
                                label="Better Than"
                                value={(isLoading || isStale) ? '...' : (analysis?.betterThan || '-%')}
                                color="#10b981"
                                isStale={isStale || isLoading}
                            />
                        </div>

                        {/* Tabs */}
                        <div style={{
                            display: 'flex',
                            gap: '24px',
                            borderBottom: '1px solid var(--border-primary)',
                            padding: '0 8px'
                        }}>
                            <TabItem active={activeTab === 'complexity'} onClick={() => setActiveTab('complexity')}>Analysis</TabItem>
                            <TabItem active={activeTab === 'optimal'} onClick={() => setActiveTab('optimal')}>Optimal Solution</TabItem>
                            <TabItem active={activeTab === 'leetcode'} onClick={() => setActiveTab('leetcode')}>⚡ LeetCode</TabItem>
                            <TabItem active={activeTab === 'compare'} onClick={() => setActiveTab('compare')}>Resources</TabItem>
                            <TabItem active={activeTab === 'scraper'} onClick={() => setActiveTab('scraper')}>Scraper Gen</TabItem>
                        </div>

                        {/* Tab Content */}
                        <div style={{ minHeight: '300px', position: 'relative' }}>
                            {isLoading && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: 'rgba(var(--bg-primary-rgb), 0.7)',
                                    zIndex: 5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backdropFilter: 'blur(2px)',
                                    borderRadius: '8px'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <FiZap className="spinner" size={24} color="var(--accent-primary)" />
                                        <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>AI analyzing code...</span>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'complexity' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {analysis?.is_mock && (
                                        <div style={{
                                            padding: '24px',
                                            backgroundColor: 'rgba(255,193,7,0.03)',
                                            border: '1px solid rgba(255,193,7,0.15)',
                                            borderRadius: '12px',
                                            borderLeft: '4px solid #ffc107'
                                        }}>
                                            <div style={{ fontSize: '14px', lineHeight: '1.7' }}>
                                                <ReactMarkdown>{analysis.summary}</ReactMarkdown>
                                            </div>
                                        </div>
                                    )}

                                    {!analysis?.is_mock && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            {/* Quality Score + Summary Row */}
                                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                                {/* Quality Score Circle */}
                                                <div style={{
                                                    width: '120px', minWidth: '120px', padding: '20px',
                                                    backgroundColor: 'var(--bg-secondary)', borderRadius: '16px',
                                                    border: '1px solid var(--border-primary)',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                                }}>
                                                    <div style={{ position: 'relative', width: '72px', height: '72px' }}>
                                                        <svg viewBox="0 0 72 72" style={{ width: '72px', height: '72px', transform: 'rotate(-90deg)' }}>
                                                            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                                                            <circle
                                                                cx="36" cy="36" r="30" fill="none" strokeWidth="6" strokeLinecap="round"
                                                                stroke={(() => {
                                                                    const s = analysis?.qualityScore || 0;
                                                                    if (s >= 80) return '#10b981';
                                                                    if (s >= 60) return '#f59e0b';
                                                                    if (s >= 40) return '#f97316';
                                                                    return '#ef4444';
                                                                })()}
                                                                strokeDasharray={`${(analysis?.qualityScore || 0) / 100 * 188.5} 188.5`}
                                                                style={{ transition: 'stroke-dasharray 0.8s ease' }}
                                                            />
                                                        </svg>
                                                        <div style={{
                                                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '20px', fontWeight: '800',
                                                            color: (() => {
                                                                const s = analysis?.qualityScore || 0;
                                                                if (s >= 80) return '#10b981';
                                                                if (s >= 60) return '#f59e0b';
                                                                if (s >= 40) return '#f97316';
                                                                return '#ef4444';
                                                            })()
                                                        }}>
                                                            {analysis?.qualityScore ?? '—'}
                                                        </div>
                                                    </div>
                                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: '600' }}>Quality</span>
                                                </div>

                                                {/* Summary Card */}
                                                <div style={{
                                                    flex: 1, minWidth: '200px', padding: '16px 20px',
                                                    backgroundColor: 'var(--bg-secondary)', borderRadius: '16px',
                                                    border: '1px solid var(--border-primary)',
                                                    borderLeft: '4px solid var(--accent-primary)'
                                                }}>
                                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent-primary)', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <FiZap size={12} /> Summary
                                                    </div>
                                                    <div style={{ fontSize: '13px', lineHeight: '1.7', color: 'var(--text-primary)' }} className="markdown-content">
                                                        <ReactMarkdown>{analysis?.summary || 'No summary available.'}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bugs Section */}
                                            {(analysis?.bugs || []).length > 0 && (
                                                <div>
                                                    <h3 style={{ fontSize: '15px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <FiAlertTriangle color="#f59e0b" size={16} /> Bugs Found
                                                        <span style={{
                                                            fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                                            background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontWeight: '700'
                                                        }}>{(analysis?.bugs || []).length}</span>
                                                    </h3>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        {(analysis?.bugs || []).map((bug, i) => {
                                                            const sevColors = {
                                                                Critical: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: '#ef4444', icon: '🔴' },
                                                                Major: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#f59e0b', icon: '🟡' },
                                                                Minor: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', text: '#10b981', icon: '🟢' }
                                                            };
                                                            const sev = sevColors[bug.severity] || sevColors.Minor;
                                                            return (
                                                                <div key={i} style={{
                                                                    padding: '14px 16px', backgroundColor: sev.bg,
                                                                    borderRadius: '12px', border: `1px solid ${sev.border}`
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                                        <span>{sev.icon}</span>
                                                                        <span style={{
                                                                            fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
                                                                            letterSpacing: '0.5px', color: sev.text
                                                                        }}>{bug.severity}</span>
                                                                        {bug.line > 0 && (
                                                                            <span style={{
                                                                                fontSize: '11px', padding: '1px 8px', borderRadius: '6px',
                                                                                background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontFamily: 'monospace'
                                                                            }}>Line {bug.line}</span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: bug.fix_suggestion ? '8px' : 0 }} className="markdown-content">
                                                                        <ReactMarkdown>{bug.description}</ReactMarkdown>
                                                                    </div>
                                                                    {bug.fix_suggestion && (
                                                                        <div style={{
                                                                            fontSize: '12px', padding: '8px 12px', borderRadius: '8px',
                                                                            background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)',
                                                                            color: 'var(--text-secondary)', lineHeight: '1.5'
                                                                        }}>
                                                                            <span style={{ fontWeight: '600', color: '#6366f1', marginRight: '6px' }}>💡 Fix:</span>
                                                                            <span className="markdown-content" style={{ display: 'inline' }}>
                                                                                <ReactMarkdown>{bug.fix_suggestion}</ReactMarkdown>
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Improvements Section */}
                                            {(analysis?.improvements || []).length > 0 && (
                                                <div>
                                                    <h3 style={{ fontSize: '15px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <FiTrendingUp color="#8b5cf6" size={16} /> Improvements
                                                        <span style={{
                                                            fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                                            background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', fontWeight: '700'
                                                        }}>{(analysis?.improvements || []).length}</span>
                                                    </h3>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        {(analysis?.improvements || []).map((imp, i) => {
                                                            const catColors = {
                                                                Speed: '#3b82f6', Performance: '#3b82f6',
                                                                Readability: '#8b5cf6', Security: '#ef4444',
                                                                General: '#6b7280'
                                                            };
                                                            const catColor = catColors[imp.category] || '#6b7280';
                                                            return (
                                                                <div key={i} style={{
                                                                    padding: '14px 16px', backgroundColor: 'var(--bg-secondary)',
                                                                    borderRadius: '12px', border: '1px solid var(--border-primary)'
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                                        <span style={{
                                                                            fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                                                                            letterSpacing: '0.5px', padding: '2px 8px', borderRadius: '6px',
                                                                            background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}30`
                                                                        }}>{imp.category}</span>
                                                                    </div>
                                                                    <div style={{ fontSize: '13px', lineHeight: '1.6' }} className="markdown-content">
                                                                        <ReactMarkdown>{imp.description}</ReactMarkdown>
                                                                    </div>
                                                                    {imp.code_snippet && (
                                                                        <SyntaxHighlighter
                                                                            language={activeFile?.language?.toLowerCase() || 'python'}
                                                                            style={vscDarkPlus}
                                                                            customStyle={{ borderRadius: '8px', fontSize: '12px', padding: '12px', marginTop: '10px' }}
                                                                        >
                                                                            {imp.code_snippet}
                                                                        </SyntaxHighlighter>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Recommendations */}
                                            {(analysis?.recommendations || []).length > 0 && (
                                                <div>
                                                    <h3 style={{ fontSize: '15px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <FiTarget color="var(--accent-primary)" size={16} /> Recommendations
                                                    </h3>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {(analysis?.recommendations || []).map((rec, i) => (
                                                            <div key={i} style={{
                                                                padding: '12px 16px',
                                                                backgroundColor: 'var(--bg-secondary)',
                                                                borderRadius: '10px',
                                                                border: '1px solid var(--border-primary)',
                                                                fontSize: '13px',
                                                                display: 'flex',
                                                                alignItems: 'start',
                                                                gap: '12px',
                                                                lineHeight: '1.6'
                                                            }}>
                                                                <span style={{
                                                                    width: '22px', height: '22px', borderRadius: '6px',
                                                                    background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '11px', fontWeight: '800', flexShrink: 0, marginTop: '1px'
                                                                }}>{i + 1}</span>
                                                                <div className="markdown-content" style={{ flex: 1 }}>
                                                                    <ReactMarkdown>{rec}</ReactMarkdown>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'optimal' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Detected Problem Banner */}
                                    {analysis?.detectedProblem && (
                                        <div style={{
                                            padding: '12px 16px',
                                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08))',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(99, 102, 241, 0.2)',
                                            display: 'flex', alignItems: 'center', gap: '10px'
                                        }}>
                                            <FiTarget size={16} style={{ color: '#6366f1' }} />
                                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#6366f1' }}>
                                                Identified: {analysis.detectedProblem}
                                            </span>
                                        </div>
                                    )}
                                    {analysis?.optimalSolution && (
                                        <>
                                            <div style={{
                                                backgroundColor: 'var(--bg-secondary)',
                                                borderRadius: '8px',
                                                padding: '16px',
                                                border: '1px solid var(--border-primary)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>EXPLANATION</span>
                                                </div>
                                                <div style={{ fontSize: '14px', lineHeight: '1.6' }} className="markdown-content">
                                                    <ReactMarkdown>{analysis.optimalSolution.explanation}</ReactMarkdown>
                                                </div>
                                            </div>

                                            <div style={{ position: 'relative' }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    right: '8px',
                                                    zIndex: 10,
                                                    display: 'flex',
                                                    gap: '8px'
                                                }}>
                                                    <button
                                                        className="btn btn--ghost btn--icon"
                                                        onClick={() => copyToClipboard(analysis.optimalSolution.code)}
                                                        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                                                    >
                                                        <FiCopy size={14} />
                                                    </button>
                                                </div>
                                                <SyntaxHighlighter
                                                    language={analysis.optimalSolution.language || 'javascript'}
                                                    style={vscDarkPlus}
                                                    customStyle={{
                                                        margin: 0,
                                                        borderRadius: '8px',
                                                        fontSize: '13px',
                                                        padding: '16px'
                                                    }}
                                                >
                                                    {analysis.optimalSolution.code}
                                                </SyntaxHighlighter>
                                            </div>

                                            {/* Code Variants from AI "Scraping" */}
                                            {analysis?.variants && analysis.variants.length > 0 && (
                                                <div style={{ marginTop: '20px' }}>
                                                    <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>Alternative Scraped Variants</h3>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                        {analysis.variants.map((v, i) => (
                                                            <div key={i} style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-primary)' }}>
                                                                <div style={{ fontWeight: '500', marginBottom: '8px', fontSize: '14px' }}>{v.name}</div>
                                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }} className="markdown-content">
                                                                    <ReactMarkdown>{v.explanation}</ReactMarkdown>
                                                                </div>
                                                                <SyntaxHighlighter language={v.language || analysis.optimalSolution?.language || 'python'} style={vscDarkPlus} customStyle={{ borderRadius: '8px', fontSize: '12px', padding: '12px' }}>
                                                                    {v.code}
                                                                </SyntaxHighlighter>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {activeTab === 'leetcode' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '20px' }}>⚡</span> LeetCode Function Mode
                                    </h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '-8px', lineHeight: '1.5' }}>
                                        Write your <code>class Solution</code>, then click <strong>🔍 Auto-detect</strong> to have AI identify the problem and generate test cases — or add custom ones manually.
                                    </p>

                                    {/* Auto-detect Button */}
                                    <button
                                        className="btn"
                                        onClick={autoDetectTestCases}
                                        disabled={isDetecting}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            padding: '10px 20px', fontWeight: '600', fontSize: '14px',
                                            background: isDetecting ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                            border: 'none', borderRadius: '10px', cursor: isDetecting ? 'wait' : 'pointer',
                                            color: '#fff', transition: 'all 0.2s'
                                        }}
                                    >
                                        <FiSearch size={16} /> {isDetecting ? 'Detecting problem...' : '🔍 Auto-detect from Code'}
                                    </button>

                                    {/* Detected Problem Banner */}
                                    {detectedProblem && (
                                        <div style={{
                                            padding: '10px 14px',
                                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08))',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(99, 102, 241, 0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <FiCheckCircle size={16} style={{ color: '#6366f1' }} />
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#6366f1' }}>
                                                    {detectedProblem.name}
                                                </span>
                                            </div>
                                            {detectedProblem.url && (
                                                <a
                                                    href={detectedProblem.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ fontSize: '12px', color: '#8b5cf6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    View on LeetCode <FiExternalLink size={12} />
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* Test Cases Input */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Test Cases</span>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>💡 Tip: Verify AI-generated "Expected Output" for accuracy.</span>
                                            </div>
                                            <button
                                                className="btn btn--ghost"
                                                style={{ fontSize: '12px', padding: '4px 10px' }}
                                                onClick={() => setTestCases([...testCases, { input: '', expected: '' }])}
                                            >
                                                + Add Case
                                            </button>
                                        </div>

                                        {testCases.map((tc, i) => (
                                            <div key={i} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr auto',
                                                gap: '8px',
                                                alignItems: 'center',
                                                padding: '10px 12px',
                                                backgroundColor: 'var(--bg-secondary)',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border-primary)'
                                            }}>
                                                <div>
                                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                                        Input Args (e.g. [2,7,11,15], 9)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={tc.input}
                                                        onChange={(e) => {
                                                            const updated = [...testCases];
                                                            updated[i] = { ...updated[i], input: e.target.value };
                                                            setTestCases(updated);
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            border: '1px solid var(--border-primary)',
                                                            backgroundColor: 'var(--bg-primary)',
                                                            color: 'var(--text-primary)',
                                                            fontSize: '13px',
                                                            fontFamily: 'monospace'
                                                        }}
                                                        placeholder="[2,7,11,15], 9"
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                                        Expected Output
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={tc.expected}
                                                        onChange={(e) => {
                                                            const updated = [...testCases];
                                                            updated[i] = { ...updated[i], expected: e.target.value };
                                                            setTestCases(updated);
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            border: '1px solid var(--border-primary)',
                                                            backgroundColor: 'var(--bg-primary)',
                                                            color: 'var(--text-primary)',
                                                            fontSize: '13px',
                                                            fontFamily: 'monospace'
                                                        }}
                                                        placeholder="[0,1]"
                                                    />
                                                </div>
                                                {testCases.length > 1 && (
                                                    <button
                                                        className="btn btn--ghost btn--icon"
                                                        onClick={() => setTestCases(testCases.filter((_, j) => j !== i))}
                                                        style={{ marginTop: '16px', color: '#ef4444' }}
                                                        title="Remove"
                                                    >
                                                        <FiX size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Run Tests Button */}
                                    <button
                                        className="btn btn--primary"
                                        onClick={runLeetcodeTests}
                                        disabled={isTestRunning}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            padding: '10px 20px', fontWeight: '600', fontSize: '14px',
                                            background: isTestRunning ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #f59e0b, #ef4444)',
                                            border: 'none', borderRadius: '10px', cursor: isTestRunning ? 'wait' : 'pointer',
                                            color: '#fff', transition: 'all 0.2s'
                                        }}
                                    >
                                        <FiPlay size={16} /> {isTestRunning ? 'Running Tests...' : 'Run Tests'}
                                    </button>

                                    {/* Results */}
                                    {lcResults && (
                                        <div style={{
                                            borderRadius: '10px',
                                            border: '1px solid var(--border-primary)',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                padding: '10px 14px',
                                                backgroundColor: lcResults.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                                borderBottom: '1px solid var(--border-primary)',
                                                fontSize: '13px', fontWeight: '600',
                                                color: lcResults.success ? '#10b981' : '#ef4444'
                                            }}>
                                                {(() => {
                                                    if (!lcResults.success && !lcResults.summary && lcResults.error) {
                                                        return 'Execution Error';
                                                    }
                                                    if (lcResults.success) return 'All tests passed';
                                                    return lcResults.summary ? `${lcResults.summary.failed} of ${lcResults.summary.passed + lcResults.summary.failed} tests failed` : 'Some tests failed';
                                                })()}
                                            </div>
                                            <div style={{
                                                padding: '12px 14px',
                                                backgroundColor: 'var(--bg-secondary)',
                                                maxHeight: '400px',
                                                overflowY: 'auto'
                                            }}>
                                                {(() => {
                                                    const lines = (lcResults.output || '').split('\n');
                                                    const filteredOutput = lines.filter(l => !(l.trim().startsWith('{') && l.trim().endsWith('}'))).join('\n') || lcResults.error || 'No output';
                                                    return (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            {lcResults.results && lcResults.results.map((r, idx) => (
                                                                <div key={idx} style={{
                                                                    fontSize: '12px',
                                                                    padding: '8px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid var(--border-primary)',
                                                                    backgroundColor: r.passed ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'
                                                                }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                        <span style={{ fontWeight: '600', color: r.passed ? 'var(--success)' : 'var(--error)' }}>
                                                                            {r.passed ? '✓ PASSED' : '✗ FAILED'} - Case {idx + 1}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                        <div>Input: {JSON.stringify(r.input)}</div>
                                                                        <div>Expected: {JSON.stringify(r.expected)}</div>
                                                                        <div>Actual: {JSON.stringify(r.actual)}</div>
                                                                        {r.error && <div style={{ color: 'var(--error)', marginTop: '4px' }}>Error: {r.error}</div>}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {!lcResults.results && (
                                                                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                                                                    {filteredOutput}
                                                                </pre>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'compare' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '20px' }}>🏆</span> Practice Platforms & Resources
                                    </h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '-8px', lineHeight: '1.5' }}>
                                        Sharpen your skills on these competitive programming platforms {analysis?.detectedProblem ? `related to ${analysis.detectedProblem}` : ''}.
                                    </p>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '8px' }}>
                                        {(() => {
                                            const aiLinks = analysis?.platformLinks || [];
                                            const fallbacks = [
                                                { name: 'LeetCode', url: 'https://leetcode.com', desc: 'The most popular platform for technical interviews.' },
                                                { name: 'Codeforces', url: 'https://codeforces.com', desc: 'World-class competitive programming contests.' },
                                                { name: 'HackerRank', url: 'https://hackerrank.com', desc: 'Diverse challenges for coding skills.' },
                                                { name: 'GeeksforGeeks', url: 'https://geeksforgeeks.org', desc: 'Comprehensive tutorials and practice problems.' }
                                            ];

                                            // Combine AI links with fallbacks if AI returned 0 or 1 link
                                            const linksToShow = aiLinks.length > 1 ? aiLinks : [...aiLinks, ...fallbacks.filter(f => !aiLinks.some(al => al.name.toLowerCase().includes(f.name.toLowerCase())))];

                                            return linksToShow.map((link, i) => {
                                                const colors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'];
                                                const accentColor = colors[i % colors.length];
                                                return (
                                                    <a
                                                        key={i}
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            display: 'flex', flexDirection: 'column', padding: '16px 20px',
                                                            backgroundColor: 'var(--bg-secondary)', borderRadius: '16px',
                                                            textDecoration: 'none', color: 'inherit',
                                                            border: '1px solid var(--border-primary)',
                                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            position: 'relative', overflow: 'hidden'
                                                        }}
                                                        onMouseOver={(e) => {
                                                            e.currentTarget.style.borderColor = accentColor;
                                                            e.currentTarget.style.transform = 'translateY(-4px)';
                                                            e.currentTarget.style.backgroundColor = `${accentColor}06`;
                                                            e.currentTarget.style.boxShadow = `0 12px 24px -10px ${accentColor}44`;
                                                        }}
                                                        onMouseOut={(e) => {
                                                            e.currentTarget.style.borderColor = 'var(--border-primary)';
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                                                            e.currentTarget.style.boxShadow = 'none';
                                                        }}
                                                    >
                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px'
                                                        }}>
                                                            <div style={{
                                                                width: '36px', height: '36px', borderRadius: '10px',
                                                                background: `${accentColor}18`,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                            }}>
                                                                <FiExternalLink size={16} style={{ color: accentColor }} />
                                                            </div>
                                                            <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>{link.name}</div>
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', flex: 1 }}>
                                                            {link.description || link.desc || `Practice ${analysis?.detectedProblem || 'algorithms'} on ${link.name}.`}
                                                        </div>
                                                        <div style={{
                                                            marginTop: '12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px',
                                                            color: accentColor, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px'
                                                        }}>
                                                            Go to platform <FiExternalLink size={10} />
                                                        </div>
                                                    </a>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'scraper' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-primary)' }}>
                                        <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Direct Scraper Generator</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <input
                                                className="input"
                                                placeholder="Target URL (e.g. https://leetcode.com)"
                                                value={scraperUrl}
                                                onChange={(e) => setScraperUrl(e.target.value)}
                                                style={{ width: '100%', padding: '10px' }}
                                            />
                                            <textarea
                                                className="input"
                                                placeholder="What data to extract? (e.g. problem description and constraints)"
                                                value={scraperTarget}
                                                onChange={(e) => setScraperTarget(e.target.value)}
                                                style={{ width: '100%', minHeight: '80px', padding: '10px' }}
                                            />
                                            <button
                                                className="btn btn--primary"
                                                disabled={isScraping || !scraperUrl}
                                                onClick={async () => {
                                                    setIsScraping(true);
                                                    try {
                                                        const res = await aiService.analyzeCodeChamp('', '', 'scrape', scraperUrl, scraperTarget);
                                                        setScraperResult(res.result || res.data?.result || 'No code generated');
                                                        addNotification({ type: 'success', message: 'Scraper generated!' });
                                                    } catch (err) {
                                                        addNotification({ type: 'error', message: 'Generation failed' });
                                                    }
                                                    setIsScraping(false);
                                                }}
                                            >
                                                {isScraping ? 'Generating...' : 'Generate Python Scraper'}
                                            </button>
                                        </div>
                                    </div>

                                    {scraperResult && (
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10 }}>
                                                <button className="btn btn--ghost btn--icon" onClick={() => copyToClipboard(scraperResult)}>
                                                    <FiCopy size={14} />
                                                </button>
                                            </div>
                                            <SyntaxHighlighter language="python" style={vscDarkPlus} customStyle={{ borderRadius: '8px', fontSize: '13px', padding: '16px' }}>
                                                {scraperResult}
                                            </SyntaxHighlighter>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Status */}
            <div style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-primary)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: 'flex',
                justifyContent: 'space-between'
            }}>
                <span>{isLoading ? '🤖 AI is thinking...' : (analysis ? `Analysis by ${analysis.provider || 'DeepSeek'}` : 'Analysis powered by DeepSeek-R1')}</span>
                <span>CodeChamp v2.1 {isLoading && <FiClock size={10} style={{ marginLeft: '4px' }} className="spinner" />}</span>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .code-champ-app::-webkit-scrollbar { width: 6px; }
                .code-champ-app::-webkit-scrollbar-thumb { background: var(--border-primary); border-radius: 3px; }
                .tab-item { cursor: pointer; padding: 12px 4px; border-bottom: 2px solid transparent; font-size: 14px; font-weight: 500; color: var(--text-muted); transition: all 0.2s; }
                .tab-item:hover { color: var(--text-primary); }
                .tab-item.active { color: var(--accent-primary); border-bottom-color: var(--accent-primary); }
                .metric-card { background: var(--bg-secondary); padding: 16px; borderRadius: 12px; border: 1px solid var(--border-primary); }
                .markdown-content p { margin-top: 0; margin-bottom: 12px; }
                .markdown-content ul, .markdown-content ol { margin-bottom: 12px; padding-left: 20px; }
                .markdown-content li { margin-bottom: 4px; }
                .markdown-content code { background: rgba(255,255,255,0.08); padding: 2px 4px; borderRadius: 4px; font-family: var(--font-mono); font-size: 0.9em; }
                .markdown-content pre { background: var(--bg-primary); padding: 12px; borderRadius: 8px; overflow-x: auto; margin-bottom: 12px; }
                .markdown-content h1, .markdown-content h2, .markdown-content h3 { margin-top: 16px; margin-bottom: 8px; color: var(--accent-primary); }
            ` }} />
        </div>
    );
}

function MetricCard({ icon, label, value, color, isStale }) {
    const isOffline = value === 'OFFLINE';
    const displayColor = isOffline ? '#f85149' : color;

    return (
        <div style={{
            padding: '16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            opacity: isStale ? 0.6 : 1,
            transition: 'all 0.3s ease'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span style={{ color: displayColor }}>{icon}</span>
                {label}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: isOffline ? '#f85149' : 'var(--text-primary)' }}>
                {value}
            </div>
        </div>
    );
}

function TabItem({ children, active, onClick }) {
    return (
        <div
            className={`tab-item ${active ? 'active' : ''}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

export default CodeChampApp;
