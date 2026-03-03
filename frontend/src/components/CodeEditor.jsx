import React, { useState, useEffect, useRef, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { FiCode, FiPlus, FiFolder, FiX, FiAlertTriangle } from 'react-icons/fi';
import { useFileStore, useExecutionStore, useSettingsStore, useUIStore, useLearningStore } from '../store';
import { errorParser } from '../services/errorParser';
import { realtimeValidator } from '../services/realtimeValidator';
import { extensionLoader } from '../services/extensionLoader';
import { collaborationService } from '../services/collaborationService';
import { lspClient } from '../services/lspClient';
import ScribbleOverlay from './ScribbleOverlay';
import OutputPanel from './OutputPanel';
import ImageCommandOverlay from './ImageCommandOverlay';

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function CodeEditor({ isScribbleMode, scribbleTool = 'pen', scribbleColor = '#ff0000', rightPanelWidth, terminalHeight, terminalOpen }) {
    const activeFileId = useFileStore(state => state.activeFileId);
    const updateFileContent = useFileStore(state => state.updateFileContent);
    const openModal = useUIStore(state => state.openModal);
    const toggleSidebar = useUIStore(state => state.toggleSidebar);
    const sidebarOpen = useUIStore(state => state.sidebarOpen);
    const addHighlight = useFileStore(state => state.addHighlight);
    const removeHighlight = useFileStore(state => state.removeHighlight);
    const updateHighlight = useFileStore(state => state.updateHighlight);
    const addDrawing = useFileStore(state => state.addDrawing);
    const removeLastDrawing = useFileStore(state => state.removeLastDrawing);
    const clearDrawings = useFileStore(state => state.clearDrawings);
    const renameFile = useFileStore(state => state.renameFile);
    const addImage = useFileStore(state => state.addImage);

    // Deep equality check for the specific file so keystrokes elsewhere don't trigger re-render
    // Omit `content` from this check so that typing doesn't trigger a full React re-render
    const activeFile = useFileStore(
        state => state.files.find(f => f.id === state.activeFileId),
        (a, b) =>
            a?.id === b?.id &&
            a?.language === b?.language &&
            a?.highlights?.length === b?.highlights?.length &&
            a?.drawings?.length === b?.drawings?.length &&
            a?.images?.length === b?.images?.length
    );

    // We get the initial content ONLY when the file ID changes or when we need to explicitly inject it
    // Monaco maintains its own internal state, so we don't need to feed it back on every keystroke
    const initialContent = useFileStore(state => {
        const file = state.files.find(f => f.id === state.activeFileId);
        return file ? file.content : '';
    });

    const [editorInitialValue, setEditorInitialValue] = useState(initialContent);

    useEffect(() => {
        // Only update the editor's value if the file ID changes
        // The store content might change due to typing, but we ignore those updates
        // to prevent React re-renders. Collaboration updates are handled via editor APIs directly.
        setEditorInitialValue(initialContent);
    }, [activeFileId]);

    const showOutput = useExecutionStore(state => state.showOutput);
    const error = useExecutionStore(state => state.error);
    const isExecuting = useExecutionStore(state => state.isExecuting);
    const isSplitMode = useExecutionStore(state => state.isSplitMode);
    const setSplitMode = useExecutionStore(state => state.setSplitMode);

    const theme = useSettingsStore(state => state.theme);
    const format = useSettingsStore(state => state.format);
    const features = useSettingsStore(state => state.features);
    const experimental = useSettingsStore(state => state.experimental);
    const scribblePenSize = useSettingsStore(state => state.scribblePenSize);
    const scribbleEraserSize = useSettingsStore(state => state.scribbleEraserSize);
    const backgroundImage = useSettingsStore(state => state.backgroundImage);
    const backgroundOpacity = useSettingsStore(state => state.backgroundOpacity);

    const [leftDockWidth, setLeftDockWidth] = useState(0);

    const monacoRef = useRef(null);
    const editorRef = useRef(null);
    const [editorInstance, setEditorInstance] = useState(null);

    // Notify LSP of document changes and opens
    useEffect(() => {
        if (activeFile && activeFileId && monacoRef.current) {
            const extMap = { python: 'py', javascript: 'js', typescript: 'ts', java: 'java', go: 'go', rust: 'rs', cpp: 'cpp', c: 'c', html: 'html', css: 'css', json: 'json', markdown: 'md' };
            const ext = extMap[activeFile.language] || activeFile.language;
            const uri = `file:///${activeFile.id}.${ext}`;
            lspClient.openDocument(uri, activeFile.language || 'plaintext', activeFile.content || '');
        }
    }, [activeFileId, activeFile?.language, activeFile?.id]);

    // Optimize editor on panel resize
    useEffect(() => {
        if (editorRef.current) {
            // Use a small timeout to ensure DOM has updated
            const timer = setTimeout(() => {
                editorRef.current.layout();
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [rightPanelWidth, terminalHeight, terminalOpen, showOutput, isSplitMode]);
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

    // Create a debounced update function that handles store and LSP updates
    const debouncedUpdate = useMemo(() => {
        return debounce((id, value, lang, name) => {
            updateFileContent(id, value);
            const extMap = { python: 'py', javascript: 'js', typescript: 'ts', java: 'java', go: 'go', rust: 'rs', cpp: 'cpp', c: 'c', html: 'html', css: 'css', json: 'json', markdown: 'md' };
            const ext = extMap[lang] || lang;
            const fileUri = `file:///${id}.${ext}`;
            lspClient.changeDocument(fileUri, lang, value);
        }, 300);
    }, [updateFileContent]);

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

        let timer;
        const disposable = editorRef.current.onDidChangeModelContent(() => {
            clearTimeout(timer);
            // Debounced sync to avoid thrashing the store
            timer = setTimeout(sync, 1000);
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

    const handleImageInsert = (file, clientX, clientY) => {
        if (!editorRef.current || !activeFileIdRef.current || !monacoRef.current) return;

        if (!file || !file.type.startsWith('image/')) return;

        const editor = editorRef.current;
        let x = 100;
        let y = 100;

        if (clientX && clientY) {
            const rect = editor.getContainerDomNode().getBoundingClientRect();
            x = Math.max(0, clientX - rect.left);
            y = Math.max(0, clientY - rect.top) + editor.getScrollTop();
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target.result;
            const imgId = 'img_' + Math.random().toString(36).substr(2, 9);

            const img = new Image();
            img.onload = () => {
                let w = img.width;
                let h = img.height;
                if (w > 300) {
                    h = (300 / w) * h;
                    w = 300;
                }

                useFileStore.getState().addImage(activeFileIdRef.current, {
                    id: imgId,
                    src: src
                });

                const model = editor.getModel();
                const lastLine = model.getLineCount();
                const lastCol = model.getLineMaxColumn(lastLine);

                const lang = useFileStore.getState().files.find(f => f.id === activeFileIdRef.current)?.language || 'javascript';
                let prefix = '//';
                if (['python', 'shell', 'ruby', 'yaml', 'dockerfile', 'roolts'].includes(lang)) prefix = '#';
                if (['html', 'xml'].includes(lang)) prefix = '<!--';
                if (['sql', 'haskell'].includes(lang)) prefix = '--';

                const newText = `\n${prefix} #rooltscommand placeimage id=${imgId} x=${Math.round(x)} y=${Math.round(y)} w=${Math.round(w)} h=${Math.round(h)}${prefix === '<!--' ? ' -->' : ''}`;

                editor.executeEdits('image-drop', [{
                    range: {
                        startLineNumber: lastLine,
                        startColumn: lastCol,
                        endLineNumber: lastLine,
                        endColumn: lastCol
                    },
                    text: newText,
                    forceMoveMarkers: true
                }]);
            };
            img.src = src;
        };
        reader.readAsDataURL(file);
    };

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        setEditorInstance(editor);

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

        // ── LSP Integration ──────────────────────────────
        lspClient.initialize(monaco);

        const handleRefreshExtensions = () => {
            extensionLoader.loadActiveExtensions(monaco);
        };
        window.addEventListener('extension-installed', handleRefreshExtensions);

        // Format Document shortcut (Shift+Alt+F)
        editor.addAction({
            id: 'format-document',
            label: 'Format Document',
            keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
            run: () => {
                editor.getAction('editor.action.formatDocument')?.run();
            }
        });

        // Save File shortcut (Ctrl+S / Cmd+S)
        editor.addAction({
            id: 'save-document',
            label: 'Save File',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
            run: (ed) => {
                const content = ed.getValue();
                const activeId = useFileStore.getState().activeFileId;
                if (activeId) {
                    useFileStore.getState().updateFileContent(activeId, content);
                    useFileStore.getState().markFileSaved(activeId);
                    useUIStore.getState().addNotification({ type: 'success', message: `File saved locally` });
                }
            }
        });

        // Run Program shortcut (Ctrl+Enter / Cmd+Enter)
        editor.addAction({
            id: 'run-document',
            label: 'Run Code',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
            run: () => {
                window.dispatchEvent(new CustomEvent('run-program'));
            }
        });

        // Go to Line shortcut (Ctrl+G)
        editor.addAction({
            id: 'goto-line',
            label: 'Go to Line...',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG],
            run: (ed) => {
                ed.getAction('editor.action.gotoLine')?.run();
            }
        });

        // Duplicate Line Down (Shift+Alt+Down)
        editor.addAction({
            id: 'duplicate-line-down',
            label: 'Duplicate Line Down',
            keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow],
            run: (ed) => {
                ed.getAction('editor.action.copyLinesDownAction')?.run();
            }
        });

        // Toggle Block Comment (Shift+Alt+A)
        editor.addAction({
            id: 'toggle-block-comment',
            label: 'Toggle Block Comment',
            keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyA],
            run: (ed) => {
                ed.getAction('editor.action.blockComment')?.run();
            }
        });

        // Select All Occurrences (Ctrl+Shift+L)
        editor.addAction({
            id: 'select-all-occurrences',
            label: 'Select All Occurrences',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL],
            run: (ed) => {
                ed.getAction('editor.action.selectHighlights')?.run();
            }
        });

        // ── HTML Auto-Close Tag ──
        // When user types '>' in HTML/XML, auto-insert the closing tag
        editor.onDidChangeModelContent((e) => {
            if (e.isFlush) return;
            const model = editor.getModel();
            if (!model) return;

            const lang = model.getLanguageId();
            if (!['html', 'xml', 'php', 'handlebars', 'razor'].includes(lang)) return;

            for (const change of e.changes) {
                if (change.text !== '>') continue;

                const pos = editor.getPosition();
                if (!pos) continue;

                const lineContent = model.getLineContent(pos.lineNumber);
                const beforeCursor = lineContent.substring(0, pos.column - 1);

                // Match an opening tag like <div, <span, <section, etc.
                const tagMatch = beforeCursor.match(/<([a-zA-Z][a-zA-Z0-9-]*)\b[^/]*$/);
                if (!tagMatch) continue;

                const tagName = tagMatch[1];

                // Self-closing tags that should NOT get a closing tag
                const voidTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
                if (voidTags.includes(tagName.toLowerCase())) continue;

                const closingTag = `</${tagName}>`;

                // Insert closing tag after cursor
                editor.executeEdits('auto-close-tag', [{
                    range: {
                        startLineNumber: pos.lineNumber,
                        startColumn: pos.column,
                        endLineNumber: pos.lineNumber,
                        endColumn: pos.column
                    },
                    text: closingTag,
                    forceMoveMarkers: false
                }]);

                // Keep cursor between the opening and closing tags
                editor.setPosition(pos);
            }
        });

        editor.onDidDispose(() => {
            window.removeEventListener('extension-installed', handleRefreshExtensions);
            extensionLoader.disposeAll();
            realtimeValidator.dispose();
            lspClient.dispose();
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

        // ── NEW: Explain with AI Context Menu ──
        editor.addAction({
            id: 'explain-with-ai',
            label: 'Explain with AI',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.0,
            run: (ed) => {
                const selection = ed.getSelection();
                const text = ed.getModel().getValueInRange(selection);
                if (text && text.trim().length > 0) {
                    // Open AI Panel
                    useUIStore.getState().setRightPanelTab('learn');
                    // Send Query
                    useLearningStore.getState().setPendingQuery(`Explain this code context:\n\n\`\`\`${activeFileIdRef.current ? useFileStore.getState().files.find(f => f.id === activeFileIdRef.current)?.language : ''}\n${text}\n\`\`\`\n\nPlease explain what this code does.`);
                    // Ensure panel is open
                    if (!useUIStore.getState().rightPanelOpen) {
                        useUIStore.getState().toggleRightPanel();
                    }
                } else {
                    // Try to explain current line if no selection
                    const position = ed.getPosition();
                    const lineContent = ed.getModel().getLineContent(position.lineNumber);
                    if (lineContent && lineContent.trim().length > 0) {
                        useUIStore.getState().setRightPanelTab('learn');
                        useLearningStore.getState().setPendingQuery(`Explain this line of code:\n\n\`\`\`\n${lineContent.trim()}\n\`\`\``);
                        if (!useUIStore.getState().rightPanelOpen) {
                            useUIStore.getState().toggleRightPanel();
                        }
                    }
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

        const domNode = editor.getContainerDomNode();

        domNode.addEventListener('dragover', (e) => {
            const hasJson = Array.from(e.dataTransfer?.items || []).some(item => item.type === 'application/json');
            const hasImage = Array.from(e.dataTransfer?.items || []).some(item => item.type && item.type.startsWith('image/'));
            if (hasJson || hasImage) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
            }
        }, { capture: true });

        domNode.addEventListener('drop', (e) => {
            const hasJson = Array.from(e.dataTransfer?.items || []).some(item => item.type === 'application/json');
            if (hasJson) {
                const jsonStr = e.dataTransfer.getData('application/json');
                if (jsonStr) {
                    try {
                        const data = JSON.parse(jsonStr);
                        if (data.type === 'snapshot' && data.src) {
                            e.preventDefault();
                            e.stopPropagation();

                            const imgId = 'img_' + Math.random().toString(36).substr(2, 9);
                            useFileStore.getState().addImage(activeFileIdRef.current, {
                                id: imgId,
                                src: data.src
                            });

                            const editor = editorRef.current;
                            const rect = domNode.getBoundingClientRect();
                            const x = Math.max(0, e.clientX - rect.left);
                            const y = Math.max(0, e.clientY - rect.top) + editor.getScrollTop();

                            const target = editor.getTargetAtClientPoint(e.clientX, e.clientY);
                            const position = target?.position || editor.getPosition();
                            const line = position ? position.lineNumber : editor.getModel().getLineCount();

                            const lang = useFileStore.getState().files.find(f => f.id === activeFileIdRef.current)?.language || 'javascript';
                            let prefix = '//';
                            if (['python', 'shell', 'ruby', 'yaml', 'dockerfile', 'roolts'].includes(lang)) prefix = '#';
                            if (['html', 'xml'].includes(lang)) prefix = '<!--';
                            if (['sql', 'haskell'].includes(lang)) prefix = '--';

                            const newText = `\n${prefix} #rooltscommand placeimage id=${imgId} x=${Math.round(x)} y=${Math.round(y)} w=250 h=150${prefix === '<!--' ? ' -->' : ''}`;

                            editor.executeEdits('snapshot-drop', [{
                                range: {
                                    startLineNumber: line,
                                    startColumn: editor.getModel().getLineMaxColumn(line),
                                    endLineNumber: line,
                                    endColumn: editor.getModel().getLineMaxColumn(line)
                                },
                                text: newText,
                                forceMoveMarkers: true
                            }]);
                            return;
                        }
                    } catch (err) {
                        console.error("Failed to parse snapshot drop", err);
                    }
                }
            }

            const hasImage = Array.from(e.dataTransfer?.items || []).some(item => item.type && item.type.startsWith('image/'));
            if (hasImage) {
                const file = e.dataTransfer?.files?.[0];
                if (file && file.type.startsWith('image/')) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleImageInsert(file, e.clientX, e.clientY);
                }
            }
        }, { capture: true });

        domNode.addEventListener('paste', (e) => {
            const file = e.clipboardData?.files?.[0];
            if (file && file.type.startsWith('image/')) {
                e.preventDefault();
                e.stopPropagation();
                // Paste usually doesn't have ideal mouse coordinates, place near center if possible
                const rect = domNode.getBoundingClientRect();
                handleImageInsert(file, rect.left + rect.width / 2, rect.top + rect.height / 2);
            }
        }, { capture: true });

    };

    useEffect(() => {
        collaborationService.onCodeChange = (data) => {
            if (activeFileId) {
                // Update Zustand store
                updateFileContent(activeFileId, data.content);
                // Also update Monaco editor directly if we are looking at this file
                if (editorRef.current && activeFileIdRef.current === activeFileId) {
                    const currentModel = editorRef.current.getModel();
                    if (currentModel && currentModel.getValue() !== data.content) {
                        // Save selection
                        const selection = editorRef.current.getSelection();
                        editorRef.current.executeEdits('collaboration', [{
                            range: currentModel.getFullModelRange(),
                            text: data.content,
                            forceMoveMarkers: true
                        }]);
                        if (selection) {
                            editorRef.current.setSelection(selection);
                        }
                    }
                }
            }
        };
        return () => {
            collaborationService.onCodeChange = null;
        };
    }, [activeFileId, updateFileContent]);

    // Notify LSP client when active file changes
    useEffect(() => {
        if (activeFile && monacoRef.current) {
            const extMap = { python: 'py', javascript: 'js', typescript: 'ts', java: 'java', go: 'go', rust: 'rs', cpp: 'cpp', c: 'c', html: 'html', css: 'css', json: 'json', markdown: 'md' };
            const ext = extMap[activeFile.language] || activeFile.language;
            const fileUri = `file:///${activeFile.id}.${ext}`;
            // Use the current model value if available, otherwise fallback to store initial content
            const content = editorRef.current?.getModel()?.getValue() || initialContent;
            lspClient.openDocument(fileUri, activeFile.language, content);
        }
    }, [activeFile?.id, activeFile?.language]);


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
        sql: 'sql',
        roolts: 'javascript' // Use JS highlighting for Roolts
    };

    // Handle command visibility (Roolts mode)
    useEffect(() => {
        if (!editorRef.current || !activeFile) return;
        const editor = editorRef.current;
        const model = editor.getModel();
        if (!model) return;

        const syncVisibility = () => {
            if (!model || model.isDisposed()) return;
            const linesToHide = [];
            const lineCount = model.getLineCount();
            for (let i = 1; i <= lineCount; i++) {
                const lineContent = model.getLineContent(i);
                // Match #rooltscommand or // #rooltscommand or <!-- #rooltscommand or -- #rooltscommand
                // Improved regex to be more robust
                if (lineContent.match(/^\s*(#|\/\/|<!--|--)\s*#rooltscommand/)) {
                    linesToHide.push({
                        startLineNumber: i,
                        startColumn: 1,
                        endLineNumber: i,
                        endColumn: model.getLineMaxColumn(i)
                    });
                }
            }
            if (activeFile?.language === 'roolts' || activeFile?.name?.endsWith('.roolts')) {
                // Roolts mode only: hide command lines to keep the view clean
                editor.setHiddenAreas(linesToHide);
            } else {
                // All other languages: commands must remain visible so users can see/edit them
                editor.setHiddenAreas([]);
            }
        };

        // Delay to ensure Monaco is ready
        const timer = setTimeout(syncVisibility, 150);

        const disposable = model.onDidChangeContent(() => {
            syncVisibility();
        });

        return () => {
            clearTimeout(timer);
            disposable.dispose();
        };
    }, [activeFile?.id, activeFile?.language, editorRef.current]);

    const getMonacoTheme = (uiTheme) => {
        if (uiTheme === 'light' || uiTheme === 'solarized-light') return 'light';
        if (uiTheme === 'hc-black') return 'hc-black';
        if (uiTheme === 'vs-dark') return 'vs-dark';
        return uiTheme; // Assume it's a loaded custom extension theme
    };

    // ── Handle Snapshot Image Drop onto Editor ──
    const handleSnapshotDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            const jsonData = e.dataTransfer.getData('application/json');
            if (!jsonData) return;
            const data = JSON.parse(jsonData);
            if (data.type !== 'snapshot' || !data.src) return;

            const editor = editorRef.current;
            if (!editor || !activeFile) return;

            // Get line from drop position
            const target = editor.getTargetAtClientPoint(e.clientX, e.clientY);
            const lineNumber = target?.position?.lineNumber || 1;

            // Generate unique image ID
            const imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

            // Determine comment prefix for the language
            const lang = activeFile.language || 'plaintext';
            let commentPrefix = '#'; // default for Python
            if (['javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'go', 'kotlin', 'rust'].includes(lang)) {
                commentPrefix = '//';
            } else if (lang === 'html' || lang === 'xml') {
                commentPrefix = '<!--';
            }

            // The comment to insert
            const comment = `${commentPrefix} #rooltscommand placeimage id=${imageId} x=10 y=${(lineNumber - 1) * 20} w=200 h=150`;

            // Insert the comment as a new line at the target position
            const model = editor.getModel();
            if (!model) return;

            editor.executeEdits('snapshot-drop', [{
                range: {
                    startLineNumber: lineNumber,
                    startColumn: 1,
                    endLineNumber: lineNumber,
                    endColumn: 1
                },
                text: comment + '\n',
                forceMoveMarkers: true
            }]);

            // Store image data in file store so ImageCommandOverlay can render it
            addImage(activeFile.id, { id: imageId, src: data.src });

        } catch (err) {
            console.error('Snapshot drop failed:', err);
        }
    };

    return (
        <div style={{ height: '100%', width: '100%' }}>
            {!activeFile ? (
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
                        <button className="btn btn--primary" onClick={() => openModal('newFile')}>
                            <FiPlus /> New File
                        </button>
                        <button className="btn btn--secondary" onClick={() => {
                            if (!sidebarOpen) toggleSidebar();
                            window.dispatchEvent(new CustomEvent('open-project'));
                        }}>
                            <FiFolder /> Open Project
                        </button>
                    </div>
                </div>
            ) : (
                <div className="monaco-wrapper" style={{ position: 'relative', display: 'flex', flexDirection: 'row', height: '100%', width: '100%' }}>

                    <div
                        className={`editor-viewport ${backgroundImage && features.customBackground ? 'has-bg-media' : ''}`}
                        style={{
                            flex: isSplitMode ? '0 0 50%' : '1 1 100%',
                            width: isSplitMode ? '50%' : '100%',
                            maxWidth: isSplitMode ? '50%' : '100%',
                            position: 'relative',
                            height: '100%',
                            minWidth: 0,
                            display: showOutput && !isSplitMode ? 'none' : 'block',
                            overflow: 'hidden'
                        }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                        onDrop={handleSnapshotDrop}
                    >
                        {/* Background Media Layer */}
                        {backgroundImage && features.customBackground && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                zIndex: 0,
                                pointerEvents: 'none',
                                opacity: backgroundOpacity
                            }}>
                                {(backgroundImage.startsWith('data:video') || backgroundImage.match(/\.(mp4|webm|ogg)$/i)) ? (
                                    <video
                                        src={backgroundImage}
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        backgroundImage: `url(${backgroundImage})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        backgroundRepeat: 'no-repeat'
                                    }} />
                                )}
                            </div>
                        )}

                        <div style={{ position: 'relative', zIndex: 1, height: '100%', width: '100%', background: (backgroundImage && features.customBackground) ? 'transparent' : 'var(--bg-primary)', paddingLeft: `${leftDockWidth}px`, transition: 'padding-left 0.3s ease' }}>
                            <Editor
                                height="100%"
                                className={backgroundImage && features.customBackground ? 'monaco-transparent' : ''}
                                path={(function () {
                                    const extMap = { python: 'py', javascript: 'js', typescript: 'ts', java: 'java', go: 'go', rust: 'rs', cpp: 'cpp', c: 'c', html: 'html', css: 'css', json: 'json', markdown: 'md' };
                                    const ext = extMap[activeFile.language] || activeFile.language;
                                    return `file:///${activeFile.id}.${ext}`;
                                })()}
                                language={languageMap[activeFile.language] || 'plaintext'}
                                value={editorInitialValue}
                                onChange={(value) => {
                                    // 1. Send collaboration change immediately (already debounced in the service)
                                    collaborationService.sendCodeChange(value || '', activeFile.id);

                                    // 2. Debounce the heavy store and LSP updates
                                    debouncedUpdate(activeFile.id, value || '', activeFile.language, activeFile.name);
                                }}
                                theme={getMonacoTheme(theme)}
                                options={{
                                    // ── Typography ──
                                    fontFamily: format.fontFamily,
                                    fontSize: format.fontSize,
                                    lineHeight: format.lineHeight,
                                    fontLigatures: true,
                                    padding: { top: 16, bottom: 16 },

                                    // ── Minimap & Scroll ──
                                    minimap: { enabled: features.minimap, renderCharacters: false, scale: 2 },
                                    scrollBeyondLastLine: false,
                                    smoothScrolling: true,
                                    stickyScroll: { enabled: true },

                                    // ── Cursor ──
                                    cursorBlinking: 'smooth',
                                    cursorSmoothCaretAnimation: 'on',
                                    cursorStyle: 'line',
                                    multiCursorModifier: 'alt',

                                    // ── Whitespace & Wrapping ──
                                    renderWhitespace: 'selection',
                                    wordWrap: format.wordWrap,

                                    // ── Line Numbers & Highlighting ──
                                    lineNumbers: features.lineNumbers,
                                    renderLineHighlight: features.currentLineHighlight ? 'all' : 'none',
                                    lineDecorationsWidth: 10,
                                    glyphMargin: true,

                                    // ── Brackets ──
                                    autoClosingBrackets: 'always',
                                    autoClosingQuotes: 'always',
                                    autoClosingOvertype: 'always',
                                    autoSurround: 'languageDefined',
                                    bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
                                    guides: {
                                        bracketPairs: true,
                                        bracketPairsHorizontal: 'active',
                                        indentation: true,
                                        highlightActiveBracketPair: true,
                                        highlightActiveIndentation: true
                                    },
                                    matchBrackets: 'always',

                                    // ── Code Folding ──
                                    folding: true,
                                    foldingStrategy: 'auto',
                                    foldingHighlight: true,
                                    showFoldingControls: 'mouseover',
                                    foldingImportsByDefault: true,

                                    // ── Auto-close HTML Tags & Linked Editing ──
                                    autoClosingDelete: 'auto',
                                    linkedEditing: true,

                                    // ── IntelliSense & Suggestions ──
                                    quickSuggestions: { other: true, comments: false, strings: true },
                                    suggestOnTriggerCharacters: true,
                                    acceptSuggestionOnCommitCharacter: true,
                                    acceptSuggestionOnEnter: 'on',
                                    tabCompletion: 'on',
                                    wordBasedSuggestions: 'currentDocument',
                                    suggestSelection: 'first',
                                    suggest: {
                                        showMethods: true,
                                        showFunctions: true,
                                        showConstructors: true,
                                        showFields: true,
                                        showVariables: true,
                                        showClasses: true,
                                        showStructs: true,
                                        showInterfaces: true,
                                        showModules: true,
                                        showProperties: true,
                                        showEvents: true,
                                        showOperators: true,
                                        showUnits: true,
                                        showValues: true,
                                        showConstants: true,
                                        showEnums: true,
                                        showEnumMembers: true,
                                        showKeywords: true,
                                        showWords: true,
                                        showColors: true,
                                        showFiles: true,
                                        showReferences: true,
                                        showSnippets: true,
                                        insertMode: 'insert',
                                        filterGraceful: true,
                                        snippetsPreventQuickSuggestions: false,
                                        preview: true,
                                        previewMode: 'subwordSmart'
                                    },
                                    snippetSuggestions: 'top',
                                    parameterHints: { enabled: true, cycle: true },

                                    // ── Inlay Hints ──
                                    inlayHints: { enabled: 'on' },

                                    // ── Color Decorators (inline CSS color previews) ──
                                    colorDecorators: true,
                                    colorDecoratorsActivatedOn: 'clickAndHover',
                                    defaultColorDecorators: true,

                                    // ── Find & Replace ──
                                    find: {
                                        addExtraSpaceOnTop: true,
                                        autoFindInSelection: 'multiline',
                                        seedSearchStringFromSelection: 'always'
                                    },

                                    // ── Formatting ──
                                    formatOnPaste: true,
                                    formatOnType: true,
                                    autoIndent: 'advanced',
                                    trimAutoWhitespace: true,
                                    detectIndentation: true,

                                    // ── Hover & Tooltips ──
                                    hover: { enabled: true, delay: 300, sticky: true },

                                    // ── Context Menu ──
                                    contextmenu: true,

                                    // ── Diff & Inline ──
                                    renderValidationDecorations: 'on',

                                    // ── Drag & Drop (text selection drag) ──
                                    dragAndDrop: true,

                                    // ── Links ──
                                    links: true,

                                    // ── Accessibility ──
                                    accessibilitySupport: 'auto'
                                }}
                                onMount={handleEditorDidMount}
                            />

                            {activeFile && (
                                <ImageCommandOverlay
                                    fileId={activeFile.id}
                                    content={activeFile.content}
                                    editor={editorInstance}
                                    onDockLeftChange={setLeftDockWidth}
                                />
                            )}

                            {features.scribble && activeFile && (
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
                                    editor={editorInstance}
                                />
                            )}
                        </div>
                    </div>

                    {showOutput && (
                        <div style={{
                            flex: isSplitMode ? '0 0 50%' : '1 1 100%',
                            width: isSplitMode ? '50%' : '100%',
                            maxWidth: isSplitMode ? '50%' : '100%',
                            borderLeft: isSplitMode ? '1px solid var(--border-primary)' : 'none',
                            backgroundColor: 'var(--bg-primary)',
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: 0,
                            height: '100%',
                            overflow: 'hidden'
                        }}>
                            <OutputPanel />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default CodeEditor;
