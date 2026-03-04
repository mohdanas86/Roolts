/**
 * detectGUI.js
 * Detects whether a code snippet uses a GUI library that requires
 * the Xvfb-based GUI execution path instead of the regular terminal path.
 */

// Maps language -> list of { pattern: RegExp, label: string }
const GUI_PATTERNS = {
    python: [
        { pattern: /import\s+tkinter|from\s+tkinter/, label: 'Tkinter' },
        { pattern: /import\s+turtle|from\s+turtle/, label: 'Turtle' },
        { pattern: /import\s+pygame|from\s+pygame/, label: 'Pygame' },
        { pattern: /import\s+matplotlib|from\s+matplotlib/, label: 'Matplotlib' },
        { pattern: /import\s+PyQt5|from\s+PyQt5|import\s+PyQt6|from\s+PyQt6/, label: 'PyQt' },
        { pattern: /import\s+PySide2|from\s+PySide2|import\s+PySide6|from\s+PySide6/, label: 'PySide' },
        { pattern: /import\s+customtkinter|from\s+customtkinter/, label: 'CustomTkinter' },
        { pattern: /import\s+kivy|from\s+kivy/, label: 'Kivy' },
        { pattern: /import\s+wx|from\s+wx/, label: 'wxPython' },
        { pattern: /import\s+gi|from\s+gi/, label: 'GTK (gi)' },
    ],
    java: [
        { pattern: /import\s+javax\.swing/, label: 'Swing' },
        { pattern: /import\s+java\.awt/, label: 'AWT' },
        { pattern: /import\s+javafx/, label: 'JavaFX' },
    ],
};

/**
 * Returns true if the code uses a known GUI library for the given language.
 * @param {string} code
 * @param {string} language  e.g. "python", "java"
 * @returns {boolean}
 */
export function isGUICode(code, language) {
    if (!code || !language) return false;
    const lang = language.toLowerCase();
    const patterns = GUI_PATTERNS[lang];
    if (!patterns) return false;
    return patterns.some(({ pattern }) => pattern.test(code));
}

/**
 * Returns a human-readable label for the first detected GUI library.
 * Falls back to "GUI App" if the library is unrecognised.
 * @param {string} code
 * @param {string} language
 * @returns {string}
 */
export function detectGUILibrary(code, language) {
    if (!code || !language) return 'GUI App';
    const lang = language.toLowerCase();
    const patterns = GUI_PATTERNS[lang];
    if (!patterns) return 'GUI App';
    const match = patterns.find(({ pattern }) => pattern.test(code));
    return match ? match.label : 'GUI App';
}
