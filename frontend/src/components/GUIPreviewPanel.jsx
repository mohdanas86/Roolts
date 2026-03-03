import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

/**
 * Logic to generate GUI data (srcDoc) based on code and language.
 * Extracted from the previous GUIAutoTrigger logic.
 */
export const getGuiData = (code, language) => {
    const lang = (language || '').toLowerCase();
    const isWeb = lang === 'html' || lang === 'jsx' || lang === 'javascript' || lang === 'js' || (lang === 'xml' && code.includes('html')) || code.includes('<!DOCTYPE html>');
    const isPython = lang === 'python' || lang === 'py' || lang === 'python3';
    const isGo = lang === 'go' || lang === 'golang';
    const isJava = lang === 'java';

    let srcDoc = '';
    let type = null;

    if (isWeb) {
        type = 'web';
        const cssContent = `body { margin: 0; padding: 24px; font-family: system-ui; background: white; }`;
        srcDoc = language === 'html'
            ? `<!DOCTYPE html><html><head><style>${cssContent}</style></head><body>${code}</body></html>`
            : `<!DOCTYPE html><html><head>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></script>
                </head><body><div id="root"></div><script type="text/babel">
                    try {
                        const { useState, useEffect, useRef } = React;
                        ${code.replace(/export\s+default\s+function\s+(\w+)/, 'function $1').replace(/export\s+default\s+(\w+)/, '')}
                        const componentName = '${code.match(/function\s+(\w+)/)?.[1] || code.match(/const\s+(\w+)\s*=\s*\(/)?.[1] || 'App'}';
                        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(eval(componentName)));
                    } catch(e) { document.body.innerHTML = e.message; }
                </script></body></html>`;
    } else if (isPython) {
        type = 'python';
        srcDoc = `<!DOCTYPE html><html><head>
                <script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"></script>
                <style>body { margin: 0; padding: 24px; background: #fff; font-family: system-ui; }</style>
            </head><body><div id="py-output"></div><canvas id="canvas"></canvas><script>
                async function main() {
                    try {
                        const pyodide = await loadPyodide();
                        await pyodide.loadPackage(["matplotlib", "numpy", "pandas"]);
                        const result = await pyodide.runPythonAsync(\`${code.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);
                        if (result) document.getElementById('py-output').innerHTML = '<pre>'+result+'</pre>';
                    } catch(e) { document.body.innerHTML = '<pre style="color:red">'+e.message+'</pre>'; }
                }
                main();
            </script></body></html>`;
    } else if (isGo) {
        type = 'go';
        srcDoc = `<!DOCTYPE html><html><head>
                <style>body { margin: 0; padding: 24px; background: #00add8; color: white; font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; }</style>
            </head><body><div><h2>Go Online App</h2><p>Running WASM...</p><pre style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">${code.substring(0, 100)}...</pre></div></body></html>`;
    } else if (isJava) {
        type = 'java';
        const className = code.match(/public\s+class\s+(\w+)/)?.[1] || 'App';
        srcDoc = `<!DOCTYPE html><html><head>
                <style>body { margin: 0; padding: 24px; background: #f3f3f3; font-family: serif; display: flex; align-items: center; justify-content: center; height: 100vh; }</style>
            </head><body><div style="background: white; border: 1px solid #ccc; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <h3>Java Runtime Preview</h3>
                <p>Simulating <b>${className}</b>...</p>
                <div style="background: #222; color: #0f0; padding: 10px; font-family: monospace; font-size: 12px;">> java ${className} initializing...</div>
            </div></body></html>`;
    }

    return type ? { srcDoc, type, code } : null;
};

const GUIPreviewPanel = ({ activeGui, onClose }) => {
    if (!activeGui) return null;

    return (
        <div className="gui-integrated-preview">
            <div className="gui-integrated-header">
                <div className="gui-status-dot"></div>
                <span className="gui-label">ONLINE APP PREVIEW — {activeGui.type.toUpperCase()}</span>
                <div style={{ flex: 1 }} />
                <button onClick={onClose} className="gui-close-btn" title="Close Preview">
                    <FiX size={14} />
                </button>
            </div>
            <div className="gui-integrated-content">
                <iframe
                    srcDoc={activeGui.srcDoc}
                    sandbox="allow-scripts"
                    title="GUI Preview"
                    style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                />
            </div>
        </div>
    );
};

export default GUIPreviewPanel;
