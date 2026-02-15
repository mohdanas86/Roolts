const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8081;

// Temp directory for code files
const TEMP_DIR = path.join(os.tmpdir(), 'roolts-executor');

// Ensure temp directory exists
async function ensureTempDir() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (e) {
        // Ignore if exists
    }
}

// Health check
app.get('/api/executor/health', (req, res) => {
    res.json({ status: 'OK', service: 'Roolts Code Executor (Node.js)' });
});

// List supported languages
app.get('/api/executor/languages', async (req, res) => {
    const languages = [
        { id: 'python', name: 'Python', extension: '.py', command: 'python' },
        { id: 'javascript', name: 'JavaScript', extension: '.js', command: 'node' },
        { id: 'java', name: 'Java', extension: '.java', command: 'java' }
    ];

    // Check availability
    for (const lang of languages) {
        try {
            await execPromise(`${lang.command} --version`);
            lang.available = true;
        } catch {
            lang.available = false;
        }
    }

    res.json(languages);
});

// Execute code
app.post('/api/executor/execute', async (req, res) => {
    const { code, language } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: 'Code and language are required' });
    }

    try {
        await ensureTempDir();
        const result = await executeCode(code, language);
        res.json(result);
    } catch (error) {
        res.json({
            success: false,
            error: error.message || 'Execution failed',
            output: ''
        });
    }
});

// Promise wrapper for exec
function execPromise(command, options = {}) {
    return new Promise((resolve, reject) => {
        exec(command, { timeout: 30000, maxBuffer: 1024 * 1024, ...options }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
            } else {
                resolve(stdout);
            }
        });
    });
}

// Execute code based on language
async function executeCode(code, language) {
    const timestamp = Date.now();
    let filename, command;

    switch (language.toLowerCase()) {
        case 'python':
            filename = path.join(TEMP_DIR, `temp_${timestamp}.py`);
            await fs.writeFile(filename, code);
            command = `python "${filename}"`;
            break;

        case 'javascript':
            // Check if code contains JSX syntax (React code)
            const jsxPatterns = [
                /<[A-Z][a-zA-Z]*\s/,        // React component like <App or <Component
                /<[a-z]+\s+className=/,      // JSX className attribute
                /React\./,                    // React usage
                /import\s+React/,            // React import
                /from\s+['"]react['"]/,      // React import
                /<\/[a-zA-Z]+>/              // Closing JSX tags
            ];

            const hasJSX = jsxPatterns.some(pattern => pattern.test(code));
            if (hasJSX) {
                return {
                    success: false,
                    error: '⚠️ This appears to be React/JSX code which cannot be executed directly in Node.js.\n\n' +
                        'JSX requires transpilation (Babel) to run. The Run button is designed for:\n' +
                        '• Plain JavaScript (console.log, functions, etc.)\n' +
                        '• Python scripts\n' +
                        '• Java programs\n\n' +
                        'To test React code, use the browser preview or run the development server.',
                    output: ''
                };
            }

            filename = path.join(TEMP_DIR, `temp_${timestamp}.js`);
            await fs.writeFile(filename, code);
            command = `node "${filename}"`;
            break;

        case 'java':
            // Java requires class name to match filename
            const classMatch = code.match(/public\s+class\s+(\w+)/);
            const className = classMatch ? classMatch[1] : 'Main';
            filename = path.join(TEMP_DIR, `${className}.java`);
            await fs.writeFile(filename, code);
            // Compile and run
            try {
                await execPromise(`javac "${filename}"`, { cwd: TEMP_DIR });
                command = `java -cp "${TEMP_DIR}" ${className}`;
            } catch (compileError) {
                return {
                    success: false,
                    error: `Compilation error: ${compileError.message}`,
                    output: ''
                };
            }
            break;

        default:
            return {
                success: false,
                error: `Unsupported language: ${language}`,
                output: ''
            };
    }

    try {
        const output = await execPromise(command);
        // Cleanup
        try {
            await fs.unlink(filename);
            if (language.toLowerCase() === 'java') {
                const classFile = filename.replace('.java', '.class');
                await fs.unlink(classFile).catch(() => { });
            }
        } catch (e) {
            // Ignore cleanup errors
        }

        return {
            success: true,
            output: output.trim(),
            error: null
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            output: ''
        };
    }
}

app.listen(PORT, () => {
    console.log(`🚀 Roolts Code Executor running on http://127.0.0.1:${PORT}`);
    console.log(`   Health: http://127.0.0.1:${PORT}/api/executor/health`);
    console.log(`   Languages: http://127.0.0.1:${PORT}/api/executor/languages`);
});

