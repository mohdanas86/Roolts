package com.roolts.service;

import com.roolts.model.CodeAnalysisResponse;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for analyzing code structure, complexity, and generating insights.
 */
@Service
public class CodeAnalyzerService {

    /**
     * Analyze the structure of the provided code.
     */
    public CodeAnalysisResponse analyzeCodeStructure(String code, String language) {
        if (code == null || code.isEmpty()) {
            return CodeAnalysisResponse.builder()
                .language(language != null ? language : "unknown")
                .lineCount(0)
                .characterCount(0)
                .functions(Collections.emptyList())
                .classes(Collections.emptyList())
                .imports(Collections.emptyList())
                .metrics(Collections.emptyMap())
                .suggestions(Collections.emptyList())
                .build();
        }

        // Detect language if not provided
        if (language == null || language.isEmpty()) {
            language = detectLanguage(code);
        }

        String[] lines = code.split("\n");
        
        List<String> functions = extractFunctions(code, language);
        List<String> classes = extractClasses(code, language);
        List<String> imports = extractImports(code, language);

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("blankLines", countBlankLines(lines));
        metrics.put("commentLines", countCommentLines(lines, language));
        metrics.put("codeLines", lines.length - (int) metrics.get("blankLines") - (int) metrics.get("commentLines"));

        return CodeAnalysisResponse.builder()
            .language(language)
            .lineCount(lines.length)
            .characterCount(code.length())
            .functions(functions)
            .classes(classes)
            .imports(imports)
            .metrics(metrics)
            .suggestions(generateSuggestions(code, language).get("suggestions") instanceof List ? 
                (List<String>) generateSuggestions(code, language).get("suggestions") : Collections.emptyList())
            .build();
    }

