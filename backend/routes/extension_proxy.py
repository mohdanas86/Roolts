from flask import Blueprint, request, jsonify, send_from_directory
import requests
import os
import zipfile
import json
import shutil
import threading
from pathlib import Path
from utils.compiler_manager import setup_runtime

extension_proxy_bp = Blueprint('extension_proxy', __name__)

OPEN_VSX_SEARCH_API = "https://open-vsx.org/api/-/search"


# Directory for extracted extensions
EXTENSIONS_DIR = Path(__file__).parent.parent / "extensions_data"
if not EXTENSIONS_DIR.exists():
    EXTENSIONS_DIR.mkdir(parents=True, exist_ok=True)

# Mapping of Extension IDs to Portable Runtime Keys
EXTENSION_COMPILER_MAP = {
    'ms-python.python': 'python',
    'ms-vscode.cpptools': 'c_cpp',
    'theqtcompany.qt-python': 'python',
    'ms-python.debugpy': 'python',
    'ms-python.vscode-python-envs': 'python',
    'vscjava.vscode-java-pack': 'java',
    'redhat.java': 'java',
    'vscjava.vscode-java-debug': 'java',
    'ms-dotnettools.csharp': 'csharp',
    'golang.go': 'go',
    'fwcd.kotlin': 'kotlin',
    'rebornix.Ruby': 'ruby',
    'shopify.ruby-lsp': 'ruby',
    'charliermarsh.ruff': 'python',
    'ms-python.pylint': 'python'
}

