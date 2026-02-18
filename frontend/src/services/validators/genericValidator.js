/**
 * Generic Syntax Validator
 * Provides basic syntax validation for languages without specific validators
 */

export const genericValidator = {
    /**
     * Validate code for basic syntax issues
     * @param {string} code - Code to validate
     * @param {string} language - Programming language
     * @returns {Array} Array of validation results
     */
    validate(code, language) {
        const results = [];
        
        // Validate brackets
        results.push(...this.validateBrackets(code));
        
        // Validate quotes
        results.push(...this.validateQuotes(code));
        
        return results;
    },

    /**
     * Validate bracket matching
     * @param {string} code - Code to validate
     * @returns {Array} Array of bracket errors
     */
    validateBrackets(code) {
        const errors = [];
        const lines = code.split('\n');
        const brackets = {
            '(': ')',
            '[': ']',
            '{': '}'
        };
        
        const stack = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            
            let inString = false;
            let stringChar = null;
            let inComment = false;
            
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                const nextChar = line[j + 1];
                
                // Handle single-line comments
                if (!inString && char === '/' && nextChar === '/') {
                    inComment = true;
                    break;
                }
                
                // Handle strings
                if ((char === '"' || char === "'" || char === '`') && (j === 0 || line[j-1] !== '\\')) {
                    if (!inString) {
                        inString = true;
                        stringChar = char;
                    } else if (char === stringChar) {
                        inString = false;
                        stringChar = null;
                    }
                    continue;
                }
                
                if (inString || inComment) continue;
                
                // Track opening brackets
                if (brackets[char]) {
                    stack.push({
                        char,
                        line: lineNum,
                        column: j + 1
                    });
                }
                // Track closing brackets
                else if (Object.values(brackets).includes(char)) {
                    if (stack.length === 0) {
                        errors.push({
                            startLine: lineNum,
                            endLine: lineNum,
                            startColumn: j + 1,
                            endColumn: j + 2,
                            message: `Syntax Error: Unmatched closing bracket '${char}'`,
                            severity: 8
                        });
                    } else {
                        const last = stack.pop();
                        if (brackets[last.char] !== char) {
                            errors.push({
                                startLine: lineNum,
                                endLine: lineNum,
                                startColumn: j + 1,
                                endColumn: j + 2,
                                message: `Syntax Error: Mismatched brackets (expected '${brackets[last.char]}', got '${char}')`,
                                severity: 8
                            });
                        }
                    }
                }
            }
        }
        
        // Check for unclosed brackets
        for (const item of stack) {
            errors.push({
                startLine: item.line,
                endLine: item.line,
                startColumn: item.column,
                endColumn: item.column + 1,
                message: `Syntax Error: Unclosed bracket '${item.char}' (expected '${brackets[item.char]}')`,
                severity: 8
            });
        }
        
        return errors;
    },

    /**
     * Validate quote matching
     * @param {string} code - Code to validate
     * @returns {Array} Array of quote errors
     */
    validateQuotes(code) {
        const errors = [];
        const lines = code.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            
            let inString = false;
            let stringChar = null;
            let stringStart = 0;
            
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                
                // Check for quote characters
                if (char === '"' || char === "'" || char === '`') {
                    // Skip escaped quotes
                    if (j > 0 && line[j-1] === '\\') {
                        continue;
                    }
                    
                    if (!inString) {
                        inString = true;
                        stringChar = char;
                        stringStart = j;
                    } else if (char === stringChar) {
                        inString = false;
                        stringChar = null;
                    }
                }
            }
            
            // Check for unclosed string
            if (inString) {
                errors.push({
                    startLine: lineNum,
                    endLine: lineNum,
                    startColumn: stringStart + 1,
                    endColumn: line.length + 1,
                    message: `Syntax Error: Unterminated string literal (missing closing ${stringChar})`,
                    severity: 8
                });
            }
        }
        
        return errors;
    }
};
