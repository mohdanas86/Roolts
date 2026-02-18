package com.roolts;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Roolts Java Service - Main Application
 * 
 * This service provides:
 * - Advanced code analysis
 * - Repository aggregation utilities
 * - Code transformation services
 */
@SpringBootApplication
public class RooltsApplication {

    public static void main(String[] args) {
        SpringApplication.run(RooltsApplication.class, args);
        System.out.println("🚀 Roolts Java Service started on port 8080");
    }
}