@extension_proxy_bp.route('/search', methods=['GET'])
def search_extensions():
    # ... (existing search logic)
    query = request.args.get('query', '')
    if not query:
        return jsonify({'extensions': []})

    try:
        response = requests.get(OPEN_VSX_SEARCH_API, params={'query': query}, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': 'Failed to fetch extensions', 'details': str(e)}), 500

@extension_proxy_bp.route('/install', methods=['POST'])
def install_extension():
    """Download and extract a VSIX package to provide real language features."""
    data = request.get_json()
    download_url = data.get('downloadUrl')
    namespace = data.get('namespace')
    name = data.get('name')
    
    if not download_url or not namespace or not name:
        return jsonify({'error': 'Missing extension details'}), 400

    ext_id = f"{namespace}.{name}"
    target_path = EXTENSIONS_DIR / ext_id
    
    try:
        # 1. Download VSIX
        print(f">>> Downloading extension: {ext_id}")
        response = requests.get(download_url, timeout=30)
        response.raise_for_status()
        
        # 2. Extract VSIX (it's a zip file)
        # We save to a temporary file first
        temp_vsix = EXTENSIONS_DIR / f"{ext_id}.vsix"
        with open(temp_vsix, "wb") as f:
            f.write(response.content)
            
        print(f">>> Extracting VSIX to: {target_path}")
        # Clear existing data if any
        if target_path.exists():
            try:
                shutil.rmtree(target_path)
            except Exception as e:
                print(f"!!! Failed to remove existing extension dir: {e}")
                # Sometimes file is locked on Windows
                import time
                time.sleep(1)
                shutil.rmtree(target_path, ignore_errors=True)
            
        try:
            with zipfile.ZipFile(temp_vsix, 'r') as zip_ref:
                # Extension files are usually inside a 'extension' folder in the zip
                zip_ref.extractall(target_path)
            print(f">>> Extraction complete.")
        except zipfile.BadZipFile:
            return jsonify({'error': 'Invalid VSIX: Not a zip file'}), 400
        except Exception as e:
            print(f"!!! Extraction failed: {e}")
            return jsonify({'error': 'Extraction failed', 'details': str(e)}), 500
        finally:
            # Clean up temp file
            if temp_vsix.exists():
                os.remove(temp_vsix)
        
        # 3. Parse package.json (usually at target_path / 'extension' / 'package.json')
        pkg_json_path = target_path / 'extension' / 'package.json'
        # Sometimes it might be directly at root? Varies by author, but VSIX standard is 'extension' folder
        if not pkg_json_path.exists():
            pkg_json_path = target_path / 'package.json'
            
        if not pkg_json_path.exists():
            return jsonify({'error': 'Invalid VSIX: package.json not found'}), 400
            
        with open(pkg_json_path, 'r', encoding='utf-8') as f:
            pkg_data = json.load(f)
            
        contributes = pkg_data.get('contributes', {})
        results = {
            'id': ext_id,
            'displayName': pkg_data.get('displayName', name),
            'version': pkg_data.get('version'),
            'snippets': [],
            'grammars': [],
            'languages': contributes.get('languages', [])
        }
        
        # 4. Extract Snippet details
        snippets_list = contributes.get('snippets', [])
        for snip in snippets_list:
            snip_path = target_path / 'extension' / snip.get('path', '').replace('./', '')
            if not snip_path.exists():
                snip_path = target_path / snip.get('path', '').replace('./', '')
                
            if snip_path.exists():
                try:
                    with open(snip_path, 'r', encoding='utf-8') as sf:
                        # Some snippet files have comments or are non-standard JSON, but usually they are JSON
                        snip_content = sf.read()
                        print(f">>> Loaded snippets for {snip.get('language')}")
                        results['snippets'].append({
                            'language': snip.get('language'),
                            'content': snip_content
                        })
                except Exception as ex:
                    print(f"Failed to read snippet {snip_path}: {ex}")

        # 5. Extract Theme details
        results['themes'] = contributes.get('themes', [])

        # 6. Trigger Background Compiler Setup if relevant
        ext_full_id = f"{namespace}.{name}"
        runtime_key = EXTENSION_COMPILER_MAP.get(ext_full_id)
        # Also check if name contains language name for generic mapping
        if not runtime_key:
            # Add javascript and nodejs to generic detection
            for lang in ['python', 'java', 'go', 'csharp', 'kotlin', 'ruby', 'javascript', 'nodejs']:
                if lang in ext_full_id.lower():
                    if lang == 'javascript' or lang == 'nodejs':
                        runtime_key = 'nodejs'
                    else:
                        runtime_key = 'c_cpp' if lang == 'cpp' else lang
                    break

        if runtime_key:
            print(f">>> Triggering background setup for runtime: {runtime_key}")
            # Use a thread to avoid blocking the API response
            threading.Thread(target=setup_runtime, args=(runtime_key,), daemon=True).start()

        # 7. Trigger LSP server installation for language extensions
        LSP_LANG_MAP = {
            'python': 'python',
            'java': 'java',
        }
        lsp_lang = LSP_LANG_MAP.get(runtime_key)
        if lsp_lang:
            def _install_lsp():
                try:
                    import importlib
                    setup = importlib.import_module('scripts.setup_lsp')
                    if lsp_lang == 'python':
                        setup.install_python_lsp()
                    elif lsp_lang == 'java':
                        setup.install_jdtls()
                    print(f">>> LSP server installed for {lsp_lang}")
                except Exception as e:
                    print(f">>> LSP install failed for {lsp_lang}: {e}")
            threading.Thread(target=_install_lsp, daemon=True).start()

        return jsonify({'success': True, 'data': results})

    except Exception as e:
        print(f"Extension install failed: {str(e)}")
        return jsonify({'error': 'Extension installation failed', 'details': str(e)}), 500

@extension_proxy_bp.route('/file/<ext_id>/<path:filename>', methods=['GET'])
def serve_extension_file(ext_id, filename):
    """Serve a file from an installed extension."""
    try:
        # Securely join paths
        file_path = (EXTENSIONS_DIR / ext_id / filename).resolve()
        
        # Ensure we don't escape the extension directory
        base_path = (EXTENSIONS_DIR / ext_id).resolve()
        if not str(file_path).startswith(str(base_path)):
             return jsonify({'error': 'Access denied'}), 403
             
        if not file_path.exists():
             # Try looking inside 'extension' subfolder if not found at root
             file_path = (EXTENSIONS_DIR / ext_id / 'extension' / filename).resolve()
             if not file_path.exists():
                return jsonify({'error': 'File not found'}), 404

        return send_from_directory(file_path.parent, file_path.name)
    except Exception as e:
         return jsonify({'error': 'Failed to serve file', 'details': str(e)}), 500
