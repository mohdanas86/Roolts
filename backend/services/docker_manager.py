"""
Docker Manager Service
Handles Docker container lifecycle, resource management, and isolation for virtual environments.
"""

import os
import time
import docker
from docker.errors import DockerException, APIError, NotFound
from typing import Dict, Optional, List, Tuple


class DockerManager:
    """Manages Docker containers for user virtual environments."""
    
    # Environment type to Docker image mapping
    ENVIRONMENT_IMAGES = {
        'nodejs': 'node:18-alpine',
        'python': 'python:3.11-alpine',
        'fullstack': 'node:18-alpine',  # Will install Python too
        'cpp': 'gcc:latest'
    }
    
    # Default resource limits
    DEFAULT_LIMITS = {
        'cpu_limit': 1.0,  # CPU cores
        'memory_limit': 512 * 1024 * 1024,  # 512MB in bytes
        'pids_limit': 50,  # Max processes
        'disk_limit': 1024 * 1024 * 1024  # 1GB in bytes
    }
    
    def __init__(self):
        """Initialize Docker client."""
        try:
            self.client = docker.from_env()
            self.client.ping()
            print("[OK] Docker connection established")
        except DockerException as e:
            print(f"[ERROR] Docker connection failed (Continuing without Docker): {e}")
            # Do not raise exception so the app can start for other features (like code execution)
            self.client = None
            # raise Exception("Docker is not available. Please ensure Docker is installed and running.")
    
    def create_environment(
        self,
        user_id: int,
        env_id: int,
        env_type: str,
        name: str,
        cpu_limit: float = None,
        memory_limit: int = None
    ) -> Tuple[str, str]:
        """
        Create a new Docker container for a virtual environment.
        
        Args:
            user_id: User ID
            env_id: Environment ID from database
            env_type: Type of environment ('nodejs', 'python', 'fullstack', 'cpp')
            name: Environment name
            cpu_limit: CPU limit in cores (default: 1.0)
            memory_limit: Memory limit in MB (default: 512)
        
        Returns:
            Tuple of (container_id, volume_name)
        
        Raises:
            Exception: If container creation fails
        """
        try:
            # Validate environment type
            if env_type not in self.ENVIRONMENT_IMAGES:
                raise ValueError(f"Invalid environment type: {env_type}")
            
            # Create volume name
            volume_name = f"roolts_env_{user_id}_{env_id}"
            
            # Create Docker volume for persistent storage
            try:
                volume = self.client.volumes.create(
                    name=volume_name,
                    driver='local',
                    labels={
                        'user_id': str(user_id),
                        'env_id': str(env_id),
                        'env_type': env_type
                    }
                )
                print(f"[OK] Created volume: {volume_name}")
            except APIError as e:
                # Volume might already exist
                print(f"[WARN] Volume creation warning: {e}")
            
            # Set resource limits
            cpu = cpu_limit if cpu_limit else self.DEFAULT_LIMITS['cpu_limit']
            memory = (memory_limit * 1024 * 1024) if memory_limit else self.DEFAULT_LIMITS['memory_limit']
            
            # Container configuration
            container_name = f"roolts_{user_id}_{env_id}_{name}".replace(' ', '_')
            image = self.ENVIRONMENT_IMAGES[env_type]
            
            # Pull image if not available
            try:
                self.client.images.get(image)
            except NotFound:
                print(f"📥 Pulling image: {image}")
                self.client.images.pull(image)
            
            # Create container with security and resource limits
            container = self.client.containers.create(
                image=image,
                name=container_name,
                detach=True,
                stdin_open=True,
                tty=True,
                
                # Mount persistent volume
                volumes={
                    volume_name: {
                        'bind': '/workspace',
                        'mode': 'rw'
                    }
                },
                
                # Working directory
                working_dir='/workspace',
                
                # Resource limits
                cpu_quota=int(cpu * 100000),  # CPU quota (100000 = 1 core)
                cpu_period=100000,
                mem_limit=memory,
                memswap_limit=memory,  # Disable swap
                pids_limit=self.DEFAULT_LIMITS['pids_limit'],
                
                # Security settings
                cap_drop=['ALL'],  # Drop all capabilities
                cap_add=['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETGID', 'SETUID'],  # Add only necessary ones
                security_opt=['no-new-privileges'],
                
                # Note: Network will be connected only when needed (e.g., for package installation)
                # Container starts without network for security
                
                # Environment variables
                environment={
                    'USER_ID': str(user_id),
                    'ENV_ID': str(env_id),
                    'ENV_TYPE': env_type,
                    'HOME': '/workspace'
                },
                
                # Labels for identification
                labels={
                    'roolts.user_id': str(user_id),
                    'roolts.env_id': str(env_id),
                    'roolts.env_type': env_type,
                    'roolts.env_name': name
                }
            )
            
            print(f"[OK] Created container: {container.id[:12]} for environment '{name}'")
            return container.id, volume_name
            
        except Exception as e:
            print(f"[ERROR] Failed to create environment: {e}")
            raise Exception(f"Container creation failed: {str(e)}")
    
    def start_environment(self, container_id: str) -> bool:
        """
        Start a stopped container.
        
        Args:
            container_id: Docker container ID
        
        Returns:
            True if started successfully
        """
        try:
            container = self.client.containers.get(container_id)
            container.start()
            print(f"[OK] Started container: {container_id[:12]}")
            return True
        except NotFound:
            raise Exception(f"Container not found: {container_id}")
        except APIError as e:
            raise Exception(f"Failed to start container: {str(e)}")
    
    def stop_environment(self, container_id: str, timeout: int = 10) -> bool:
        """
        Stop a running container.
        
        Args:
            container_id: Docker container ID
            timeout: Seconds to wait before killing
        
        Returns:
            True if stopped successfully
        """
        try:
            container = self.client.containers.get(container_id)
            container.stop(timeout=timeout)
            print(f"[OK] Stopped container: {container_id[:12]}")
            return True
        except NotFound:
            raise Exception(f"Container not found: {container_id}")
        except APIError as e:
            raise Exception(f"Failed to stop container: {str(e)}")
    
    def destroy_environment(self, container_id: str, volume_name: str = None) -> bool:
        """
        Destroy a container and optionally its volume.
        
        Args:
            container_id: Docker container ID
            volume_name: Docker volume name (optional)
        
        Returns:
            True if destroyed successfully
        """
        try:
            # Remove container
            try:
                container = self.client.containers.get(container_id)
                container.remove(force=True)
                print(f"[OK] Removed container: {container_id[:12]}")
            except NotFound:
                print(f"[WARN] Container not found: {container_id[:12]}")
            
            # Remove volume if specified
            if volume_name:
                try:
                    volume = self.client.volumes.get(volume_name)
                    volume.remove(force=True)
                    print(f"[OK] Removed volume: {volume_name}")
                except NotFound:
                    print(f"[WARN] Volume not found: {volume_name}")
            
            return True
        except APIError as e:
            raise Exception(f"Failed to destroy environment: {str(e)}")
    
    def get_container_status(self, container_id: str) -> Dict:
        """
        Get container status and resource usage.
        
        Args:
            container_id: Docker container ID
        
        Returns:
            Dictionary with status information
        """
        try:
            container = self.client.containers.get(container_id)
            stats = container.stats(stream=False)
            
            # Calculate CPU percentage
            cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                       stats['precpu_stats']['cpu_usage']['total_usage']
            system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                          stats['precpu_stats']['system_cpu_usage']
            cpu_percent = (cpu_delta / system_delta) * 100.0 if system_delta > 0 else 0.0
            
            # Calculate memory usage
            memory_usage = stats['memory_stats'].get('usage', 0)
            memory_limit = stats['memory_stats'].get('limit', 0)
            memory_percent = (memory_usage / memory_limit) * 100.0 if memory_limit > 0 else 0.0
            
            return {
                'status': container.status,
                'running': container.status == 'running',
                'cpu_percent': round(cpu_percent, 2),
                'memory_usage_mb': round(memory_usage / (1024 * 1024), 2),
                'memory_percent': round(memory_percent, 2),
                'created': container.attrs['Created'],
                'started': container.attrs['State'].get('StartedAt')
            }
        except NotFound:
            return {'status': 'not_found', 'running': False}
        except Exception as e:
            return {'status': 'error', 'running': False, 'error': str(e)}
    
    def execute_command(
        self,
        container_id: str,
        command: str,
        timeout: int = 30
    ) -> Tuple[int, str, str]:
        """
        Execute a command inside a container.
        
        Args:
            container_id: Docker container ID
            command: Command to execute
            timeout: Execution timeout in seconds
        
        Returns:
            Tuple of (exit_code, stdout, stderr)
        """
        try:
            container = self.client.containers.get(container_id)
            
            # Ensure container is running
            if container.status != 'running':
                container.start()
                time.sleep(1)  # Give it a moment to start
            
            # Execute command
            exec_result = container.exec_run(
                cmd=['sh', '-c', command],
                stdout=True,
                stderr=True,
                stdin=False,
                tty=False,
                privileged=False,
                user='',
                workdir='/workspace',
                demux=True
            )
            
            exit_code = exec_result.exit_code
            stdout = exec_result.output[0].decode('utf-8') if exec_result.output[0] else ''
            stderr = exec_result.output[1].decode('utf-8') if exec_result.output[1] else ''
            
            return exit_code, stdout, stderr
            
        except NotFound:
            raise Exception(f"Container not found: {container_id}")
        except Exception as e:
            raise Exception(f"Command execution failed: {str(e)}")
    
    def enable_network(self, container_id: str, network_name: str = 'bridge') -> bool:
        """
        Enable network access for a container (for package installation).
        
        Args:
            container_id: Docker container ID
            network_name: Network to connect to
        
        Returns:
            True if network enabled
        """
        try:
            container = self.client.containers.get(container_id)
            network = self.client.networks.get(network_name)
            
            # Try to connect to network
            try:
                network.connect(container)
                print(f"[OK] Enabled network for container: {container_id[:12]}")
            except APIError as e:
                # If already connected, that's fine
                if 'already exists' in str(e).lower() or 'already' in str(e).lower():
                    print(f"[OK] Network already enabled for container: {container_id[:12]}")
                else:
                    raise
            
            return True
        except Exception as e:
            raise Exception(f"Failed to enable network: {str(e)}")
    
    def disable_network(self, container_id: str, network_name: str = 'bridge') -> bool:
        """
        Disable network access for a container.
        
        Args:
            container_id: Docker container ID
            network_name: Network to disconnect from
        
        Returns:
            True if network disabled
        """
        try:
            container = self.client.containers.get(container_id)
            network = self.client.networks.get(network_name)
            
            # Try to disconnect from network
            try:
                network.disconnect(container, force=True)
                print(f"[OK] Disabled network for container: {container_id[:12]}")
            except APIError as e:
                # If not connected, that's fine
                if 'is not connected' in str(e).lower():
                    print(f"[OK] Network already disabled for container: {container_id[:12]}")
                else:
                    print(f"[WARN] Network disconnect warning: {e}")
            
            return True
        except Exception as e:
            # Ignore errors - network might already be disconnected
            print(f"[WARN] Network disconnect warning: {e}")
            return True
    
    def list_user_environments(self, user_id: int) -> List[Dict]:
        """
        List all containers for a specific user.
        
        Args:
            user_id: User ID
        
        Returns:
            List of container information dictionaries
        """
        try:
            containers = self.client.containers.list(
                all=True,
                filters={'label': f'roolts.user_id={user_id}'}
            )
            
            return [{
                'id': c.id,
                'name': c.name,
                'status': c.status,
                'env_id': c.labels.get('roolts.env_id'),
                'env_type': c.labels.get('roolts.env_type'),
                'env_name': c.labels.get('roolts.env_name')
            } for c in containers]
        except Exception as e:
            print(f"[ERROR] Failed to list environments: {e}")
            return []
    
    def cleanup_old_environments(self, days: int = 7) -> int:
        """
        Clean up environments that haven't been used in specified days.
        
        Args:
            days: Number of days of inactivity
        
        Returns:
            Number of environments cleaned up
        """
        # This would be called by a background task
        # Implementation would check last_accessed_at from database
        # and destroy containers accordingly
        pass


# Singleton instance
_docker_manager = None


def get_docker_manager() -> DockerManager:
    """Get or create the Docker manager singleton."""
    global _docker_manager
    if _docker_manager is None:
        _docker_manager = DockerManager()
    return _docker_manager
