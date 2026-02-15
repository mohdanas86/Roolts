import React, { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

const WebPreview = ({ files, activeFileId, onClose }) => {
    const [srcDoc, setSrcDoc] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        // Small timeout to allow UI to show loading state
        const timer = setTimeout(() => {
            generatePreview();
        }, 100);
        return () => clearTimeout(timer);
    }, [files, activeFileId]);

    const generatePreview = () => {
        const activeFile = files.find(f => f.id === activeFileId);
        if (!activeFile) return;

        // Use fast Cloudflare CDN
        const REACT_CDN = `
            <script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
            <script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></script>
        `;

        // Collect all CSS
        const cssContent = files
            .filter(f => f.name.endsWith('.css'))
            .map(f => f.content)
            .join('\n');

        const styles = `<style>${cssContent}</style>`;

        // Common Loading Indicator Script
        const loadingScript = `
            <div id="preview-loading" style="position:fixed;top:0;left:0;right:0;bottom:0;background:white;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;color:#666;">
                <div style="text-align:center">
                    <div style="border:3px solid #f3f3f3;border-top:3px solid #3498db;border-radius:50%;width:24px;height:24px;animation:spin 1s linear infinite;margin:0 auto 10px;"></div>
                    <div>Loading resources...</div>
                </div>
            </div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            <script>
                window.onload = function() {
                    const loader = document.getElementById('preview-loading');
                    if(loader) loader.style.display = 'none';
                };
            </script>
        `;

        // Check if we have an index.html
        const indexHtml = files.find(f => f.name === 'index.html');
        if (activeFile.name.endsWith('.html') || indexHtml) {
            const baseContent = (activeFile.name.endsWith('.html') ? activeFile.content : indexHtml?.content) || '';

            if (baseContent) {
                let content = baseContent.replace('</head>', `${styles}</head>`);

                // Inline JS files
                content = content.replace(/<script\s+src=["']([^"']+)["'][^>]*>\s*<\/script>/g, (match, src) => {
                    const cleanSrc = src.replace('./', '').replace('/', '');
                    const jsFile = files.find(f => f.name === cleanSrc || f.path?.endsWith(cleanSrc));
                    return jsFile ? `<script>${jsFile.content}</script>` : match;
                });

                setSrcDoc(content);
                setIsLoading(false);
                return;
            }
        }

        // React/JSX
        if (activeFile.language === 'javascript' || activeFile.name.endsWith('.jsx')) {
            const isReact = activeFile.content.includes('import React') || activeFile.content.includes('export default');

            if (isReact) {
                // Transform imports
                const processedCode = activeFile.content
                    .replace(/import\s+React.*from\s+['"]react['"];?/g, 'const { useState, useEffect, useRef } = React;')
                    .replace(/import\s+ReactDOM.*from\s+['"]react-dom\/client['"];?/g, 'const ReactDOM = window.ReactDOM;')
                    .replace(/export\s+default\s+function\s+(\w+)/g, 'function $1')
                    .replace(/export\s+default\s+(\w+)/g, '');

                // Robust component name finding
                let componentName = 'App';
                const functionMatch = activeFile.content.match(/function\s+(\w+)/);
                const constMatch = activeFile.content.match(/const\s+(\w+)\s*=\s*\(/);
                if (functionMatch) componentName = functionMatch[1];
                else if (constMatch) componentName = constMatch[1];

                const html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8" />
                        ${REACT_CDN}
                        ${styles}
                        <style>
                            body { margin: 0; padding: 1rem; font-family: system-ui, sans-serif; }
                            #root { height: 100%; }
                        </style>
                    </head>
                    <body>
                        ${loadingScript}
                        <div id="root"></div>
                        <script type="text/babel">
                            try {
                                ${processedCode}
                                
                                const root = ReactDOM.createRoot(document.getElementById('root'));
                                root.render(<${componentName} />);
                                
                                // Hide loader immediately after render starts
                                const loader = document.getElementById('preview-loading');
                                if(loader) loader.style.display = 'none';

                            } catch (err) {
                                document.getElementById('preview-loading').style.display = 'none';
                                document.body.innerHTML = '<div style="color: #d32f2f; padding: 16px; background: #ffebee; border-left: 4px solid #d32f2f;">' + 
                                    '<h3 style="margin-top:0">Runtime Error</h3><pre style="white-space:pre-wrap">' + err.message + '</pre></div>';
                                console.error(err);
                            }
                        </script>
                    </body>
                    </html>
                `;
                setSrcDoc(html);
            } else {
                // Plain JS
                const html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8" />
                        ${styles}
                    </head>
                    <body>
                        <div id="app"></div>
                        <script>
                            try {
                                ${activeFile.content}
                            } catch (err) {
                                document.body.innerHTML += '<div style="color: red; padding: 1rem;">' + err.message + '</div>';
                            }
                        </script>
                    </body>
                    </html>
                `;
                setSrcDoc(html);
            }
        }
        setIsLoading(false);
    };

    return (
        <div style={{ width: '100%', height: '100%', background: 'white', position: 'relative' }}>
            {/* Close Button */}
            {onClose && (
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        zIndex: 100,
                        background: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title="Close Preview"
                >
                    <FiX size={16} />
                </button>
            )}

            {isLoading && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'white', zIndex: 10, color: '#666'
                }}>
                    <span className="spinner" style={{ marginRight: '8px' }}></span> Initializing Preview...
                </div>
            )}
            <iframe
                srcDoc={srcDoc}
                title="Preview"
                style={{ width: '100%', height: '100%', border: 'none' }}
                sandbox="allow-scripts allow-modals"
            />
        </div>
    );
};

export default WebPreview;
