package com.roolts.controller;

import com.roolts.model.CodeAnalysisRequest;
import com.roolts.model.CodeAnalysisResponse;
import com.roolts.service.CodeAnalyzerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST Controller for code analysis operations.
 * Provides endpoints for analyzing code structure and generating insights.
 */
@RestController
@RequestMapping("/api/analyze")
public class AnalyzerController {

    private final CodeAnalyzerService analyzerService;

    @Autowired
    public AnalyzerController(CodeAnalyzerService analyzerService) {
        this.analyzerService = analyzerService;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "service", "roolts-java-analyzer",
            "version", "1.0.0"
        ));
    }

    @PostMapping("/structure")
    public ResponseEntity<CodeAnalysisResponse> analyzeStructure(
            @RequestBody CodeAnalysisRequest request) {
        
        CodeAnalysisResponse response = analyzerService.analyzeCodeStructure(
            request.getCode(),
            request.getLanguage()
        );
        
        return ResponseEntity.ok(response);
    }

    @PostMapping("/complexity")
    public ResponseEntity<Map<String, Object>> analyzeComplexity(
            @RequestBody CodeAnalysisRequest request) {
        
        Map<String, Object> result = analyzerService.calculateComplexity(
            request.getCode(),
            request.getLanguage()
        );
        
        return ResponseEntity.ok(result);
    }

    @PostMapping("/dependencies")
    public ResponseEntity<Map<String, Object>> analyzeDependencies(
            @RequestBody CodeAnalysisRequest request) {
        
        Map<String, Object> result = analyzerService.extractDependencies(
            request.getCode(),
            request.getLanguage()
        );
        
        return ResponseEntity.ok(result);
    }

    @PostMapping("/suggestions")
    public ResponseEntity<Map<String, Object>> getSuggestions(
            @RequestBody CodeAnalysisRequest request) {
        
        Map<String, Object> result = analyzerService.generateSuggestions(
            request.getCode(),
            request.getLanguage()
        );
        
        return ResponseEntity.ok(result);
    }
}
