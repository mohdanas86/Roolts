/**
 * Monaco Extension Loader Service
 * Handles the registration of snippets and language features 
 * extracted from real VS Code extension packages.
 */

import { useExtensionStore } from '../store';

class ExtensionLoader {
    constructor() {
        this.registeredProviders = new Set();
        this.isInitialized = false;
    }

    /**
     * Load all contributions from currently installed extensions
     */
    async loadActiveExtensions(monaco) {
        if (!monaco) return;

        console.log(">>> ExtensionLoader: Loading active extensions...");
        const { installedExtensions } = useExtensionStore.getState();

        // Clear old ones (optional but safer for dynamic install/uninstall)
        this.disposeAll();

        installedExtensions.forEach(ext => {
            if (ext.snippets && ext.snippets.length > 0) {
                this.registerExtensionSnippets(monaco, ext);
            }
            if (ext.themes && ext.themes.length > 0) {
                this.registerExtensionThemes(monaco, ext);
            }
        });

        this.isInitialized = true;
    }

    /**
     * Register themes from a specific extension
     */
    async registerExtensionThemes(monaco, ext) {
        if (!ext.themes || ext.themes.length === 0) return;

        for (const theme of ext.themes) {
            try {
                // Fetch theme file from backend
                const themePath = theme.path.replace(/^\.\//, '');
                const response = await fetch(`/api/extensions/file/${ext.id}/${themePath}`);
                if (!response.ok) throw new Error('Failed to fetch theme file');

                const themeData = await response.json();

                // Convert VS Code theme to Monaco theme
                const monacoTheme = this.convertTheme(themeData);

                // Define theme
                // Use a safe ID: extensionId-themeId or just label?
                // Let's use the label or id provided in contribution
                const themeId = theme.id || theme.label || themeData.name;
                // Add extension namespace to avoid collisions?
                // For now, simple ID to make it easy to select in settings
                // But typically themes have a name/label in UI.
                const finalThemeId = theme.label || themeId;

                monaco.editor.defineTheme(finalThemeId, monacoTheme);
                console.log(`>>> Defined theme: ${finalThemeId}`);

                // Store mapped theme info for UI selector?
                // For now, we rely on Monaco registry or Settings store to know available themes?
                // But Monaco doesn't expose a list of defined themes easily. 
                // We should probably register it in our Settings Store or a Theme Store.
                // But let's first get it defined in Monaco.
            } catch (err) {
                console.error(`Failed to load theme ${theme.label} from ${ext.id}:`, err);
            }
        }
    }

    convertTheme(vscodeTheme) {
        // Basic conversion. VS Code themes are complex.
        // Monaco expects { base: 'vs'|'vs-dark'|'hc-black', inherit: bool, rules: [], colors: {} }

        const isDark = vscodeTheme.type === 'dark' || (vscodeTheme.name && vscodeTheme.name.toLowerCase().includes('dark'));
        const base = isDark ? 'vs-dark' : 'vs';

        const rules = [];
        if (vscodeTheme.tokenColors) {
            // Flatten tokenColors if necessary
            const tokens = Array.isArray(vscodeTheme.tokenColors) ? vscodeTheme.tokenColors : [];
            tokens.forEach(token => {
                if (token.scope && token.settings) {
                    const scopes = Array.isArray(token.scope) ? token.scope : token.scope.split(',').map(s => s.trim());
                    scopes.forEach(scope => {
                        rules.push({
                            token: scope,
                            foreground: token.settings.foreground,
                            background: token.settings.background,
                            fontStyle: token.settings.fontStyle
                        });
                    });
                }
            });
        }

        return {
            base: base,
            inherit: true,
            rules: rules,
            colors: vscodeTheme.colors || {}
        };
    }

    /**
     * Register snippets from a specific extension
     */
    registerExtensionSnippets(monaco, ext) {
        ext.snippets.forEach(snippetSet => {
            const language = snippetSet.language;
            if (!language) return;

            try {
                // Snippet content is a JSON string or object
                const snippetsRaw = typeof snippetSet.content === 'string'
                    ? JSON.parse(snippetSet.content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '')) // Strip comments
                    : snippetSet.content;

                const provider = monaco.languages.registerCompletionItemProvider(language, {
                    provideCompletionItems: (model, position) => {
                        const suggestions = [];

                        for (const name in snippetsRaw) {
                            const snippet = snippetsRaw[name];
                            const body = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;

                            suggestions.push({
                                label: snippet.prefix || name,
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                documentation: snippet.description || name,
                                insertText: body,
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: `From Extension: ${ext.displayName}`
                            });
                        }

                        return { suggestions };
                    }
                });

                this.registeredProviders.add(provider);
                console.log(`>>> Registered snippets for ${language} from ${ext.displayName}`);
            } catch (err) {
                console.error(`Failed to parse snippets for ${language} in ${ext.id}:`, err);
            }
        });
    }

    /**
     * Clean up all registered providers
     */
    disposeAll() {
        this.registeredProviders.forEach(p => {
            if (p && typeof p.dispose === 'function') {
                p.dispose();
            }
        });
        this.registeredProviders.clear();
    }
}

export const extensionLoader = new ExtensionLoader();
