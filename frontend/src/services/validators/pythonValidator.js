/**
 * Python Validator
 * Validates Python code for indentation and syntax errors
 */

export const pythonValidator = {
    /**
     * Validate Python code
     * @param {string} code - Python code to validate
     * @returns {Array} Array of validation results
     */
    validate(code) {
        const results = [];
        
        // Validate indentation
        results.push(...this.validateIndentation(code));
        
        // Validate syntax patterns
        results.push(...this.validateSyntax(code));
        
        return results;
    },

    /**
     * Validate Python indentation
     * @param {string} code - Python code
     * @returns {Array} Array of indentation errors
     */
    validateIndentation(code) {
        const errors = [];
        const lines = code.split('\n');
        
        let expectedIndent = 0;
        let indentStack = [0];
        let usesSpaces = null; // null = unknown, true = spaces, false = tabs
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            
            // Skip empty lines and comments
            if (line.trim() === '' || line.trim().startsWith('#')) {
                continue;
            }
            
            // Detect indentation type
            const leadingWhitespace = line.match(/^[\t ]*/)[0];
            const hasSpaces = leadingWhitespace.includes(' ');
            const hasTabs = leadingWhitespace.includes('\t');
            
            // Check for mixed tabs and spaces
            if (hasSpaces && hasTabs) {
                errors.push({
                    startLine: lineNum,
                    endLine: lineNum,
                    startColumn: 1,
                    endColumn: leadingWhitespace.length + 1,
                    message: 'IndentationError: Mixed tabs and spaces in indentation',
                    severity: 8 // Error
                });
                continue;
            }
            
            // Determine indentation type on first indented line
            if (usesSpaces === null && leadingWhitespace.length > 0) {
                usesSpaces = hasSpaces;
            }
            
            // Check for inconsistent indentation type
            if (usesSpaces !== null && leadingWhitespace.length > 0) {
                if (usesSpaces && hasTabs) {
                    errors.push({
                        startLine: lineNum,
                        endLine: lineNum,
                        startColumn: 1,
                        endColumn: leadingWhitespace.length + 1,
                        message: 'IndentationError: Expected spaces but found tabs',
                        severity: 8
                    });
                    continue;
                } else if (!usesSpaces && hasSpaces) {
                    errors.push({
                        startLine: lineNum,
                        endLine: lineNum,
                        startColumn: 1,
                        endColumn: leadingWhitespace.length + 1,
                        message: 'IndentationError: Expected tabs but found spaces',
                        severity: 8
                    });
                    continue;
                }
            }
            
            // Calculate indent level (4 spaces = 1 level, 1 tab = 1 level)
            const currentIndent = usesSpaces 
                ? Math.floor(leadingWhitespace.length / 4)
                : leadingWhitespace.length;
            
            // Check if previous line increases indent (ends with :)
            if (i > 0) {
                const prevLine = lines[i - 1].trim();
                const shouldIndent = prevLine.endsWith(':') && 
                                   !prevLine.startsWith('#') &&
                                   prevLine !== '';
                
                if (shouldIndent) {
                    // Expect indent to increase
                    const lastIndent = indentStack[indentStack.length - 1];
                    if (currentIndent <= lastIndent) {
                        errors.push({
                            startLine: lineNum,
                            endLine: lineNum,
                            startColumn: 1,
                            endColumn: leadingWhitespace.length + 1,
                            message: `IndentationError: Expected an indented block (expected ${lastIndent + 1} level, got ${currentIndent})`,
                            severity: 8
                        });
                    } else {
                        indentStack.push(currentIndent);
                    }
                } else {
                    // Check if indent decreased properly
                    while (indentStack.length > 1 && currentIndent < indentStack[indentStack.length - 1]) {
                        indentStack.pop();
                    }
                    
                    // Check if indent matches a level in the stack
                    if (!indentStack.includes(currentIndent)) {
                        const expected = indentStack[indentStack.length - 1];
                        errors.push({
                            startLine: lineNum,
                            endLine: lineNum,
                            startColumn: 1,
                            endColumn: leadingWhitespace.length + 1,
                            message: `IndentationError: Unexpected indent (expected ${expected} level, got ${currentIndent})`,
                            severity: 8
                        });
                    }
                }
            }
        }
        
        return errors;
    },

    /**
     * Validate Python syntax patterns
     * @param {string} code - Python code
     * @returns {Array} Array of syntax errors
     */
    validateSyntax(code) {
        const errors = [];
        const lines = code.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            const trimmed = line.trim();
            
            // Skip empty lines and comments
            if (trimmed === '' || trimmed.startsWith('#')) {
                continue;
            }
            
            // Check for missing colon after control structures
            const controlStructures = /^(if|elif|else|for|while|def|class|try|except|finally|with)\b/;
            if (controlStructures.test(trimmed)) {
                // else and finally don't need conditions
                if (trimmed === 'else:' || trimmed === 'finally:') {
                    continue;
                }
                
                if (!trimmed.endsWith(':')) {
                    const match = trimmed.match(controlStructures);
                    if (match) {
                        errors.push({
                            startLine: lineNum,
                            endLine: lineNum,
                            startColumn: line.indexOf(match[0]) + 1,
                            endColumn: line.length + 1,
                            message: `SyntaxError: Expected ':' at end of ${match[1]} statement`,
                            severity: 8
                        });
                    }
                }
            }
            
            // Check for unclosed brackets
            const brackets = { '(': ')', '[': ']', '{': '}' };
            const stack = [];
            let inString = false;
            let stringChar = null;
            
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                
                // Handle strings
                if ((char === '"' || char === "'") && (j === 0 || line[j-1] !== '\\')) {
                    if (!inString) {
                        inString = true;
                        stringChar = char;
                    } else if (char === stringChar) {
                        inString = false;
                        stringChar = null;
                    }
                    continue;
                }
                
                if (inString) continue;
                
                // Track brackets
                if (brackets[char]) {
                    stack.push({ char, pos: j });
                } else if (Object.values(brackets).includes(char)) {
                    if (stack.length === 0) {
                        errors.push({
                            startLine: lineNum,
                            endLine: lineNum,
                            startColumn: j + 1,
                            endColumn: j + 2,
                            message: `SyntaxError: Unmatched closing bracket '${char}'`,
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
                                message: `SyntaxError: Mismatched brackets (expected '${brackets[last.char]}', got '${char}')`,
                                severity: 8
                            });
                        }
                    }
                }
            }
            
            // Check for unclosed string
            if (inString) {
                errors.push({
                    startLine: lineNum,
                    endLine: lineNum,
                    startColumn: 1,
                    endColumn: line.length + 1,
                    message: `SyntaxError: Unterminated string literal`,
                    severity: 8
                });
            }
        }
        
        return errors;
    }
};
