"""
Package Manager Service
Handles package installation for different package managers (npm, pip, yarn, apt).
"""

from typing import Tuple, List, Dict
from services.docker_manager import get_docker_manager
from services.security_validator import get_security_validator


class PackageManager:
    """Manages package installation in virtual environments."""
    
    # Package manager commands
    INSTALL_COMMANDS = {
        'npm': 'npm install {packages}',
        'yarn': 'yarn add {packages}',
        'pip': 'pip install {packages}',
        'pip3': 'pip3 install {packages}',
        'apt-get': 'apt-get update && apt-get install -y {packages}',
        'apk': 'apk add {packages}'
    }
    
    LIST_COMMANDS = {
        'npm': 'npm list --depth=0',
        'yarn': 'yarn list --depth=0',
        'pip': 'pip list',
        'pip3': 'pip3 list',
        'apt-get': 'apt list --installed',
        'apk': 'apk info'
    }
    
    def __init__(self):
        """Initialize package manager."""
        self.docker_manager = get_docker_manager()
        self.security_validator = get_security_validator()
    
    def install_packages(
        self,
        container_id: str,
        manager: str,
        packages: List[str],
        enable_network: bool = True
    ) -> Tuple[bool, str, str]:
        """
        Install packages in a container.
        
        Args:
            container_id: Docker container ID
            manager: Package manager to use
            packages: List of package names
            enable_network: Whether to enable network for installation
        
        Returns:
            Tuple of (success, stdout, stderr)
        """
        try:
            # Validate package manager
            is_valid, message = self.security_validator.validate_package_manager(manager)
            if not is_valid:
                return False, '', message
            
            # Validate all package names
            for package in packages:
                is_valid, message = self.security_validator.validate_package_name(package)
                if not is_valid:
                    return False, '', f'Invalid package name "{package}": {message}'
            
            # Get install command
            if manager not in self.INSTALL_COMMANDS:
                return False, '', f'Unsupported package manager: {manager}'
            
            # Build command
            packages_str = ' '.join(packages)
            command = self.INSTALL_COMMANDS[manager].format(packages=packages_str)
            
            # Enable network if needed
            network_enabled = False
            if enable_network:
                try:
                    self.docker_manager.enable_network(container_id)
                    network_enabled = True
                except Exception as e:
                    return False, '', f'Failed to enable network: {str(e)}'
            
            # Execute installation
            try:
                exit_code, stdout, stderr = self.docker_manager.execute_command(
                    container_id,
                    command,
                    timeout=300  # 5 minutes for package installation
                )
                
                success = exit_code == 0
                return success, stdout, stderr
                
            finally:
                # Always disable network after installation
                if network_enabled:
                    try:
                        self.docker_manager.disable_network(container_id)
                    except Exception as e:
                        print(f"[WARN] Failed to disable network: {e}")
        
        except Exception as e:
            return False, '', f'Package installation failed: {str(e)}'
    
    def list_packages(
        self,
        container_id: str,
        manager: str
    ) -> Tuple[bool, str, str]:
        """
        List installed packages in a container.
        
        Args:
            container_id: Docker container ID
            manager: Package manager to use
        
        Returns:
            Tuple of (success, stdout, stderr)
        """
        try:
            # Validate package manager
            is_valid, message = self.security_validator.validate_package_manager(manager)
            if not is_valid:
                return False, '', message
            
            # Get list command
            if manager not in self.LIST_COMMANDS:
                return False, '', f'Unsupported package manager: {manager}'
            
            command = self.LIST_COMMANDS[manager]
            
            # Execute command
            exit_code, stdout, stderr = self.docker_manager.execute_command(
                container_id,
                command,
                timeout=30
            )
            
            success = exit_code == 0
            return success, stdout, stderr
            
        except Exception as e:
            return False, '', f'Failed to list packages: {str(e)}'
    
    def uninstall_packages(
        self,
        container_id: str,
        manager: str,
        packages: List[str]
    ) -> Tuple[bool, str, str]:
        """
        Uninstall packages from a container.
        
        Args:
            container_id: Docker container ID
            manager: Package manager to use
            packages: List of package names to uninstall
        
        Returns:
            Tuple of (success, stdout, stderr)
        """
        try:
            # Validate package manager
            is_valid, message = self.security_validator.validate_package_manager(manager)
            if not is_valid:
                return False, '', message
            
            # Validate all package names
            for package in packages:
                is_valid, message = self.security_validator.validate_package_name(package)
                if not is_valid:
                    return False, '', f'Invalid package name "{package}": {message}'
            
            # Build uninstall command
            packages_str = ' '.join(packages)
            
            uninstall_commands = {
                'npm': f'npm uninstall {packages_str}',
                'yarn': f'yarn remove {packages_str}',
                'pip': f'pip uninstall -y {packages_str}',
                'pip3': f'pip3 uninstall -y {packages_str}',
                'apt-get': f'apt-get remove -y {packages_str}',
                'apk': f'apk del {packages_str}'
            }
            
            if manager not in uninstall_commands:
                return False, '', f'Unsupported package manager: {manager}'
            
            command = uninstall_commands[manager]
            
            # Execute command
            exit_code, stdout, stderr = self.docker_manager.execute_command(
                container_id,
                command,
                timeout=120
            )
            
            success = exit_code == 0
            return success, stdout, stderr
            
        except Exception as e:
            return False, '', f'Package uninstallation failed: {str(e)}'
    
    def get_package_info(
        self,
        container_id: str,
        manager: str,
        package: str
    ) -> Tuple[bool, str, str]:
        """
        Get information about a specific package.
        
        Args:
            container_id: Docker container ID
            manager: Package manager to use
            package: Package name
        
        Returns:
            Tuple of (success, stdout, stderr)
        """
        try:
            # Validate package name
            is_valid, message = self.security_validator.validate_package_name(package)
            if not is_valid:
                return False, '', message
            
            # Build info command
            info_commands = {
                'npm': f'npm info {package}',
                'yarn': f'yarn info {package}',
                'pip': f'pip show {package}',
                'pip3': f'pip3 show {package}',
                'apt-get': f'apt-cache show {package}',
                'apk': f'apk info {package}'
            }
            
            if manager not in info_commands:
                return False, '', f'Unsupported package manager: {manager}'
            
            command = info_commands[manager]
            
            # Execute command
            exit_code, stdout, stderr = self.docker_manager.execute_command(
                container_id,
                command,
                timeout=30
            )
            
            success = exit_code == 0
            return success, stdout, stderr
            
        except Exception as e:
            return False, '', f'Failed to get package info: {str(e)}'


# Singleton instance
_package_manager = None


def get_package_manager() -> PackageManager:
    """Get or create the package manager singleton."""
    global _package_manager
    if _package_manager is None:
        _package_manager = PackageManager()
    return _package_manager