    /**
     * Calculate code complexity metrics.
     */
    public Map<String, Object> calculateComplexity(String code, String language) {
        Map<String, Object> result = new HashMap<>();
        
        if (code == null || code.isEmpty()) {
            result.put("cyclomaticComplexity", 0);
            result.put("nestingDepth", 0);
            result.put("rating", "N/A");
            return result;
        }

        // Count decision points for cyclomatic complexity
        int decisionPoints = 0;
        String[] decisionKeywords = {"if", "else", "for", "while", "case", "catch", "&&", "||", "?"};
        
        for (String keyword : decisionKeywords) {
            int index = 0;
            while ((index = code.indexOf(keyword, index)) != -1) {
                decisionPoints++;
                index += keyword.length();
            }
        }

        int cyclomaticComplexity = decisionPoints + 1;

        // Calculate nesting depth
        int maxDepth = 0;
        int currentDepth = 0;
        for (char c : code.toCharArray()) {
            if (c == '{' || c == '(') {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if (c == '}' || c == ')') {
                currentDepth = Math.max(0, currentDepth - 1);
            }
        }

        String rating;
        if (cyclomaticComplexity <= 10) {
            rating = "Low - Good";
        } else if (cyclomaticComplexity <= 20) {
            rating = "Moderate";
        } else if (cyclomaticComplexity <= 50) {
            rating = "High - Consider refactoring";
        } else {
            rating = "Very High - Needs refactoring";
        }

        result.put("cyclomaticComplexity", cyclomaticComplexity);
        result.put("nestingDepth", maxDepth);
        result.put("rating", rating);
        result.put("decisionPoints", decisionPoints);

        return result;
    }

    /**
     * Extract dependencies/imports from code.
     */
    public Map<String, Object> extractDependencies(String code, String language) {
        Map<String, Object> result = new HashMap<>();
        List<String> dependencies = new ArrayList<>();

        if (code == null || code.isEmpty()) {
            result.put("dependencies", dependencies);
            result.put("count", 0);
            return result;
        }

        if (language == null) {
            language = detectLanguage(code);
        }

        switch (language.toLowerCase()) {
            case "python":
                Pattern pythonImport = Pattern.compile("(?:from\\s+(\\S+)\\s+)?import\\s+(\\S+)");
                Matcher pythonMatcher = pythonImport.matcher(code);
                while (pythonMatcher.find()) {
                    String module = pythonMatcher.group(1) != null ? 
                        pythonMatcher.group(1) : pythonMatcher.group(2);
                    dependencies.add(module.split("\\.")[0]);
                }
                break;
                
            case "javascript":
            case "typescript":
                Pattern jsImport = Pattern.compile("(?:import.*from\\s+['\"]([^'\"]+)['\"]|require\\(['\"]([^'\"]+)['\"]\\))");
                Matcher jsMatcher = jsImport.matcher(code);
                while (jsMatcher.find()) {
                    String module = jsMatcher.group(1) != null ? jsMatcher.group(1) : jsMatcher.group(2);
                    dependencies.add(module);
                }
                break;
                
            case "java":
                Pattern javaImport = Pattern.compile("import\\s+([\\w.]+);");
                Matcher javaMatcher = javaImport.matcher(code);
                while (javaMatcher.find()) {
                    dependencies.add(javaMatcher.group(1));
                }
                break;
        }

        // Remove duplicates
        dependencies = new ArrayList<>(new LinkedHashSet<>(dependencies));

        result.put("dependencies", dependencies);
        result.put("count", dependencies.size());
        result.put("language", language);

        return result;
    }

    /**
     * Generate improvement suggestions for code.
     */
    public Map<String, Object> generateSuggestions(String code, String language) {
        Map<String, Object> result = new HashMap<>();
        List<String> suggestions = new ArrayList<>();

        if (code == null || code.isEmpty()) {
            result.put("suggestions", suggestions);
            return result;
        }

        String[] lines = code.split("\n");

        // Check for long lines
        long longLines = Arrays.stream(lines).filter(l -> l.length() > 120).count();
        if (longLines > 0) {
            suggestions.add("Consider breaking long lines (>" + 120 + " chars) for better readability");
        }

        // Check for TODO comments
        if (code.contains("TODO") || code.contains("FIXME")) {
            suggestions.add("There are TODO/FIXME comments that should be addressed");
        }

        // Check for console/print statements
        if (code.contains("console.log") || code.contains("print(") || code.contains("System.out.print")) {
            suggestions.add("Remove debugging statements before production");
        }

        // Check for empty catch blocks
        if (code.contains("catch") && code.matches("(?s).*catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}.*")) {
            suggestions.add("Avoid empty catch blocks - handle or log exceptions properly");
        }

        // Check for magic numbers
        Pattern magicNumber = Pattern.compile("\\b\\d{2,}\\b");
        if (magicNumber.matcher(code).find()) {
            suggestions.add("Consider extracting magic numbers into named constants");
        }

        // General suggestions
        if (lines.length > 200) {
            suggestions.add("Consider splitting large files into smaller modules");
        }

        if (suggestions.isEmpty()) {
            suggestions.add("Code looks good! No major issues found.");
        }

        result.put("suggestions", suggestions);
        result.put("count", suggestions.size());

        return result;
    }

    // Helper methods

    private String detectLanguage(String code) {
        if (code.contains("def ") && code.contains(":")) return "python";
        if (code.contains("function") || code.contains("const ") || code.contains("=>")) return "javascript";
        if (code.contains("public class") || code.contains("public static void main")) return "java";
        if (code.contains("<html") || code.contains("<div")) return "html";
        if (code.contains("{") && code.contains(":") && code.contains(";")) return "css";
        return "plaintext";
    }

    private List<String> extractFunctions(String code, String language) {
        List<String> functions = new ArrayList<>();
        Pattern pattern;

        switch (language.toLowerCase()) {
            case "python":
                pattern = Pattern.compile("def\\s+(\\w+)\\s*\\(");
                break;
            case "javascript":
            case "typescript":
                pattern = Pattern.compile("(?:function\\s+(\\w+)|(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|\\w+)\\s*=>)");
                break;
            case "java":
                pattern = Pattern.compile("(?:public|private|protected)?\\s*(?:static)?\\s*\\w+\\s+(\\w+)\\s*\\([^)]*\\)\\s*(?:throws\\s+\\w+)?\\s*\\{");
                break;
            default:
                return functions;
        }

        Matcher matcher = pattern.matcher(code);
        while (matcher.find()) {
            String name = matcher.group(1);
            if (name == null && matcher.groupCount() > 1) name = matcher.group(2);
            if (name != null && !name.isEmpty()) {
                functions.add(name);
            }
        }

        return functions;
    }

    private List<String> extractClasses(String code, String language) {
        List<String> classes = new ArrayList<>();
        Pattern pattern;

        switch (language.toLowerCase()) {
            case "python":
                pattern = Pattern.compile("class\\s+(\\w+)");
                break;
            case "javascript":
            case "typescript":
            case "java":
                pattern = Pattern.compile("class\\s+(\\w+)");
                break;
            default:
                return classes;
        }

        Matcher matcher = pattern.matcher(code);
        while (matcher.find()) {
            classes.add(matcher.group(1));
        }

        return classes;
    }

    private List<String> extractImports(String code, String language) {
        List<String> imports = new ArrayList<>();
        Pattern pattern;

        switch (language.toLowerCase()) {
            case "python":
                pattern = Pattern.compile("(?:from\\s+\\S+\\s+)?import\\s+(.+)");
                break;
            case "javascript":
            case "typescript":
                pattern = Pattern.compile("import\\s+.+\\s+from\\s+['\"]([^'\"]+)['\"]");
                break;
            case "java":
                pattern = Pattern.compile("import\\s+([\\w.]+);");
                break;
            default:
                return imports;
        }

        Matcher matcher = pattern.matcher(code);
        while (matcher.find()) {
            imports.add(matcher.group(1).trim());
        }

        return imports;
    }

    private int countBlankLines(String[] lines) {
        return (int) Arrays.stream(lines).filter(l -> l.trim().isEmpty()).count();
    }

    private int countCommentLines(String[] lines, String language) {
        int count = 0;
        String singleLineComment = "//";
        
        if ("python".equalsIgnoreCase(language)) {
            singleLineComment = "#";
        }

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.startsWith(singleLineComment) || 
                trimmed.startsWith("/*") || 
                trimmed.startsWith("*") ||
                trimmed.startsWith("\"\"\"") ||
                trimmed.startsWith("'''")) {
                count++;
            }
        }

        return count;
    }
}
