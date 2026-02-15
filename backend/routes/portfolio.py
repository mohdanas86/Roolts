
import os
import io
import zipfile
from datetime import datetime
from flask import Blueprint, jsonify, request, render_template, send_file, current_app
from models import User

portfolio_bp = Blueprint('portfolio', __name__)

@portfolio_bp.route('/preview', methods=['POST'])
def preview_portfolio():
    """Generate and return HTML for preview."""
    data = request.get_json()
    
    # Extract data from request
    user_data = {
        'name': data.get('name', 'User Name'),
        'bio': data.get('bio', ''),
        'tagline': data.get('tagline', ''),
        'profile_image': data.get('profile_image', None)
    }
    
    skills = data.get('skills', [])
    projects = data.get('projects', [])
    
    theme = {
        'primary_color': data.get('primaryColor', '#3b82f6'),
        'secondary_color': data.get('secondaryColor', '#64748b'),
        'background_color': data.get('backgroundColor', '#ffffff'),
        'text_color': data.get('textColor', '#1e293b'),
        'is_dark': data.get('isDark', False)
    }
    
    # Render template
    html = render_template(
        'portfolio/index.html',
        user=user_data,
        skills=skills,
        projects=projects,
        theme=theme,
        year=datetime.now().year
    )
    
    return jsonify({'html': html})

@portfolio_bp.route('/download', methods=['POST'])
def download_portfolio():
    """Generate zip file with index.html."""
    data = request.get_json()
    
    # Same generation logic (share code ideally)
    user_data = {
        'name': data.get('name', 'User'),
        'bio': data.get('bio', ''),
        'tagline': data.get('tagline', ''),
        'profile_image': data.get('profile_image', None)
    }
    skills = data.get('skills', [])
    projects = data.get('projects', [])
    theme = {
        'primary_color': data.get('primaryColor', '#3b82f6'),
        'secondary_color': data.get('secondaryColor', '#64748b'),
        'background_color': data.get('backgroundColor', '#ffffff'),
        'text_color': data.get('textColor', '#1e293b'),
        'is_dark': data.get('isDark', False)
    }
    
    html = render_template(
        'portfolio/index.html',
        user=user_data,
        skills=skills,
        projects=projects,
        theme=theme,
        year=datetime.now().year
    )
    
    # Create Zip in memory
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w') as zf:
        zf.writestr('index.html', html)
        # Could add css/js assets here if they were external
        
    memory_file.seek(0)
    
    return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name='portfolio.zip'
    )
