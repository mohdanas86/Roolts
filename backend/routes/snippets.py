"""
Snippet Routes
Handles CRUD operations for user code snippets
"""

from flask import Blueprint, jsonify, request
from models import db, Snippet

snippets_bp = Blueprint('snippets', __name__)

@snippets_bp.route('/', methods=['GET'])
def get_snippets():
    """Get all snippets."""
    snippets = Snippet.query.order_by(Snippet.created_at.desc()).all()
    return jsonify([s.to_dict() for s in snippets])

@snippets_bp.route('/', methods=['POST'])
def create_snippet():
    """Create a new snippet."""
    data = request.get_json()
    
    title = data.get('title')
    content = data.get('content')
    language = data.get('language', 'plaintext')
    description = data.get('description', '')
    
    if not title or not content:
        return jsonify({'error': 'Title and content are required'}), 400
    
    snippet = Snippet(
        title=title,
        content=content,
        language=language,
        description=description
    )
    
    db.session.add(snippet)
    db.session.commit()
    
    return jsonify(snippet.to_dict()), 201

@snippets_bp.route('/<int:id>', methods=['DELETE'])
def delete_snippet(id):
    """Delete a snippet."""
    snippet = Snippet.query.get(id)
    
    if not snippet:
        return jsonify({'error': 'Snippet not found'}), 404
    
    db.session.delete(snippet)
    db.session.commit()
    
    return jsonify({'message': 'Snippet deleted'})
