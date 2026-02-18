"""
File Management Routes
Handles CRUD operations for code files
"""

import os
import uuid
from datetime import datetime
from flask import Blueprint, jsonify, request

files_bp = Blueprint('files', __name__)

# In-memory file storage (replace with database in production)
file_storage = {}


def get_language_from_extension(filename):
    """Determine programming language from file extension."""
    extension_map = {
        '.py': 'python',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.java': 'java',
        '.html': 'html',
        '.css': 'css',
        '.json': 'json',
        '.md': 'markdown',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.xml': 'xml',
        '.sql': 'sql',
        '.sh': 'shell',
        '.bash': 'shell',
        '.go': 'go',
        '.rs': 'rust',
        '.cpp': 'cpp',
        '.c': 'c',
        '.h': 'c',
        '.hpp': 'cpp'
    }
    _, ext = os.path.splitext(filename)
    return extension_map.get(ext.lower(), 'plaintext')


@files_bp.route('/', methods=['GET'])
def list_files():
    """List all files."""
    files = list(file_storage.values())
    return jsonify({
        'files': files,
        'count': len(files)
    })


@files_bp.route('/', methods=['POST'])
def create_file():
    """Create a new file."""
    data = request.get_json()
    
    if not data or 'name' not in data:
        return jsonify({'error': 'File name is required'}), 400
    
    file_id = str(uuid.uuid4())
    filename = data['name']
    
    file_data = {
        'id': file_id,
        'name': filename,
        'path': data.get('path', f'/{filename}'),
        'content': data.get('content', ''),
        'language': data.get('language', get_language_from_extension(filename)),
        'modified': False,
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat()
    }
    
    file_storage[file_id] = file_data
    
    return jsonify({
        'message': 'File created successfully',
        'file': file_data
    }), 201


@files_bp.route('/<file_id>', methods=['GET'])
def get_file(file_id):
    """Get a specific file by ID."""
    if file_id not in file_storage:
        return jsonify({'error': 'File not found'}), 404
    
    return jsonify({'file': file_storage[file_id]})


@files_bp.route('/<file_id>', methods=['PUT'])
def update_file(file_id):
    """Update a file's content."""
    if file_id not in file_storage:
        return jsonify({'error': 'File not found'}), 404
    
    data = request.get_json()
    
    if 'content' in data:
        file_storage[file_id]['content'] = data['content']
        file_storage[file_id]['modified'] = True
    
    if 'name' in data:
        file_storage[file_id]['name'] = data['name']
        file_storage[file_id]['language'] = get_language_from_extension(data['name'])
    
    file_storage[file_id]['updated_at'] = datetime.utcnow().isoformat()
    
    return jsonify({
        'message': 'File updated successfully',
        'file': file_storage[file_id]
    })


@files_bp.route('/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete a file."""
    if file_id not in file_storage:
        return jsonify({'error': 'File not found'}), 404
    
    deleted_file = file_storage.pop(file_id)
    
    return jsonify({
        'message': 'File deleted successfully',
        'file': deleted_file
    })


@files_bp.route('/<file_id>/save', methods=['POST'])
def save_file(file_id):
    """Mark a file as saved (not modified)."""
    if file_id not in file_storage:
        return jsonify({'error': 'File not found'}), 404
    
    file_storage[file_id]['modified'] = False
    file_storage[file_id]['updated_at'] = datetime.utcnow().isoformat()
    
    return jsonify({
        'message': 'File saved successfully',
        'file': file_storage[file_id]
    })
