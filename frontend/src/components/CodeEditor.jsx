import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { FiCode, FiPlus, FiFolder, FiX, FiAlertTriangle } from 'react-icons/fi';
import { useFileStore, useExecutionStore, useSettingsStore } from '../store';
import { errorParser } from '../services/errorParser';
import { realtimeValidator } from '../services/realtimeValidator';
import { extensionLoader } from '../services/extensionLoader';
import { collaborationService } from '../services/collaborationService';
import ScribbleOverlay from './ScribbleOverlay';
import OutputPanel from './OutputPanel';

function CodeEditor({ isScribbleMode, scribbleTool = 'pen', scribbleColor = '#ff0000', rightPanelWidth, terminalHeight, terminalOpen }) {
    const { files, activeFileId, updateFileContent, addHighlight, removeHighlight, updateHighlight, addDrawing, removeLastDrawing, clearDrawings, renameFile } = useFileStore();
    const { showOutput, error, isExecuting } = useExecutionStore();
    const activeFile = (files || []).find((f) => f.id === activeFileId);
    const { theme, format, features, experimental, scribblePenSize, scribbleEraserSize } = useSettingsStore();

    const monacoRef = useRef(null);
    const editorRef = useRef(null);

    // Optimize editor on panel resize
    useEffect(() => {
        if (editorRef.current) {
            // Use a small timeout to ensure DOM has updated
            const timer = setTimeout(() => {
                editorRef.current.layout();
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [rightPanelWidth, terminalHeight, terminalOpen]);
    const decorationsRef = useRef([]);
    const decorationIdToHighlightId = useRef({});
    const lastContextMenuPositionRef = useRef(null);
    const lastContextMenuHighlightIdRef = useRef(null);
    const lastContextMenuHighlightRangeRef = useRef(null);



    const activeFileIdRef = useRef(activeFileId);
    const removeHighlightRef = useRef(removeHighlight);
    const scribblePenSizeRef = useRef(3);
    const scribbleEraserSizeRef = useRef(15);

    useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);
    useEffect(() => { removeHighlightRef.current = removeHighlight; }, [removeHighlight]);
    useEffect(() => { scribblePenSizeRef.current = scribblePenSize; }, [scribblePenSize]);
    useEffect(() => { scribbleEraserSizeRef.current = scribbleEraserSize; }, [scribbleEraserSize]);

    // Handle Error & Validation Markers
    useEffect(() => {
        let isMounted = true;
        if (monacoRef.current && editorRef.current && activeFile) {
            const currentModel = editorRef.current.getModel();
            if (!currentModel) return;

            const markerTimer = setTimeout(() => {
                if (!isMounted || !monacoRef.current || !editorRef.current) return;

                const modelToMark = editorRef.current.getModel();
                if (!modelToMark) return;

                // 1. Get execution errors if they exist
                let markers = [];
                // Only show errors if validation is enabled
                if (features.validation) {
                    if (!isExecuting && error) {
                        markers = errorParser.parse(error, activeFile.language, activeFile.name);
                    }

                    // 2. Add structural/naming validation (e.g. Java class name match)
                    const validationMarkers = errorParser.validateNaming(activeFile.content, activeFile.language, activeFile.name);
                    markers = [...markers, ...validationMarkers];
                }

                const severityMap = {
                    8: monacoRef.current.MarkerSeverity?.Error || 8,
                    4: monacoRef.current.MarkerSeverity?.Warning || 4,
                    2: monacoRef.current.MarkerSeverity?.Info || 2,
                    1: monacoRef.current.MarkerSeverity?.Hint || 1
                };

                const mappedMarkers = markers.map(m => ({
                    ...m,
                    severity: severityMap[m.severity] || m.severity
                }));

                monacoRef.current.editor.setModelMarkers(modelToMark, 'execution', mappedMarkers);
            }, 500);

            return () => {
                isMounted = false;
                clearTimeout(markerTimer);
            };
        }
    }, [error, isExecuting, activeFile?.id, activeFile?.language, activeFile?.content, features.validation]); // Added features.validation dependency

    useEffect(() => {
        if (editorRef.current && activeFile) {
            const highlights = activeFile.highlights || [];
            const newDecorations = highlights.map(h => ({
                range: h.range,
                options: {
                    isWholeLine: false,
                    className: `highlight-${h.color}`,
                    hoverMessage: { value: 'Right Click to Remove Highlight' },
                    stickiness: 1,
                    zIndex: 10
                }
            }));

            const oldDecorations = decorationsRef.current;
            const newIds = editorRef.current.deltaDecorations(oldDecorations, newDecorations);
            decorationsRef.current = newIds;

            const newMap = {};
            newIds.forEach((decId, index) => {
                if (highlights[index]) {
                    newMap[decId] = highlights[index].id;
                }
            });
            decorationIdToHighlightId.current = newMap;
        }
    }, [activeFile, activeFile?.highlights]);

    // Sync Store with Editor Ranges (Stickiness)
    useEffect(() => {
        if (!editorRef.current || !activeFile) return;

        const sync = () => {
            const model = editorRef.current.getModel();
            if (!model) return;
            const map = decorationIdToHighlightId.current;
            const ids = decorationsRef.current;
            const highlights = activeFile.highlights || [];

            ids.forEach(decId => {
                const range = model.getDecorationRange(decId);
                const highlightId = map[decId];
                if (range && highlightId) {
                    const original = highlights.find(h => h.id === highlightId);
                    if (original) {
                        const hasChanged = original.range.startLineNumber !== range.startLineNumber ||
                            original.range.startColumn !== range.startColumn ||
                            original.range.endLineNumber !== range.endLineNumber ||
                            original.range.endColumn !== range.endColumn;

                        if (hasChanged) {
                            updateHighlight(activeFileId, { ...original, range });
                        }
                    }
                }
            });
        };

        const disposable = editorRef.current.onDidChangeModelContent(() => {
            // Debounced sync to avoid thrashing the store
            const timer = setTimeout(sync, 1000);
            return () => clearTimeout(timer);
        });

        return () => disposable.dispose();
    }, [activeFileId, updateHighlight]);

    // Update Monaco validation options when settings change
    useEffect(() => {
        if (monacoRef.current) {
            const monaco = monacoRef.current;
            const validate = features.validation;

            if (monaco.languages.html) {
                monaco.languages.html.htmlDefaults.setOptions({
                    validation: { scripts: validate, styles: validate },
                    format: { tabSize: 4 }
                });
            }
            if (monaco.languages.css) {
                monaco.languages.css.cssDefaults.setOptions({
                    validate: validate
                });
            }
            if (monaco.languages.typescript) {
                monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: !validate,
                    noSyntaxValidation: !validate
                });
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: !validate,
                    noSyntaxValidation: !validate
                });
            }
            if (monaco.languages.json) {
                monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                    validate: validate,
                    allowComments: true
                });
            }
        }
    }, [features.validation]);

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        realtimeValidator.initialize(monaco, editor);

        // Initial validation settings based on store
        const validate = features.validation;

        if (monaco.languages.html) {
            monaco.languages.html.htmlDefaults.setOptions({
                validation: { scripts: validate, styles: validate },
                format: { tabSize: 4 }
            });
        }
        if (monaco.languages.css) {
            monaco.languages.css.cssDefaults.setOptions({
                validate: validate
            });
        }
        if (monaco.languages.typescript) {
            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: !validate,
                noSyntaxValidation: !validate
            });
        }
        if (monaco.languages.json) {
            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                validate: validate,
                allowComments: true
            });
        }

        extensionLoader.loadActiveExtensions(monaco);

        const handleRefreshExtensions = () => {
            extensionLoader.loadActiveExtensions(monaco);
        };
        window.addEventListener('extension-installed', handleRefreshExtensions);

        editor.onDidDispose(() => {
            window.removeEventListener('extension-installed', handleRefreshExtensions);
            extensionLoader.disposeAll();
            realtimeValidator.dispose();
        });

        const isHighlightContext = editor.createContextKey('isHighlight', false);

        editor.onContextMenu((e) => {
            if (e && e.target) {
                const position = e.target.position || editor.getPosition();
                lastContextMenuPositionRef.current = position;
                lastContextMenuHighlightIdRef.current = null;
                lastContextMenuHighlightRangeRef.current = null;

                if (position) {
                    const model = editor.getModel();
                    if (model) {
                        const decorations = model.getLineDecorations(position.lineNumber);
                        let detectedHighlight = null;

                        decorations.forEach(d => {
                            if (detectedHighlight) return;
                            const isMatch = d.options.className && d.options.className.includes('highlight-');
                            if (!isMatch) return;

                            const range = d.range;
                            const inRange = position.lineNumber >= range.startLineNumber &&
                                position.lineNumber <= range.endLineNumber &&
                                (position.lineNumber !== range.startLineNumber || position.column >= range.startColumn) &&
                                (position.lineNumber !== range.endLineNumber || position.column <= range.endColumn);

                            if (inRange) {
                                // Match decoration ID back to highlight ID
                                const highlightId = decorationIdToHighlightId.current[d.id];
                                if (highlightId) {
                                    detectedHighlight = { id: highlightId, range: d.range };
                                }
                            }
                        });

                        if (detectedHighlight) {
                            lastContextMenuHighlightIdRef.current = detectedHighlight.id;
                            lastContextMenuHighlightRangeRef.current = detectedHighlight.range;
                            isHighlightContext.set(true);
                        } else {
                            isHighlightContext.set(false);
                        }
                    }
                } else {
                    isHighlightContext.set(false);
                }
            }
        });

        editor.addAction({
            id: 'open-highlight-modal',
            label: 'Highlight...',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.5,
            run: (ed) => {
                const selection = ed.getSelection();
                if (selection && !selection.isEmpty()) {
                    window.dispatchEvent(new CustomEvent('open-highlight-modal', {
                        detail: { selection, fileId: activeFileIdRef.current }
                    }));
                }
            }
        });

        editor.addAction({
            id: 'remove-highlight',
            label: 'Remove Highlight',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.6,
            precondition: 'isHighlight',
            run: (ed) => {
                const position = lastContextMenuPositionRef.current || ed.getPosition();
                if (!position) return;

                const activeId = activeFileIdRef.current;
                const file = useFileStore.getState().files.find(f => f.id === activeId);
                if (!file || !file.highlights) return;

                const targetId = lastContextMenuHighlightIdRef.current;
                const targetRange = lastContextMenuHighlightRangeRef.current;

                if (targetId && targetRange) {
                    ed.setSelection(targetRange);
                    if (window.confirm('Remove this highlight?')) {
                        removeHighlightRef.current(activeId, targetId);
                    }
                }
            }
        });

    };

    useEffect(() => {
        collaborationService.onCodeChange = (data) => {
            if (activeFileId) {
                updateFileContent(activeFileId, data.content);
            }
        };
        return () => {
            collaborationService.onCodeChange = null;
        };
    }, [activeFileId, updateFileContent]);

    if (!activeFile) {
        return (
            <div className="welcome">
                <div className="welcome__icon">
                    <FiCode />
                </div>
                <h2 className="welcome__title">Welcome to Roolts</h2>
                <p className="welcome__subtitle">
                    Open a file from the sidebar or create a new one to start coding.
                    Push to GitHub, share on social media, and learn with AI-powered insights.
                </p>
                <div className="welcome__actions">
                    <button className="btn btn--primary" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'newFile' }))}>
                        <FiPlus /> New File
                    </button>
                    <button className="btn btn--secondary">
                        <FiFolder /> Open Project
                    </button>
                </div>
            </div>
        );
    }

    const languageMap = {
        python: 'python',
        javascript: 'javascript',
        typescript: 'typescript',
        java: 'java',
        html: 'html',
        css: 'css',
        json: 'json',
        plaintext: 'plaintext',
        c: 'c',
        cpp: 'cpp',
        go: 'go',
        rust: 'rust',
        markdown: 'markdown',
        shell: 'shell',
        sql: 'sql'
    };

    const getMonacoTheme = (uiTheme) => {
        if (uiTheme === 'light' || uiTheme === 'solarized-light') return 'light';
        if (uiTheme === 'hc-black') return 'hc-black';
        return 'vs-dark';
    };

    return (
        <div className="monaco-wrapper" style={{ position: 'relative' }}>


            <Editor
                height="100%"
                path={(function () {
                    const extMap = { python: 'py', javascript: 'js', typescript: 'ts', java: 'java', go: 'go', rust: 'rs', cpp: 'cpp', c: 'c', html: 'html', css: 'css', json: 'json', markdown: 'md' };
                    const ext = extMap[activeFile.language] || activeFile.language;
                    return `file:///${activeFile.id}.${ext}`;
                })()}
                language={languageMap[activeFile.language] || 'plaintext'}
                value={activeFile.content}
                onChange={(value) => {
                    updateFileContent(activeFile.id, value || '');
                    collaborationService.sendCodeChange(value || '', activeFile.id);
                }}
                theme={getMonacoTheme(theme)}
                options={{
                    fontFamily: format.fontFamily,
                    fontSize: format.fontSize,
                    lineHeight: format.lineHeight,
                    padding: { top: 16, bottom: 16 },
                    minimap: { enabled: features.minimap },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    renderWhitespace: 'selection',
                    wordWrap: format.wordWrap,
                    lineNumbers: features.lineNumbers,
                    bracketPairColorization: { enabled: true },
                    contextmenu: true,
                    quickSuggestions: true,
                    suggestOnTriggerCharacters: true
                }}
                onMount={handleEditorDidMount}
            />

            {experimental?.scribble && activeFile && (
                <ScribbleOverlay
                    key={activeFile.id}
                    fileId={activeFile.id}
                    drawings={activeFile.drawings || []}
                    onAddDrawing={addDrawing}
                    onUndo={() => removeLastDrawing(activeFile.id)}
                    onClear={() => clearDrawings(activeFile.id)}
                    isActive={isScribbleMode}
                    tool={scribbleTool}
                    color={scribbleColor}
                    penSize={scribblePenSize}
                    eraserSize={scribbleEraserSize}
                    editor={editorRef.current}
                />
            )}

            {showOutput && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 200,
                    backgroundColor: 'var(--bg-primary)',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <OutputPanel />
                </div>
            )}
        </div>
    );
}

export default CodeEditor;
