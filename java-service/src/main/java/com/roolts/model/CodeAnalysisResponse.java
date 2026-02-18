package com.roolts.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Response model for code analysis operations.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CodeAnalysisResponse {
    private String language;
    private int lineCount;
    private int characterCount;
    private List<String> functions;
    private List<String> classes;
    private List<String> imports;
    private Map<String, Object> metrics;
    private List<String> suggestions;
}
