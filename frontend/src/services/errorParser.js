/**
 * Error Parser Utility
 * Extracts line numbers and error messages from compiler/interpreter output
 */

export const errorParser = {
    /**
     * Parse errors based on language
     */
    parse: (errorStr, language, fileName) => {
        if (!errorStr || typeof errorStr !== 'string') return [];

        // Strip ANSI escape codes
        const cleanError = errorStr.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

        const lang = language.toLowerCase();
        let markers = [];

        switch (lang) {
            case 'python':
                markers = errorParser.parsePython(cleanError, fileName);
                break;
            case 'javascript':
            case 'nodejs':
            case 'typescript':
                markers = errorParser.parseJavaScript(cleanError, fileName);
                break;
            case 'java':
                markers = errorParser.parseJava(cleanError, fileName);
                break;
            case 'c':
            case 'cpp':
                markers = errorParser.parseCpp(cleanError, fileName);
                break;
            case 'go':
                markers = errorParser.parseGo(cleanError, fileName);
                break;
            default:
                markers = errorParser.parseGeneric(cleanError, fileName);
                break;
        }

        // Final safety filter: ensure markers only point to the active file if filename is included in error
        return markers.filter(m => {
            if (!m.file || m.file === 'untitled' || m.file === '<stdin>') return true;
            return m.file.toLowerCase().includes(fileName.toLowerCase()) ||
                fileName.toLowerCase().includes(m.file.toLowerCase());
        });
    },

    /**
     * Parse Python tracebacks
     * Example: File "main.py", line 5, in <module>
     */
    parsePython: (errorStr) => {
        const markers = [];
        const lines = errorStr.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match Traceback: File "main.py", line 5, in <module>
            // Also File "<stdin>", line 1
            const fileLineMatch = line.match(/File "([^"]+)", line (\d+)/) ||
                line.match(/File <([^>]+)>, line (\d+)/);

            if (fileLineMatch) {
                const lineNumber = parseInt(fileLineMatch[2]);
                // Look ahead for error message (usually the last line or the first line starting without spaces)
                let message = "Python Error";
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();
                    if (nextLine && !lines[j].startsWith('  ') && !nextLine.startsWith('^')) {
                        message = nextLine;
                        break;
                    }
                }

                const isWarning = message.toLowerCase().includes('warning') ||
                    message.toLowerCase().includes('deprecation');

                markers.push({
                    startLineNumber: lineNumber,
                    endLineNumber: lineNumber,
                    startColumn: 1,
                    endColumn: 1000,
                    message: message,
                    severity: isWarning ? 4 : 8
                });
            }
        }

        // Catch Syntax/Indentation errors that might be on a single line or specific format
        if (markers.length === 0) {
            // Match: IndentationError: ... (line 5)
            // Match: line 5: IndentationError
            const lineMatch = errorStr.match(/(\d+): (SyntaxError|IndentationError|TabError)/) ||
                errorStr.match(/(SyntaxError|IndentationError|TabError).*line (\d+)/i) ||
                errorStr.match(/line (\d+)/i);

            if (lineMatch) {
                const lineNumber = parseInt(lineMatch[1].match(/^\d+$/) ? lineMatch[1] : lineMatch[2]);
                const message = errorStr.split('\n').find(l => l.includes('Error')) || errorStr.split('\n').pop().trim() || "Python Syntax Error";
                markers.push({
                    startLineNumber: lineNumber,
                    endLineNumber: lineNumber,
                    startColumn: 1,
                    endColumn: 1000,
                    message: message,
                    severity: 8
                });
            }
        }

        return markers;
    },

    /**
     * Parse JavaScript/Node.js errors
     */
    parseJavaScript: (errorStr) => {
        const markers = [];
        const lines = errorStr.split('\n');

        for (const line of lines) {
            const match = line.match(/(?:\w+:)?[:\/\w.-]+:(\d+)(?::(\d+))?/);
            if (match) {
                const lineNumber = parseInt(match[1]);
                const column = match[2] ? parseInt(match[2]) : 1;
                const message = errorStr.split('\n').find(l => l.includes('Error:') || l.includes('Warning:')) || lines[0];
                const isWarning = message.toLowerCase().includes('warning');

                markers.push({
                    startLineNumber: lineNumber,
                    endLineNumber: lineNumber,
                    startColumn: column,
                    endColumn: column + 10,
                    message: message.trim(),
                    severity: isWarning ? 4 : 8
                });
                break;
            }
        }
        return markers;
    },

    /**
     * Parse Java errors
     */
    parseJava: (errorStr) => {
        const markers = [];
        const lines = errorStr.split('\n');

        for (const line of lines) {
            const match = line.match(/(?:[a-zA-Z]:)?[^:]+\.java:(\d+): (error|warning): (.+)/);
            if (match) {
                markers.push({
                    startLineNumber: parseInt(match[1]),
                    endLineNumber: parseInt(match[1]),
                    startColumn: 1,
                    endColumn: 1000,
                    message: match[3],
                    severity: match[2].toLowerCase().includes('warning') ? 4 : 8
                });
            }
        }
        return markers;
    },

    /**
     * Parse C/C++ errors
     */
    parseCpp: (errorStr) => {
        const markers = [];
        const lines = errorStr.split('\n');

        for (const line of lines) {
            const match = line.match(/[\w.-]+:(\d+):(\d+): (error|warning): (.+)/);
            if (match) {
                markers.push({
                    startLineNumber: parseInt(match[1]),
                    endLineNumber: parseInt(match[1]),
                    startColumn: parseInt(match[2]),
                    endColumn: parseInt(match[2]) + 5,
                    message: match[4],
                    severity: match[3].toLowerCase().includes('warning') ? 4 : 8
                });
            } else {
                const match2 = line.match(/[\w.-]+:(\d+): (error|warning): (.+)/);
                if (match2) {
                    markers.push({
                        startLineNumber: parseInt(match2[1]),
                        endLineNumber: parseInt(match2[1]),
                        startColumn: 1,
                        endColumn: 1000,
                        message: match2[3],
                        severity: match2[2].toLowerCase().includes('warning') ? 4 : 8
                    });
                }
            }
        }
        return markers;
    },

    /**
     * Parse Go errors
     */
    parseGo: (errorStr) => {
        const markers = [];
        const lines = errorStr.split('\n');

        for (const line of lines) {
            // Match: file.go:5:2: message (can be warning or error)
            const match = line.match(/[\w.-]+\.go:(\d+):(\d+): (.+)/);
            if (match) {
                const message = match[3];
                const isWarning = message.toLowerCase().includes('warning');
                markers.push({
                    startLineNumber: parseInt(match[1]),
                    endLineNumber: parseInt(match[1]),
                    startColumn: parseInt(match[2]),
                    endColumn: parseInt(match[2]) + 5,
                    message: message,
                    severity: isWarning ? 4 : 8
                });
            }
        }
        return markers;
    },

    /**
     * Generic parser for unknown formats
     */
    parseGeneric: (errorStr, fileName) => {
        const markers = [];
        if (!errorStr || typeof errorStr !== 'string') return [];

        const lines = errorStr.split('\n');
        for (const line of lines) {
            const lineMatch = line.match(/line (\d+)/i) || line.match(/:(\d+)/);
            if (lineMatch) {
                const message = line.trim();
                const isWarning = message.toLowerCase().includes('warning') ||
                    message.toLowerCase().includes('info') ||
                    message.toLowerCase().includes('hint');

                markers.push({
                    startLineNumber: parseInt(lineMatch[1]),
                    endLineNumber: parseInt(lineMatch[1]),
                    startColumn: 1,
                    endColumn: 1000,
                    message: message || errorStr.split('\n')[0],
                    severity: isWarning ? 4 : 8
                });
            }
        }
        return markers;
    },

    /**
     * Real-time naming and structural validation (e.g. Java class name match)
     */
    validateNaming: (code, language, fileName) => {
        const markers = [];
        if (!code || language !== 'java') return [];

        const publicClassMatch = code.match(/public\s+class\s+(\w+)/);
        if (publicClassMatch) {
            const className = publicClassMatch[1];
            const expectedFileName = `${className}.java`;

            if (fileName !== expectedFileName) {
                const lines = code.split('\n');
                let lineNumber = 1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(`class ${className}`)) {
                        lineNumber = i + 1;
                        break;
                    }
                }

                markers.push({
                    startLineNumber: lineNumber,
                    endLineNumber: lineNumber,
                    startColumn: 1,
                    endColumn: 100,
                    message: `Java class '${className}' must be defined in a file named '${expectedFileName}'`,
                    severity: 8 // Error
                });
            }
        }
        return markers;
    }
};
