package com.roolts.controller;

import com.roolts.service.CodeExecutorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

/**
 * REST Controller for code execution.
 * Executes Python and Java code in a sandboxed environment.
 */
@RestController
@RequestMapping("/api/execute")
public class ExecutorController {

    private final CodeExecutorService executorService;

    @Autowired
    public ExecutorController(CodeExecutorService executorService) {
        this.executorService = executorService;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "service", "roolts-code-executor",
            "version", "1.0.0",
            "supported_languages", List.of("python", "java", "javascript")
        ));
    }

    @GetMapping("/languages")
    public ResponseEntity<Map<String, Object>> listLanguages() {
        return ResponseEntity.ok(Map.of(
            "languages", List.of(
                Map.of(
                    "id", "python",
                    "name", "Python",
                    "version", executorService.getPythonVersion(),
                    "available", executorService.isPythonAvailable(),
                    "icon", "🐍"
                ),
                Map.of(
                    "id", "java",
                    "name", "Java",
                    "version", executorService.getJavaVersion(),
                    "available", executorService.isJavaAvailable(),
                    "icon", "☕"
                ),
                Map.of(
                    "id", "javascript",
                    "name", "JavaScript (Node.js)",
                    "version", executorService.getNodeVersion(),
                    "available", executorService.isNodeAvailable(),
                    "icon", "📜"
                )
            )
        ));
    }

    @PostMapping("/python")
    public ResponseEntity<Map<String, Object>> executePython(
            @RequestBody Map<String, String> request) {
        
        String code = request.get("code");
        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Code is required"
            ));
        }

        Map<String, Object> result = executorService.executePython(code);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/java")
    public ResponseEntity<Map<String, Object>> executeJava(
            @RequestBody Map<String, String> request) {
        
        String code = request.get("code");
        String className = request.getOrDefault("className", "Main");
        
        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Code is required"
            ));
        }

        Map<String, Object> result = executorService.executeJava(code, className);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/javascript")
    public ResponseEntity<Map<String, Object>> executeJavaScript(
            @RequestBody Map<String, String> request) {
        
        String code = request.get("code");
        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Code is required"
            ));
        }

        Map<String, Object> result = executorService.executeJavaScript(code);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/run")
    public ResponseEntity<Map<String, Object>> executeCode(
            @RequestBody Map<String, String> request) {
        
        String code = request.get("code");
        String language = request.getOrDefault("language", "python").toLowerCase();
        
        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Code is required"
            ));
        }

        Map<String, Object> result = switch (language) {
            case "python", "py" -> executorService.executePython(code);
            case "java" -> executorService.executeJava(code, "Main");
            case "javascript", "js", "node" -> executorService.executeJavaScript(code);
            default -> Map.of("error", "Unsupported language: " + language);
        };

        return ResponseEntity.ok(result);
    }
}
