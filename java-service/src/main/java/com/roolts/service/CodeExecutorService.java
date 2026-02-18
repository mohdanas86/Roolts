package com.roolts.service;

import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

/**
 * Service for executing code in various languages.
 * Provides sandboxed execution with timeout protection.
 */
@Service
public class CodeExecutorService {

    private static final int TIMEOUT_SECONDS = 30;
    private static final int MAX_OUTPUT_LENGTH = 50000;

    // ==================== Language Version Detection ====================

    public String getPythonVersion() {
        try {
            ProcessBuilder pb = new ProcessBuilder("python", "--version");
            pb.redirectErrorStream(true);
            Process process = pb.start();
            String output = readOutput(process.getInputStream());
            process.waitFor(5, TimeUnit.SECONDS);
            return output.replace("Python ", "").trim();
        } catch (Exception e) {
            return "Not installed";
        }
    }

    public String getJavaVersion() {
        try {
            ProcessBuilder pb = new ProcessBuilder("java", "-version");
            pb.redirectErrorStream(true);
            Process process = pb.start();
            String output = readOutput(process.getInputStream());
            process.waitFor(5, TimeUnit.SECONDS);
            // Parse version from output
            if (output.contains("version")) {
                return output.split("\"")[1];
            }
            return output.split("\n")[0].trim();
        } catch (Exception e) {
            return "Not installed";
        }
    }

    public String getNodeVersion() {
        try {
            ProcessBuilder pb = new ProcessBuilder("node", "--version");
            pb.redirectErrorStream(true);
            Process process = pb.start();
            String output = readOutput(process.getInputStream());
            process.waitFor(5, TimeUnit.SECONDS);
            return output.replace("v", "").trim();
        } catch (Exception e) {
            return "Not installed";
        }
    }

    public boolean isPythonAvailable() {
        return !getPythonVersion().equals("Not installed");
    }

    public boolean isJavaAvailable() {
        return !getJavaVersion().equals("Not installed");
    }

    public boolean isNodeAvailable() {
        return !getNodeVersion().equals("Not installed");
    }

    // ==================== Code Execution ====================

    public Map<String, Object> executePython(String code) {
        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("roolts_py_");
            Path codeFile = tempDir.resolve("script.py");
            Files.writeString(codeFile, code);

            ProcessBuilder pb = new ProcessBuilder("python", codeFile.toString());
            pb.directory(tempDir.toFile());
            pb.redirectErrorStream(false);

            return executeProcess(pb, "python");

        } catch (Exception e) {
            return Map.of(
                "success", false,
                "error", e.getMessage(),
                "language", "python"
            );
        } finally {
            cleanupTempDir(tempDir);
        }
    }

    public Map<String, Object> executeJava(String code, String className) {
        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("roolts_java_");
            
            // Extract or use provided class name
            String actualClassName = extractClassName(code);
            if (actualClassName == null) {
                actualClassName = className;
            }
            
            Path codeFile = tempDir.resolve(actualClassName + ".java");
            Files.writeString(codeFile, code);

            // Compile
            ProcessBuilder compilePb = new ProcessBuilder("javac", codeFile.toString());
            compilePb.directory(tempDir.toFile());
            compilePb.redirectErrorStream(true);
            
            Process compileProcess = compilePb.start();
            String compileOutput = readOutput(compileProcess.getInputStream());
            boolean compiled = compileProcess.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            
            if (!compiled || compileProcess.exitValue() != 0) {
                return Map.of(
                    "success", false,
                    "error", "Compilation failed:\n" + compileOutput,
                    "language", "java",
                    "phase", "compile"
                );
            }

            // Run
            ProcessBuilder runPb = new ProcessBuilder("java", "-cp", tempDir.toString(), actualClassName);
            runPb.directory(tempDir.toFile());

            return executeProcess(runPb, "java");

        } catch (Exception e) {
            return Map.of(
                "success", false,
                "error", e.getMessage(),
                "language", "java"
            );
        } finally {
            cleanupTempDir(tempDir);
        }
    }

    public Map<String, Object> executeJavaScript(String code) {
        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("roolts_js_");
            Path codeFile = tempDir.resolve("script.js");
            Files.writeString(codeFile, code);

            ProcessBuilder pb = new ProcessBuilder("node", codeFile.toString());
            pb.directory(tempDir.toFile());

            return executeProcess(pb, "javascript");

        } catch (Exception e) {
            return Map.of(
                "success", false,
                "error", e.getMessage(),
                "language", "javascript"
            );
        } finally {
            cleanupTempDir(tempDir);
        }
    }

    // ==================== Helper Methods ====================

    private Map<String, Object> executeProcess(ProcessBuilder pb, String language) {
        try {
            long startTime = System.currentTimeMillis();
            
            Process process = pb.start();
            
            // Read stdout and stderr concurrently
            CompletableFuture<String> stdoutFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return readOutput(process.getInputStream());
                } catch (IOException e) {
                    return "";
                }
            });
            
            CompletableFuture<String> stderrFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return readOutput(process.getErrorStream());
                } catch (IOException e) {
                    return "";
                }
            });

            boolean finished = process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            long executionTime = System.currentTimeMillis() - startTime;

            if (!finished) {
                process.destroyForcibly();
                return Map.of(
                    "success", false,
                    "error", "Execution timed out after " + TIMEOUT_SECONDS + " seconds",
                    "language", language,
                    "execution_time_ms", executionTime
                );
            }

            String stdout = stdoutFuture.get(5, TimeUnit.SECONDS);
            String stderr = stderrFuture.get(5, TimeUnit.SECONDS);
            int exitCode = process.exitValue();

            // Truncate output if too long
            if (stdout.length() > MAX_OUTPUT_LENGTH) {
                stdout = stdout.substring(0, MAX_OUTPUT_LENGTH) + "\n... [output truncated]";
            }
            if (stderr.length() > MAX_OUTPUT_LENGTH) {
                stderr = stderr.substring(0, MAX_OUTPUT_LENGTH) + "\n... [error truncated]";
            }

            Map<String, Object> result = new HashMap<>();
            result.put("success", exitCode == 0);
            result.put("output", stdout);
            result.put("error", stderr);
            result.put("exit_code", exitCode);
            result.put("language", language);
            result.put("execution_time_ms", executionTime);

            return result;

        } catch (Exception e) {
            return Map.of(
                "success", false,
                "error", e.getMessage(),
                "language", language
            );
        }
    }

    private String readOutput(InputStream inputStream) throws IOException {
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (output.length() > 0) {
                    output.append("\n");
                }
                output.append(line);
            }
        }
        return output.toString();
    }

    private String extractClassName(String code) {
        // Simple regex to extract public class name
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(
            "public\\s+class\\s+(\\w+)"
        );
        java.util.regex.Matcher matcher = pattern.matcher(code);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    private void cleanupTempDir(Path tempDir) {
        if (tempDir != null) {
            try {
                Files.walk(tempDir)
                    .sorted(Comparator.reverseOrder())
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException ignored) {}
                    });
            } catch (IOException ignored) {}
        }
    }
}
