package com.roolts.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request model for code analysis operations.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeAnalysisRequest {
    private String code;
    private String language;
    private String fileName;
}
