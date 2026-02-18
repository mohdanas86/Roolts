"""
Deployment Routes
Generates deployment configuration files for cloud platforms
"""

from flask import Blueprint, jsonify, request

deployment_bp = Blueprint('deployment', __name__)

@deployment_bp.route('/generate-config', methods=['POST'])
def generate_config():
    """Generate deployment configuration file."""
    data = request.get_json()
    
    platform = data.get('platform', 'vercel')  # 'vercel' or 'netlify'
    framework = data.get('framework', 'static')  # 'react', 'python', 'static'
    
    if platform == 'vercel':
        config = generate_vercel_config(framework)
        filename = 'vercel.json'
    elif platform == 'netlify':
        config = generate_netlify_config(framework)
        filename = 'netlify.toml'
    else:
        return jsonify({'error': 'Unsupported platform'}), 400
    
    return jsonify({
        'filename': filename,
        'content': config,
        'platform': platform
    })


def generate_vercel_config(framework):
    """Generate Vercel configuration."""
    if framework == 'react':
        return """{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": "vite"
}"""
    elif framework == 'python':
        return """{
  "builds": [
    {
      "src": "app.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app.py"
    }
  ]
}"""
    else:  # static
        return """{
  "buildCommand": null,
  "outputDirectory": ".",
  "installCommand": null
}"""


def generate_netlify_config(framework):
    """Generate Netlify configuration."""
    if framework == 'react':
        return """[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
"""
    elif framework == 'python':
        return """[build]
  command = "pip install -r requirements.txt"
  
[build.environment]
  PYTHON_VERSION = "3.9"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
"""
    else:  # static
        return """[build]
  publish = "."

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
"""
