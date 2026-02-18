from flask import Blueprint, request, jsonify, Response
import requests
import os

analyzer_proxy_bp = Blueprint('analyzer_proxy', __name__)

# Use environment variable for Java service URL, default to docker name
JAVA_SERVICE_BASE_URL = os.getenv('JAVA_SERVICE_URL', 'http://java-service:8080').rstrip('/')

@analyzer_proxy_bp.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy_to_java(path):
    """Proxy requests to the Java analysis service."""
    url = f"{JAVA_SERVICE_BASE_URL}/api/{path}"
    
    # Forward the request to the Java service
    try:
        resp = requests.request(
            method=request.method,
            url=url,
            headers={key: value for (key, value) in request.headers if key != 'Host'},
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
            timeout=60
        )
        
        # Exclude hop-by-hop headers
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = [(name, value) for (name, value) in resp.raw.headers.items()
                   if name.lower() not in excluded_headers]
        
        response = Response(resp.content, resp.status_code, headers)
        return response
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'Failed to connect to Java analysis service',
            'details': str(e),
            'target_url': url
        }), 502
