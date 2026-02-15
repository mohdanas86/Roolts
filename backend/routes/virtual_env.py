"""
Virtual Environment Routes
API endpoints for managing user virtual development environments.
"""

import time
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from functools import wraps

from models import db, VirtualEnvironment, EnvironmentSession, EnvironmentLog, User
from services.docker_manager import get_docker_manager
from services.security_validator import get_security_validator
from services.package_manager import get_package_manager
from services.file_manager import get_file_manager


# Create blueprint
virtual_env_bp = Blueprint('virtual_env', __name__)

# Initialize services (Lazy loaded)
# docker_manager = get_docker_manager()
# security_validator = get_security_validator()
# package_manager = get_package_manager()
# file_manager = get_file_manager()

def get_services():
    """Lazy load all services."""
    return (
        get_docker_manager(),
        get_security_validator(),
        get_package_manager(),
        get_file_manager()
    )


# Authentication decorator (simplified - integrate with your auth system)
def require_auth(f):
    """Require authentication for endpoint."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # TODO: Integrate with your existing auth system
        # For now, we'll use a simple user_id from header
        user_id = request.headers.get('X-User-ID')
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401
        
        try:
            request.user_id = int(user_id)
        except ValueError:
            return jsonify({'error': 'Invalid user ID'}), 401
        
        return f(*args, **kwargs)
    return decorated_function


def log_action(env_id: int, action_type: str, command: str, status: str, output: str, execution_time: float = None):
    """Log an environment action to the database."""
    try:
        log = EnvironmentLog(
            environment_id=env_id,
            action_type=action_type,
            command=command,
            status=status,
            output=output[:5000] if output else None,  # Limit output size
            execution_time=execution_time
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        print(f"⚠️ Failed to log action: {e}")


# ============================================================================
# Environment Management Endpoints
# ============================================================================

@virtual_env_bp.route('/environments', methods=['POST'])
@require_auth
def create_environment():
    """Create a new virtual environment."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        data = request.get_json()
        
        # Validate required fields
        if not data or 'name' not in data or 'type' not in data:
            return jsonify({'error': 'Missing required fields: name, type'}), 400
        
        name = data['name']
        env_type = data['type']
        
        # Validate environment name
        is_valid, message = security_validator.validate_environment_name(name)
        if not is_valid:
            return jsonify({'error': message}), 400
        
        # Validate environment type
        if env_type not in ['nodejs', 'python', 'fullstack', 'cpp']:
            return jsonify({'error': 'Invalid environment type. Must be: nodejs, python, fullstack, or cpp'}), 400
        
        # Create database record
        env = VirtualEnvironment(
            user_id=request.user_id,
            name=name,
            environment_type=env_type,
            status='creating'
        )
        db.session.add(env)
        db.session.commit()
        
        # Create Docker container
        try:
            container_id, volume_name = docker_manager.create_environment(
                user_id=request.user_id,
                env_id=env.id,
                env_type=env_type,
                name=name
            )
            
            # Update environment with container info
            env.container_id = container_id
            env.volume_name = volume_name
            env.status = 'stopped'
            db.session.commit()
            
            # Log action
            log_action(env.id, 'create', f'Created {env_type} environment', 'success', f'Container: {container_id[:12]}')
            
            return jsonify({
                'success': True,
                'environment': env.to_dict(),
                'message': 'Environment created successfully'
            }), 201
            
        except Exception as e:
            env.status = 'error'
            db.session.commit()
            log_action(env.id, 'create', f'Failed to create {env_type} environment', 'error', str(e))
            return jsonify({'error': f'Failed to create environment: {str(e)}'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@virtual_env_bp.route('/environments', methods=['GET'])
@require_auth
def list_environments():
    """List all environments for the authenticated user."""
    try:
        environments = VirtualEnvironment.query.filter_by(
            user_id=request.user_id
        ).filter(
            VirtualEnvironment.status != 'destroyed'
        ).order_by(
            VirtualEnvironment.created_at.desc()
        ).all()
        
        return jsonify({
            'success': True,
            'environments': [env.to_dict() for env in environments],
            'count': len(environments)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@virtual_env_bp.route('/environments/<int:env_id>', methods=['GET'])
@require_auth
def get_environment(env_id):
    """Get details of a specific environment."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        # Get container status
        status_info = docker_manager.get_container_status(env.container_id) if env.container_id else {}
        
        return jsonify({
            'success': True,
            'environment': env.to_dict(),
            'container_status': status_info
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@virtual_env_bp.route('/environments/<int:env_id>/start', methods=['POST'])
@require_auth
def start_environment(env_id):
    """Start a stopped environment."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        if not env.container_id:
            return jsonify({'error': 'Environment has no container'}), 400
        
        # Start container
        docker_manager.start_environment(env.container_id)
        
        # Update status
        env.status = 'running'
        env.update_access_time()
        db.session.commit()
        
        log_action(env.id, 'start', 'Started environment', 'success', '')
        
        return jsonify({
            'success': True,
            'message': 'Environment started successfully'
        }), 200
    
    except Exception as e:
        log_action(env_id, 'start', 'Failed to start environment', 'error', str(e))
        return jsonify({'error': str(e)}), 500


@virtual_env_bp.route('/environments/<int:env_id>/stop', methods=['POST'])
@require_auth
def stop_environment(env_id):
    """Stop a running environment."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        if not env.container_id:
            return jsonify({'error': 'Environment has no container'}), 400
        
        # Stop container
        docker_manager.stop_environment(env.container_id)
        
        # Update status
        env.status = 'stopped'
        db.session.commit()
        
        log_action(env.id, 'stop', 'Stopped environment', 'success', '')
        
        return jsonify({
            'success': True,
            'message': 'Environment stopped successfully'
        }), 200
    
    except Exception as e:
        log_action(env_id, 'stop', 'Failed to stop environment', 'error', str(e))
        return jsonify({'error': str(e)}), 500


@virtual_env_bp.route('/environments/<int:env_id>', methods=['DELETE'])
@require_auth
def destroy_environment(env_id):
    """Destroy an environment and its container."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        # Destroy Docker container and volume
        if env.container_id:
            docker_manager.destroy_environment(env.container_id, env.volume_name)
        
        # Update status
        env.status = 'destroyed'
        env.destroyed_at = datetime.utcnow()
        db.session.commit()
        
        log_action(env.id, 'destroy', 'Destroyed environment', 'success', '')
        
        return jsonify({
            'success': True,
            'message': 'Environment destroyed successfully'
        }), 200
    
    except Exception as e:
        log_action(env_id, 'destroy', 'Failed to destroy environment', 'error', str(e))
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Command Execution Endpoints
# ============================================================================

@virtual_env_bp.route('/environments/<int:env_id>/execute', methods=['POST'])
@require_auth
def execute_command(env_id):
    """Execute a command in the environment."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        data = request.get_json()
        if not data or 'command' not in data:
            return jsonify({'error': 'Missing required field: command'}), 400
        
        command = data['command']
        
        # Validate command
        is_safe, severity, message = security_validator.validate_command(command)
        if not is_safe:
            log_action(env.id, 'command', command, 'blocked', message)
            return jsonify({
                'error': 'Command blocked for security reasons',
                'reason': message
            }), 403
        
        # Execute command
        start_time = time.time()
        exit_code, stdout, stderr = docker_manager.execute_command(
            env.container_id,
            command,
            timeout=data.get('timeout', 30)
        )
        execution_time = time.time() - start_time
        
        # Update access time
        env.update_access_time()
        db.session.commit()
        
        # Log action
        status = 'success' if exit_code == 0 else 'error'
        output = stdout if stdout else stderr
        log_action(env.id, 'command', command, status, output, execution_time)
        
        return jsonify({
            'success': exit_code == 0,
            'exit_code': exit_code,
            'stdout': stdout,
            'stderr': stderr,
            'execution_time': round(execution_time, 2),
            'severity': severity
        }), 200
    
    except Exception as e:
        log_action(env_id, 'command', command, 'error', str(e))
        return jsonify({'error': str(e)}), 500


@virtual_env_bp.route('/environments/<int:env_id>/logs', methods=['GET'])
@require_auth
def get_logs(env_id):
    """Get execution logs for an environment."""
    try:
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        # Get pagination parameters
        limit = min(int(request.args.get('limit', 50)), 100)
        offset = int(request.args.get('offset', 0))
        
        # Query logs
        logs = EnvironmentLog.query.filter_by(
            environment_id=env_id
        ).order_by(
            EnvironmentLog.created_at.desc()
        ).limit(limit).offset(offset).all()
        
        return jsonify({
            'success': True,
            'logs': [log.to_dict() for log in logs],
            'count': len(logs)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Package Management Endpoints
# ============================================================================

@virtual_env_bp.route('/environments/<int:env_id>/install', methods=['POST'])
@require_auth
def install_packages(env_id):
    """Install packages in the environment."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        data = request.get_json()
        if not data or 'manager' not in data or 'packages' not in data:
            return jsonify({'error': 'Missing required fields: manager, packages'}), 400
        
        manager = data['manager']
        packages = data['packages']
        
        if not isinstance(packages, list):
            return jsonify({'error': 'Packages must be a list'}), 400
        
        # Install packages
        start_time = time.time()
        success, stdout, stderr = package_manager.install_packages(
            env.container_id,
            manager,
            packages
        )
        execution_time = time.time() - start_time
        
        # Update access time
        env.update_access_time()
        db.session.commit()
        
        # Log action
        status = 'success' if success else 'error'
        output = stdout if stdout else stderr
        log_action(env.id, 'install', f'{manager} install {" ".join(packages)}', status, output, execution_time)
        
        return jsonify({
            'success': success,
            'stdout': stdout,
            'stderr': stderr,
            'execution_time': round(execution_time, 2)
        }), 200 if success else 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@virtual_env_bp.route('/environments/<int:env_id>/packages', methods=['GET'])
@require_auth
def list_packages(env_id):
    """List installed packages in the environment."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        manager = request.args.get('manager', 'npm')
        
        # List packages
        success, stdout, stderr = package_manager.list_packages(
            env.container_id,
            manager
        )
        
        return jsonify({
            'success': success,
            'packages': stdout,
            'error': stderr if not success else None
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# File Operations Endpoints
# ============================================================================

@virtual_env_bp.route('/environments/<int:env_id>/files', methods=['GET'])
@require_auth
def list_files(env_id):
    """List files in a directory."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        path = request.args.get('path', '/workspace')
        
        # List directory
        success, files, error = file_manager.list_directory(
            env.container_id,
            path
        )
        
        if not success:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'success': True,
            'path': path,
            'files': files
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@virtual_env_bp.route('/environments/<int:env_id>/files/<path:file_path>', methods=['GET'])
@require_auth
def read_file(env_id, file_path):
    """Read a file's contents."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        # Ensure path starts with /workspace
        if not file_path.startswith('/workspace'):
            file_path = f'/workspace/{file_path}'
        
        # Read file
        success, content, error = file_manager.read_file(
            env.container_id,
            file_path
        )
        
        if not success:
            return jsonify({'error': error}), 400
        
        # Update access time
        env.update_access_time()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'path': file_path,
            'content': content
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@virtual_env_bp.route('/environments/<int:env_id>/files/<path:file_path>', methods=['PUT'])
@require_auth
def write_file(env_id, file_path):
    """Write or update a file."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'Missing required field: content'}), 400
        
        content = data['content']
        append = data.get('append', False)
        
        # Ensure path starts with /workspace
        if not file_path.startswith('/workspace'):
            file_path = f'/workspace/{file_path}'
        
        # Write file
        success, error = file_manager.write_file(
            env.container_id,
            file_path,
            content,
            append
        )
        
        if not success:
            return jsonify({'error': error}), 400
        
        # Update access time
        env.update_access_time()
        db.session.commit()
        
        # Log action
        action = 'file_append' if append else 'file_write'
        log_action(env.id, action, file_path, 'success', f'Wrote {len(content)} bytes')
        
        return jsonify({
            'success': True,
            'message': 'File written successfully',
            'path': file_path
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@virtual_env_bp.route('/environments/<int:env_id>/files/<path:file_path>', methods=['DELETE'])
@require_auth
def delete_file(env_id, file_path):
    """Delete a file or directory."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        # Ensure path starts with /workspace
        if not file_path.startswith('/workspace'):
            file_path = f'/workspace/{file_path}'
        
        recursive = request.args.get('recursive', 'false').lower() == 'true'
        
        # Delete file
        success, error = file_manager.delete_file(
            env.container_id,
            file_path,
            recursive
        )
        
        if not success:
            return jsonify({'error': error}), 400
        
        # Update access time
        env.update_access_time()
        db.session.commit()
        
        # Log action
        log_action(env.id, 'file_delete', file_path, 'success', '')
        
        return jsonify({
            'success': True,
            'message': 'File deleted successfully'
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@virtual_env_bp.route('/environments/<int:env_id>/mkdir', methods=['POST'])
@require_auth
def create_directory(env_id):
    """Create a directory."""
    try:
        docker_manager, security_validator, package_manager, file_manager = get_services()
        env = VirtualEnvironment.query.filter_by(
            id=env_id,
            user_id=request.user_id
        ).first()
        
        if not env:
            return jsonify({'error': 'Environment not found'}), 404
        
        data = request.get_json()
        if not data or 'path' not in data:
            return jsonify({'error': 'Missing required field: path'}), 400
        
        dir_path = data['path']
        
        # Ensure path starts with /workspace
        if not dir_path.startswith('/workspace'):
            dir_path = f'/workspace/{dir_path}'
        
        # Create directory
        success, error = file_manager.create_directory(
            env.container_id,
            dir_path
        )
        
        if not success:
            return jsonify({'error': error}), 400
        
        # Log action
        log_action(env.id, 'mkdir', dir_path, 'success', '')
        
        return jsonify({
            'success': True,
            'message': 'Directory created successfully',
            'path': dir_path
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
