"""
File Manager Service
Handles secure file operations in virtual environments.
"""

import os
import base64
from typing import Tuple, List, Dict, Optional
from services.docker_manager import get_docker_manager
from services.security_validator import get_security_validator


class FileManager:
    """Manages file operations in virtual environments."""
    
    def __init__(self):
        """Initialize file manager."""
        self.docker_manager = get_docker_manager()
        self.security_validator = get_security_validator()
    
    def list_directory(
        self,
        container_id: str,
        path: str = '/workspace'
    ) -> Tuple[bool, List[Dict], str]:
        """
        List contents of a directory.
        
        Args:
            container_id: Docker container ID
            path: Directory path (default: /workspace)
        
        Returns:
            Tuple of (success, file_list, error_message)
        """
        try:
            # Validate path
            is_valid, message = self.security_validator.validate_file_path(path)
            if not is_valid:
                return False, [], message
            
            # Build ls command (compatible with Alpine Linux/BusyBox)
            # Note: Alpine's ls doesn't support --time-style, so we use basic -l
            command = f'ls -lAh "{path}" 2>&1 || echo "ERROR: Directory not found or inaccessible"'
            
            exit_code, stdout, stderr = self.docker_manager.execute_command(
                container_id,
                command,
                timeout=10
            )
            
            if 'ERROR:' in stdout:
                return False, [], stdout.replace('ERROR: ', '')
            
            # Parse ls output (BusyBox format)
            files = []
            lines = stdout.strip().split('\n')
            
            for line in lines:
                if not line or line.startswith('total'):
                    continue
                
                parts = line.split(None, 8)
                if len(parts) >= 9:
                    # BusyBox ls format: permissions links owner group size month day time/year name
                    file_info = {
                        'permissions': parts[0],
                        'type': 'directory' if parts[0].startswith('d') else 'file',
                        'size': parts[4],
                        'modified': f"{parts[5]} {parts[6]} {parts[7]}",
                        'name': parts[8]
                    }
                    files.append(file_info)
            
            return True, files, ''
            
        except Exception as e:
            return False, [], f'Failed to list directory: {str(e)}'
    
    def read_file(
        self,
        container_id: str,
        file_path: str
    ) -> Tuple[bool, str, str]:
        """
        Read contents of a file.
        
        Args:
            container_id: Docker container ID
            file_path: Path to file
        
        Returns:
            Tuple of (success, content, error_message)
        """
        try:
            # Validate path
            is_valid, message = self.security_validator.validate_file_path(file_path)
            if not is_valid:
                return False, '', message
            
            # Read file using cat
            command = f'cat "{file_path}" 2>&1 || echo "ERROR: File not found or inaccessible"'
            
            exit_code, stdout, stderr = self.docker_manager.execute_command(
                container_id,
                command,
                timeout=30
            )
            
            if stdout.startswith('ERROR:'):
                return False, '', stdout.replace('ERROR: ', '')
            
            return True, stdout, ''
            
        except Exception as e:
            return False, '', f'Failed to read file: {str(e)}'
    
    def write_file(
        self,
        container_id: str,
        file_path: str,
        content: str,
        append: bool = False
    ) -> Tuple[bool, str]:
        """
        Write content to a file.
        
        Args:
            container_id: Docker container ID
            file_path: Path to file
            content: Content to write
            append: Whether to append (True) or overwrite (False)
        
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Validate path
            is_valid, message = self.security_validator.validate_file_path(file_path)
            if not is_valid:
                return False, message
            
            # Validate content size
            content_bytes = content.encode('utf-8')
            is_valid, message = self.security_validator.validate_file_content(
                content_bytes,
                os.path.basename(file_path)
            )
            if not is_valid:
                return False, message
            
            # Encode content to base64 to safely pass through shell
            content_b64 = base64.b64encode(content_bytes).decode('ascii')
            
            # Write file using base64 decoding
            operator = '>>' if append else '>'
            command = f'echo "{content_b64}" | base64 -d {operator} "{file_path}" 2>&1'
            
            exit_code, stdout, stderr = self.docker_manager.execute_command(
                container_id,
                command,
                timeout=30
            )
            
            if exit_code != 0:
                return False, stdout or stderr or 'Failed to write file'
            
            return True, ''
            
        except Exception as e:
            return False, f'Failed to write file: {str(e)}'
    
    def delete_file(
        self,
        container_id: str,
        file_path: str,
        recursive: bool = False
    ) -> Tuple[bool, str]:
        """
        Delete a file or directory.
        
        Args:
            container_id: Docker container ID
            file_path: Path to file/directory
            recursive: Whether to delete directories recursively
        
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Validate path
            is_valid, message = self.security_validator.validate_file_path(file_path)
            if not is_valid:
                return False, message
            
            # Prevent deletion of workspace root
            if file_path in ['/workspace', '/workspace/']:
                return False, 'Cannot delete workspace root directory'
            
            # Build rm command
            flags = '-rf' if recursive else '-f'
            command = f'rm {flags} "{file_path}" 2>&1'
            
            exit_code, stdout, stderr = self.docker_manager.execute_command(
                container_id,
                command,
                timeout=30
            )
            
            if exit_code != 0:
                return False, stdout or stderr or 'Failed to delete file'
            
            return True, ''
            
        except Exception as e:
            return False, f'Failed to delete file: {str(e)}'
    
    def create_directory(
        self,
        container_id: str,
        dir_path: str
    ) -> Tuple[bool, str]:
        """
        Create a directory.
        
        Args:
            container_id: Docker container ID
            dir_path: Path to directory
        
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Validate path
            is_valid, message = self.security_validator.validate_file_path(dir_path)
            if not is_valid:
                return False, message
            
            # Create directory
            command = f'mkdir -p "{dir_path}" 2>&1'
            
            exit_code, stdout, stderr = self.docker_manager.execute_command(
                container_id,
                command,
                timeout=10
            )
            
            if exit_code != 0:
                return False, stdout or stderr or 'Failed to create directory'
            
            return True, ''
            
        except Exception as e:
            return False, f'Failed to create directory: {str(e)}'
    
    def move_file(
        self,
        container_id: str,
        source_path: str,
        dest_path: str
    ) -> Tuple[bool, str]:
        """
        Move or rename a file/directory.
        
        Args:
            container_id: Docker container ID
            source_path: Source path
            dest_path: Destination path
        
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Validate paths
            is_valid, message = self.security_validator.validate_file_path(source_path)
            if not is_valid:
                return False, f'Invalid source path: {message}'
            
            is_valid, message = self.security_validator.validate_file_path(dest_path)
            if not is_valid:
                return False, f'Invalid destination path: {message}'
            
            # Move file
            command = f'mv "{source_path}" "{dest_path}" 2>&1'
            
            exit_code, stdout, stderr = self.docker_manager.execute_command(
                container_id,
                command,
                timeout=30
            )
            
            if exit_code != 0:
                return False, stdout or stderr or 'Failed to move file'
            
            return True, ''
            
        except Exception as e:
            return False, f'Failed to move file: {str(e)}'
    
    def copy_file(
        self,
        container_id: str,
        source_path: str,
        dest_path: str
    ) -> Tuple[bool, str]:
        """
        Copy a file/directory.
        
        Args:
            container_id: Docker container ID
            source_path: Source path
            dest_path: Destination path
        
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Validate paths
            is_valid, message = self.security_validator.validate_file_path(source_path)
            if not is_valid:
                return False, f'Invalid source path: {message}'
            
            is_valid, message = self.security_validator.validate_file_path(dest_path)
            if not is_valid:
                return False, f'Invalid destination path: {message}'
            
            # Copy file
            command = f'cp -r "{source_path}" "{dest_path}" 2>&1'
            
            exit_code, stdout, stderr = self.docker_manager.execute_command(
                container_id,
                command,
                timeout=30
            )
            
            if exit_code != 0:
                return False, stdout or stderr or 'Failed to copy file'
            
            return True, ''
            
        except Exception as e:
            return False, f'Failed to copy file: {str(e)}'
    
    def get_file_info(
        self,
        container_id: str,
        file_path: str
    ) -> Tuple[bool, Dict, str]:
        """
        Get information about a file.
        
        Args:
            container_id: Docker container ID
            file_path: Path to file
        
        Returns:
            Tuple of (success, file_info, error_message)
        """
        try:
            # Validate path
            is_valid, message = self.security_validator.validate_file_path(file_path)
            if not is_valid:
                return False, {}, message
            
            # Get file stats
            command = f'stat -c "%n|%s|%F|%Y|%A" "{file_path}" 2>&1 || echo "ERROR: File not found"'
            
            exit_code, stdout, stderr = self.docker_manager.execute_command(
                container_id,
                command,
                timeout=10
            )
            
            if 'ERROR:' in stdout:
                return False, {}, 'File not found'
            
            # Parse stat output
            parts = stdout.strip().split('|')
            if len(parts) >= 5:
                file_info = {
                    'name': os.path.basename(parts[0]),
                    'path': parts[0],
                    'size': int(parts[1]),
                    'type': parts[2],
                    'modified_timestamp': int(parts[3]),
                    'permissions': parts[4]
                }
                return True, file_info, ''
            
            return False, {}, 'Failed to parse file information'
            
        except Exception as e:
            return False, {}, f'Failed to get file info: {str(e)}'


# Singleton instance
_file_manager = None


def get_file_manager() -> FileManager:
    """Get or create the file manager singleton."""
    global _file_manager
    if _file_manager is None:
        _file_manager = FileManager()
    return _file_manager
