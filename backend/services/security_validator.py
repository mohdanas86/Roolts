"""
Security Validator Service
Validates commands, monitors resources, and enforces security policies for virtual environments.
"""

import re
from typing import Tuple, List, Dict


class SecurityValidator:
    """Validates commands and enforces security policies."""
    
    # Dangerous command patterns that should be blocked
    DANGEROUS_PATTERNS = [
        # System modification
        r'\b(sudo|su)\b',
        r'\brm\s+-rf\s+/',
        r'\bchmod\s+777',
        r'\bchown\s+root',
        
        # Process manipulation
        r'\bkill\s+-9\s+1\b',
        r'\bkillall\s+',
        
        # Network attacks
        r'\b(nmap|netcat|nc)\b',
        r'\b(wget|curl).*\|\s*sh',
        r'\b(wget|curl).*\|\s*bash',
        
        # File system bombs
        r':\(\)\{.*:\|:',  # Fork bomb
        r'\bdd\s+if=/dev/zero',
        
        # Privilege escalation
        r'/etc/passwd',
        r'/etc/shadow',
        r'\bsetuid\b',
        
        # Container escape attempts
        r'/proc/self/exe',
        r'/var/run/docker.sock',
        r'\bmount\b',
        r'\bunshare\b',
    ]
    
    # Warning patterns (allowed but logged)
    WARNING_PATTERNS = [
        r'\brm\s+-rf',
        r'\brm\s+-fr',
        r'\bformat\b',
        r'\bmkfs\b',
    ]
    
    # Allowed package managers
    ALLOWED_PACKAGE_MANAGERS = ['npm', 'yarn', 'pip', 'pip3', 'apt-get', 'apk']
    
    # Maximum command length
    MAX_COMMAND_LENGTH = 10000
    
    # Maximum file size for upload (10MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024
    
    def __init__(self):
        """Initialize security validator."""
        self.compiled_dangerous = [re.compile(pattern, re.IGNORECASE) for pattern in self.DANGEROUS_PATTERNS]
        self.compiled_warnings = [re.compile(pattern, re.IGNORECASE) for pattern in self.WARNING_PATTERNS]
    
    def validate_command(self, command: str) -> Tuple[bool, str, str]:
        """
        Validate a command for security risks.
        
        Args:
            command: Command to validate
        
        Returns:
            Tuple of (is_safe, severity, message)
            - is_safe: True if command is safe to execute
            - severity: 'safe', 'warning', or 'blocked'
            - message: Explanation of the decision
        """
        # Check command length
        if len(command) > self.MAX_COMMAND_LENGTH:
            return False, 'blocked', f'Command exceeds maximum length of {self.MAX_COMMAND_LENGTH} characters'
        
        # Check for null bytes
        if '\x00' in command:
            return False, 'blocked', 'Command contains null bytes'
        
        # Check dangerous patterns
        for pattern in self.compiled_dangerous:
            if pattern.search(command):
                return False, 'blocked', f'Command contains dangerous pattern: {pattern.pattern}'
        
        # Check warning patterns
        for pattern in self.compiled_warnings:
            if pattern.search(command):
                return True, 'warning', f'Command contains potentially risky operation: {pattern.pattern}'
        
        return True, 'safe', 'Command is safe to execute'
    
    def validate_package_name(self, package_name: str) -> Tuple[bool, str]:
        """
        Validate a package name for security.
        
        Args:
            package_name: Package name to validate
        
        Returns:
            Tuple of (is_valid, message)
        """
        # Check for empty or whitespace-only names
        if not package_name or not package_name.strip():
            return False, 'Package name cannot be empty'
        
        # Check length
        if len(package_name) > 214:  # npm package name limit
            return False, 'Package name too long'
        
        # Check for dangerous characters
        dangerous_chars = ['&', '|', ';', '$', '`', '(', ')', '<', '>', '\n', '\r']
        for char in dangerous_chars:
            if char in package_name:
                return False, f'Package name contains dangerous character: {char}'
        
        # Check for path traversal
        if '..' in package_name or '/' in package_name or '\\' in package_name:
            return False, 'Package name contains path traversal characters'
        
        # Basic format validation (alphanumeric, dash, underscore, dot, @, /)
        if not re.match(r'^[@a-zA-Z0-9._/-]+$', package_name):
            return False, 'Package name contains invalid characters'
        
        return True, 'Package name is valid'
    
    def validate_file_path(self, file_path: str) -> Tuple[bool, str]:
        """
        Validate a file path for security.
        
        Args:
            file_path: File path to validate
        
        Returns:
            Tuple of (is_valid, message)
        """
        # Check for empty path
        if not file_path or not file_path.strip():
            return False, 'File path cannot be empty'
        
        # Check for absolute paths (should be relative to workspace)
        if file_path.startswith('/'):
            # Allow paths starting with /workspace
            if not file_path.startswith('/workspace'):
                return False, 'Absolute paths outside /workspace are not allowed'
        
        # Check for path traversal
        if '..' in file_path:
            return False, 'Path traversal (..) is not allowed'
        
        # Check for dangerous paths
        dangerous_paths = ['/etc', '/proc', '/sys', '/dev', '/root', '/var/run']
        for dangerous in dangerous_paths:
            if file_path.startswith(dangerous):
                return False, f'Access to {dangerous} is not allowed'
        
        # Check for null bytes
        if '\x00' in file_path:
            return False, 'File path contains null bytes'
        
        return True, 'File path is valid'
    
    def validate_file_content(self, content: bytes, filename: str) -> Tuple[bool, str]:
        """
        Validate file content for security.
        
        Args:
            content: File content as bytes
            filename: Name of the file
        
        Returns:
            Tuple of (is_valid, message)
        """
        # Check file size
        if len(content) > self.MAX_FILE_SIZE:
            return False, f'File size exceeds maximum of {self.MAX_FILE_SIZE / (1024*1024)}MB'
        
        # Check for executable files (basic check)
        if content.startswith(b'\x7fELF') or content.startswith(b'MZ'):
            return False, 'Executable files are not allowed'
        
        # Check for suspicious extensions
        dangerous_extensions = ['.exe', '.dll', '.so', '.dylib', '.bat', '.cmd', '.com']
        if any(filename.lower().endswith(ext) for ext in dangerous_extensions):
            return False, f'File type not allowed: {filename}'
        
        return True, 'File content is valid'
    
    def sanitize_command(self, command: str) -> str:
        """
        Sanitize a command by removing dangerous elements.
        
        Args:
            command: Command to sanitize
        
        Returns:
            Sanitized command
        """
        # Remove null bytes
        command = command.replace('\x00', '')
        
        # Trim whitespace
        command = command.strip()
        
        return command
    
    def get_resource_limits(self) -> Dict:
        """
        Get default resource limits for environments.
        
        Returns:
            Dictionary of resource limits
        """
        return {
            'cpu_cores': 1.0,
            'memory_mb': 512,
            'disk_mb': 1024,
            'max_processes': 50,
            'max_open_files': 1024,
            'network_enabled': False
        }
    
    def check_rate_limit(self, user_id: int, action: str, limit: int = 10, window: int = 60) -> Tuple[bool, str]:
        """
        Check if user has exceeded rate limit for an action.
        
        Args:
            user_id: User ID
            action: Action type (e.g., 'command', 'install')
            limit: Maximum number of actions allowed
            window: Time window in seconds
        
        Returns:
            Tuple of (is_allowed, message)
        """
        # This would be implemented with Redis or in-memory cache
        # For now, return True (no rate limiting)
        return True, 'Rate limit check passed'
    
    def validate_environment_name(self, name: str) -> Tuple[bool, str]:
        """
        Validate environment name.
        
        Args:
            name: Environment name
        
        Returns:
            Tuple of (is_valid, message)
        """
        # Check length
        if len(name) < 1 or len(name) > 100:
            return False, 'Environment name must be between 1 and 100 characters'
        
        # Check for valid characters (alphanumeric, dash, underscore, space)
        if not re.match(r'^[a-zA-Z0-9 _-]+$', name):
            return False, 'Environment name can only contain letters, numbers, spaces, dashes, and underscores'
        
        return True, 'Environment name is valid'
    
    def get_allowed_package_managers(self) -> List[str]:
        """Get list of allowed package managers."""
        return self.ALLOWED_PACKAGE_MANAGERS.copy()
    
    def validate_package_manager(self, manager: str) -> Tuple[bool, str]:
        """
        Validate package manager.
        
        Args:
            manager: Package manager name
        
        Returns:
            Tuple of (is_valid, message)
        """
        if manager not in self.ALLOWED_PACKAGE_MANAGERS:
            return False, f'Package manager not allowed. Allowed: {", ".join(self.ALLOWED_PACKAGE_MANAGERS)}'
        
        return True, 'Package manager is valid'


# Singleton instance
_security_validator = None


def get_security_validator() -> SecurityValidator:
    """Get or create the security validator singleton."""
    global _security_validator
    if _security_validator is None:
        _security_validator = SecurityValidator()
    return _security_validator
