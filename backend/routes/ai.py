import os
import re
import json
import time
import asyncio
import base64
import requests
from bs4 import BeautifulSoup
from functools import lru_cache
from flask import Blueprint, jsonify, request
from services.multi_ai import MultiAIService
from utils.compiler_context import get_compiler_summary
from utils.async_utils import run_async
from services.vault import vault
from routes.auth import get_current_user, require_auth
from models import db, ChatHistory

ai_bp = Blueprint('ai', __name__)

# Cache compiler summary so it's not regenerated on every request
@lru_cache(maxsize=1)
def _cached_compiler_summary():
    return get_compiler_summary()


@ai_bp.route('/status', methods=['GET'])
def ai_status():
    """Check AI configuration status — which providers are available."""
    try:
        service = get_ai_service()
        available = service.get_available_models()
        vault_keys = vault.list_sealed()
        
        return jsonify({
            'configured': len(available) > 0,
            'available_models': available,
            'vault_keys': vault_keys,
            'source': 'vault' if vault_keys else ('env' if available else 'none')
        })
    except Exception as e:
        return jsonify({
            'configured': False,
            'available_models': [],
            'vault_keys': [],
            'source': 'none',
            'error': str(e)
        })

def get_ai_service():
    """Get AI service configured with a merge of vault, env vars, and user keys."""
    user = get_current_user()
    
    # 1. Start with encrypted vault keys as the base (lowest priority)
    vault_keys = {}
    try:
        vault_keys = vault.get_all_keys()
        vault_keys = {k: v for k, v in vault_keys.items() if v and not str(v).startswith('your-')}
    except Exception as e:
        print(f"[AI] Vault read warning: {e}")
    
    # 2. Environment variables override vault
    env_keys = {
        'openai': os.getenv('OPENAI_API_KEY'),
        'gemini': os.getenv('GEMINI_API_KEY'),
        'claude': os.getenv('CLAUDE_API_KEY'),
        'deepseek': os.getenv('DEEPSEEK_API_KEY'),
        'qwen': os.getenv('QWEN_API_KEY'),
        'huggingface': os.getenv('HF_TOKEN')
    }
    env_keys = {k: v for k, v in env_keys.items() if v and not v.startswith('your-')}
    
    # 3. User's stored API keys override everything (highest priority)
    user_keys = {}
    if user:
        user_keys = {
            'openai': user.openai_api_key,
            'gemini': user.gemini_api_key,
            'claude': user.claude_api_key,
            'deepseek': user.deepseek_api_key,
            'qwen': user.qwen_api_key,
            'huggingface': user.hf_token
        }
        user_keys = {k: v for k, v in user_keys.items() if v and not str(v).startswith('your-')}
    
    # Merge: vault → env → user → headers (later sources override earlier)
    # 4. Request Headers override (transient UI keys, highest priority overall)
    header_keys = {}
    provider_header = request.headers.get('X-AI-Provider')
    key_header = request.headers.get('X-AI-Key')
    
    # NEW: All Keys JSON header for 'auto' mode selection
    all_keys_header = request.headers.get('X-AI-Keys-JSON')
    if all_keys_header:
        try:
            extra_keys = json.loads(all_keys_header)
            # Use specific providers as defined in the JSON
            header_keys.update({k: v for k, v in extra_keys.items() if v})
        except:
            pass

    # If a specific provider was targeted in the UI, ensure its key is the absolute override
    if provider_header and key_header and provider_header != 'roolts':
        target = provider_header.lower()
        if target == 'huggingface':
            header_keys['hf_token'] = key_header
            header_keys['huggingface'] = key_header
        else:
            header_keys[target] = key_header

    final_keys = {**vault_keys, **env_keys, **user_keys, **header_keys}
    
    # --- LOGGING FOR DIAGNOSTICS ---
    sources = []
    if vault_keys: sources.append(f"vault({list(vault_keys.keys())})")
    if env_keys: sources.append(f"env({list(env_keys.keys())})")
    if user_keys: sources.append(f"db({list(user_keys.keys())})")
    if header_keys: sources.append(f"headers({list(header_keys.keys())})")
    
    print(f"[AI] Key resolution: {' -> '.join(sources)}")
    print(f"[AI] Configured models in MultiAIService start...")
    
    service = MultiAIService(final_keys)
    available = service.get_available_models()
    print(f"[AI] Final available models: {available}")
    
    return service

def get_custom_ai_service(api_key, provider):
    """Get AI service with a specific custom key (BYOK)."""
    keys = {provider: api_key}
    # We still include env keys as fallbacks/auxiliary if needed, but the specific provider key is overridden
    # For now, let's just pass this key to ensure isolation for the chosen provider
    return MultiAIService(keys)


def detect_language(code):
    """Detect programming language from code patterns."""
    patterns = {
        'python': [r'\bdef\s+\w+\s*\(', r'\bimport\s+\w+', r'print\s*\(', r':\s*$'],
        'javascript': [r'\bfunction\s+\w+\s*\(', r'\bconst\s+\w+\s*=', r'\blet\s+\w+\s*=', r'=>'],
        'java': [r'\bpublic\s+class\s+', r'\bpublic\s+static\s+void\s+main', r'System\.out\.print'],
        'html': [r'<html', r'<div', r'<body', r'<!DOCTYPE'],
        'css': [r'\{[^}]*:\s*[^}]+\}', r'@media', r'\.[\w-]+\s*\{'],
    }
    
    for lang, lang_patterns in patterns.items():
        for pattern in lang_patterns:
            if re.search(pattern, code, re.MULTILINE):
                return lang
    
    return 'plaintext'


def scrape_google_images(query: str):
    """Fetch a relevant image using Wikipedia's open REST API based on the query."""
    try:
        # Search for the most relevant Wikipedia article
        search_url = f"https://en.wikipedia.org/w/api.php"
        search_params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "format": "json",
            "srlimit": 1
        }
        search_r = requests.get(search_url, params=search_params, timeout=5)
        search_data = search_r.json()
        results = search_data.get("query", {}).get("search", [])
        if not results:
            return None

        title = results[0]["title"]

        # Fetch the page thumbnail/image for that article
        image_params = {
            "action": "query",
            "titles": title,
            "prop": "pageimages",
            "pithumbsize": 600,
            "format": "json"
        }
        image_r = requests.get(search_url, params=image_params, timeout=5)
        image_data = image_r.json()
        pages = image_data.get("query", {}).get("pages", {})
        for page in pages.values():
            thumbnail = page.get("thumbnail", {})
            if thumbnail.get("source"):
                return thumbnail["source"]
    except Exception as e:
        print(f"Error fetching Wikipedia image: {e}")
    return None


def generate_mock_explanation(code, language):
    """Generate a mock code explanation (replace with actual AI in production)."""
    lines = code.strip().split('\n')
    num_lines = len(lines)
    
    explanation = f"""## Code Analysis

**Language Detected:** {language.capitalize()}
**Lines of Code:** {num_lines}

### Overview
This code appears to be a {language} program. Here's a breakdown of what it does:

### Key Components

"""
    
    if language == 'python':
        # Find functions
        functions = re.findall(r'def\s+(\w+)\s*\([^)]*\)', code)
        if functions:
            explanation += "**Functions defined:**\n"
            for func in functions:
                explanation += f"- `{func}()` - A function that performs specific operations\n"
            explanation += "\n"
        
        # Find imports
        imports = re.findall(r'import\s+(\w+)', code)
        if imports:
            explanation += "**Libraries imported:**\n"
            for imp in imports:
                explanation += f"- `{imp}` - External library\n"
    
    elif language == 'javascript':
        functions = re.findall(r'function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|function)', code)
        if functions:
            explanation += "**Functions/Constants defined:**\n"
            for match in functions:
                name = match[0] or match[1]
                if name:
                    explanation += f"- `{name}` - JavaScript function or constant\n"
    
    explanation += """
### Suggestions
- Consider adding comments to explain complex logic
- Ensure proper error handling is in place
- Follow naming conventions for better readability

### Learning Resources
Check the Resources tab for relevant documentation and tutorials.
"""
    
    return explanation


def generate_mock_diagram(code, language):
    """Generate a mock Mermaid diagram (replace with actual AI in production)."""
    diagram = """graph TD
    A[Start] --> B{Input}
    B --> C[Process Data]
    C --> D{Validate}
    D -->|Valid| E[Output Result]
    D -->|Invalid| F[Handle Error]
    E --> G[End]
    F --> B
"""
    
    # Try to generate a more specific diagram based on code
    if language == 'python':
        functions = re.findall(r'def\s+(\w+)\s*\([^)]*\)', code)
        if functions:
            diagram = "graph TD\n"
            diagram += "    Start([Start]) --> Main\n"
            for i, func in enumerate(functions):
                next_node = functions[i + 1] if i < len(functions) - 1 else "End"
                if i == 0:
                    diagram += f"    Main --> {func}[{func}()]\n"
                diagram += f"    {func} --> {next_node}\n" if i < len(functions) - 1 else f"    {func} --> End([End])\n"
    
    return diagram


def generate_mock_resources(language):
    """Generate mock learning resources (replace with actual AI in production)."""
    resources = {
        'python': [
            {
                'title': 'Python Official Documentation',
                'url': 'https://docs.python.org/3/',
                'description': 'Official Python language documentation and tutorial'
            },
            {
                'title': 'Real Python Tutorials',
                'url': 'https://realpython.com/',
                'description': 'In-depth Python tutorials and guides'
            },
            {
                'title': 'Python Design Patterns',
                'url': 'https://refactoring.guru/design-patterns/python',
                'description': 'Common design patterns implemented in Python'
            }
        ],
        'javascript': [
            {
                'title': 'MDN Web Docs - JavaScript',
                'url': 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
                'description': 'Comprehensive JavaScript documentation'
            },
            {
                'title': 'JavaScript.info',
                'url': 'https://javascript.info/',
                'description': 'Modern JavaScript tutorial from basics to advanced'
            },
            {
                'title': 'ES6 Features',
                'url': 'https://es6-features.org/',
                'description': 'Overview of ECMAScript 6 features'
            }
        ],
        'java': [
            {
                'title': 'Oracle Java Documentation',
                'url': 'https://docs.oracle.com/en/java/',
                'description': 'Official Java SE documentation'
            },
            {
                'title': 'Baeldung',
                'url': 'https://www.baeldung.com/',
                'description': 'Java and Spring tutorials'
            }
        ]
    }
    
    return resources.get(language, [
        {
            'title': 'Stack Overflow',
            'url': 'https://stackoverflow.com/',
            'description': 'Community Q&A for programmers'
        },
        {
            'title': 'GitHub',
            'url': 'https://github.com/',
            'description': 'Explore open source projects'
        }
    ])


@ai_bp.route('/explain', methods=['POST'])
def explain_code():
    """Generate an AI-powered explanation of code with optional error context."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', '')
    terminal_error = data.get('error', '')
    
    if not code:
        return jsonify({'error': 'Code is required'}), 400
    
    # Detect language if not provided
    if not language:
        language = detect_language(code)
    
    service = get_ai_service()
    
    # Use the specialized explainer service
    try:
        # EXECUTE ASYNC
        result = run_async(service.explainer.explain_code(code, language, context_query=terminal_error))
        
        if 'error' in result:
             # Fallback to mock if error
             explanation = generate_mock_explanation(code, language)
             explanation = f"> [!WARNING]\n> AI Analysis failed ({result['error']}). Showing mock analysis instead.\n\n" + explanation
             provider = 'Mock'
             model = 'Mock'
        else:
             overview = result.get('overview', '')
             concepts = result.get('key_concepts', [])
             flow = result.get('logic_flow', '')
             complexity = result.get('complexity', '')
             adivce = result.get('improvement_suggestions', [])
             
             explanation = f"### Overview\n{overview}\n\n"
             
             if concepts:
                 explanation += "### Key Concepts\n" + "\n".join([f"- {c}" for c in concepts]) + "\n\n"
                 
             explanation += f"### Logic Flow\n{flow}\n\n"
             
             if complexity:
                 explanation += f"### Complexity\n{complexity}\n\n"
                 
             if adivce:
                 explanation += "### Improvements\n" + "\n".join([f"- {a}" for a in adivce])
             
             provider = 'DeepSeek (Async)'
             model = 'deepseek-coder'

    except Exception as e:
        # explanation = generate_mock_explanation(code, language)
        explanation = f"> [!ERROR]\n> System Error: {str(e)}\n\n"
        provider = 'System'
        model = 'Error'
    
    return jsonify({
        'explanation': explanation,
        'language': language,
        'provider': provider,
        'model': model
    })


@ai_bp.route('/scan-compiler', methods=['POST'])
def scan_compiler():
    """Provides diagnostics about the Roolts execution environment."""
    service = get_ai_service()
    try:
        summary = get_compiler_summary()
        result = run_async(service.chat(
            f"Explain the following Roolts execution environment status to the user:\n\n{summary}",
            model='gemini',
            system_prompt="You are a system administrator. Explain the available runtimes and system limits clearly."
        ))
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/diagram', methods=['POST'])
def generate_diagram():
    """Generate a visual diagram from code."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', '')
    diagram_type = data.get('type', 'flowchart')  # flowchart, sequence, class
    
    if not code:
        return jsonify({'error': 'Code is required'}), 400
    
    if not language:
        language = detect_language(code)
    
    service = get_ai_service()
    system_prompt = "You are a code visualization expert. Generate Mermaid.js diagram code based on the provided code. Return ONLY the Mermaid diagram code, no markdown code blocks."
    prompt = f"Create a {diagram_type} diagram for this {language} code:\n\n{code}"
    
    # EXECUTE ASYNC
    result = run_async(service.chat(prompt, model='auto', system_prompt=system_prompt, hide_thinking=True))
    
    if 'error' in result:
        diagram = generate_mock_diagram(code, language)
    else:
        diagram = result.get('response', '').strip()
        # Clean up in case AI included code blocks
        if diagram.startswith('```'):
            diagram = re.sub(r'^```(mermaid)?\n|```$', '', diagram, flags=re.MULTILINE).strip()
    
    return jsonify({
        'diagram': diagram,
        'type': diagram_type,
        'language': language,
        'provider': result.get('provider', 'Mock')
    })


@ai_bp.route('/resources', methods=['POST'])
def suggest_resources():
    """Suggest learning resources based on code with AI support."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', '')
    terminal_error = data.get('error', '')

    if not code and not language:
        return jsonify({'resources': generate_mock_resources('python')})
    
    if not language:
        language = detect_language(code)

    service = get_ai_service()
    try:
        # Use AI to find 3 relevant documentation links
        prompt = f"Suggest 3 high-quality documentation or tutorial links for a developer working with {language} on this code:\n\n```{language}\n{code[:8000]}\n```"
        if terminal_error:
            prompt += f"\n\nThe user is also seeing this error: {terminal_error}"
            
        system_prompt = (
            "You are a helpful assistant. Provide exactly 3 high-quality learning resources in JSON format. "
            "Return a JSON object with a 'resources' key containing a list of objects with 'title', 'url', and 'description'. "
            "Prioritize official docs or reputable blogs like MDN, Real Python, or Baeldung."
        )
        
        result = run_async(service.chat(prompt, model='gemini', system_prompt=system_prompt, hide_thinking=True))
        
        # Parse the JSON response
        try:
            content = result.get('response', '')
            # Clean possible markdown formatting
            if '```json' in content:
                content = re.search(r'```json\n?(.*?)\n?```', content, re.DOTALL).group(1)
            elif '```' in content:
                content = re.search(r'```\n?(.*?)\n?```', content, re.DOTALL).group(1)
                
            res_data = json.loads(content)
            resources = res_data.get('resources', [])
            if not resources:
                raise ValueError("No resources in AI response")
        except Exception:
            # Fallback to mock on parse error
            resources = generate_mock_resources(language)
            
        return jsonify({
            'response': f"I've found these **{language.capitalize()}** learning resources for you:",
            'resources': resources,
            'language': language,
            'provider': result.get('provider', 'AI')
        })
    except Exception as e:
        print(f"Resource suggestion failed: {e}")
        return jsonify({
            'response': "> [!WARNING]\n> Failed to generate AI resources. Showing standard links.",
            'resources': generate_mock_resources(language),
            'language': language,
            'provider': 'Mock Fallback'
        })


@ai_bp.route('/analyze', methods=['POST'])
def analyze_code():
    """Comprehensive code analysis - explanation, diagram, and resources."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', '')
    
    if not code:
        return jsonify({'error': 'Code is required'}), 400
    
    if not language:
        language = detect_language(code)
    
    service = get_ai_service()
    
    # Define async tasks wrapper
    async def run_analysis_tasks():
        # Task 1: Explanation via AIExplainerService
        async def get_explanation():
            try:
                return await service.explainer.explain_code(code, language)
            except Exception as e:
                return {'error': str(e)}

        # Task 2: Diagram via Chat (DeepSeek)
        async def get_diagram():
            return await service.chat(
                f"Generate a Mermaid flowchart for this {language} code:\n\n{code}",
                model='auto',
                system_prompt="Return ONLY the Mermaid.js graph code. No markdown.",
                hide_thinking=True
            )

        return await asyncio.gather(get_explanation(), get_diagram())

    # EXECUTE ASYNC TASKS
    try:
        expl_result, diag_result = run_async(run_analysis_tasks())
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    # 1. Explanation processing
    if 'error' in expl_result:
        explanation = generate_mock_explanation(code, language)
        explanation = f"> [!WARNING]\n> AI Explanation failed ({expl_result['error']}). Showing mock analysis.\n\n" + explanation
        provider = 'Mock'
    else:
        # Format structured explanation
        overview = expl_result.get('overview', '')
        concepts = expl_result.get('key_concepts', [])
        flow = expl_result.get('logic_flow', '')
        complexity = expl_result.get('complexity', '')
        adivce = expl_result.get('improvement_suggestions', [])
        
        explanation = f"### Overview\n{overview}\n\n"
        if concepts: explanation += "### Key Concepts\n" + "\n".join([f"- {c}" for c in concepts]) + "\n\n"
        explanation += f"### Logic Flow\n{flow}\n\n"
        if complexity: explanation += f"### Complexity\n{complexity}\n\n"
        if adivce: explanation += "### Improvements\n" + "\n".join([f"- {a}" for a in adivce])
        
        provider = 'DeepSeek (Async)'
    
    # 2. Diagram processing
    if 'error' in diag_result:
        diagram = generate_mock_diagram(code, language)
    else:
        diagram = diag_result.get('response', '')
        if diagram.startswith('```'):
            diagram = re.sub(r'^```(mermaid)?\n|```$', '', diagram, flags=re.MULTILINE).strip()
    
    # 3. Resources (Mocking for now as it's just links)
    resources = generate_mock_resources(language)
    
    return jsonify({
        'explanation': explanation,
        'diagram': diagram,
        'resources': resources,
        'language': language,
        'provider': provider
    })


@ai_bp.route('/commit-message', methods=['POST'])
def suggest_commit_message():
    """Generate a smart commit message based on code changes."""
    data = request.get_json()
    files_changed = data.get('files', [])
    diff = data.get('diff', '')
    
    if not files_changed and not diff:
        return jsonify({'error': 'Files or diff required'}), 400
    
    # Mock commit message generation
    if files_changed:
        file_names = [f.get('name', 'unknown') for f in files_changed]
        primary_file = file_names[0] if file_names else 'files'
        
        suggestions = [
            f"feat: update {primary_file}",
            f"fix: improve {primary_file} implementation",
            f"refactor: clean up {primary_file}",
            f"docs: update {primary_file}",
            f"chore: maintain {primary_file}"
        ]
    else:
        suggestions = [
            "feat: add new feature",
            "fix: resolve issue",
            "refactor: improve code structure",
            "docs: update documentation",
            "chore: miscellaneous updates"
        ]
    
    return jsonify({
        'suggestions': suggestions,
        'recommended': suggestions[0]
    })


@ai_bp.route('/review', methods=['POST'])
def review_code():
    """Analyze code for bugs, security issues, and style improvements."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext')

    if not code:
        return jsonify({'error': 'Code is required'}), 400
    
    service = get_ai_service()
    
    try:
        # EXECUTE ASYNC
        result = run_async(service.code_champ.analyze_code(code, language))
        
        if 'error' in result:
             return jsonify({
                'review': {'issues': [{'type': 'warning', 'message': f"AI Analysis failed: {result['error']}"}]},
                'provider': 'System',
                'model': 'Error'
            })
            
        # Map AnalysisResult to frontend format
        issues = []
        for bug in result.get('bugs', []):
            severity_map = {'critical': 'error', 'major': 'warning', 'minor': 'info'}
            issues.append({
                'type': severity_map.get(bug.get('severity', 'minor'), 'info'),
                'line': bug.get('line'),
                'message': bug.get('description'),
                'fix': bug.get('suggestion')
            })
            
        for sec in result.get('security_issues', []):
            issues.append({
                'type': 'error',
                'message': f"Security: {sec}",
                'fix': 'Review security best practices.'
            })
            
        return jsonify({
            'review': {'issues': issues},
            'provider': 'DeepSeek (Async)',
            'model': 'deepseek-coder'
        })

    except Exception as e:
        print(f"Code review failed: {str(e)}")
        return jsonify({'error': str(e)}), 500




def _refactor_prompt(language, code, error):
    prompt = f"Refactor this {language} code:\n\n```{language}\n{code}\n```"
    if error:
        prompt += f"\n\nContext (Program Output/Error):\n```\n{error}\n```"
    return prompt

@ai_bp.route('/refactor', methods=['POST'])
def refactor_code():
    """AI-powered code refactoring — rewrites code following best practices."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext')
    error = data.get('error', '')

    if not code:
        return jsonify({'error': 'Code is required'}), 400
    if not language or language == 'plaintext':
        language = detect_language(code)

    service = get_ai_service()
    system_prompt = (
        "You are an expert code refactoring tool. Rewrite the given code to be cleaner, more efficient, "
        "and follow best practices (SOLID, DRY, clean architecture). "
        "Rules:\n"
        "1. Return the COMPLETE refactored code in a fenced code block\n"
        "2. After the code, add a '### Changes Made' section listing each improvement\n"
        "3. Preserve all functionality — do NOT remove features\n"
        "4. Add proper error handling, type hints, and comments\n"
        "5. Use modern language idioms"
    )
    prompt = _refactor_prompt(language, code, error)

    result = run_async(service.chat(prompt, model='auto', system_prompt=system_prompt, hide_thinking=True))

    return jsonify({
        'response': result.get('response', ''),
        'model': result.get('model', 'unknown'),
        'provider': result.get('provider', 'unknown'),
        'feature': 'refactor'
    })



@ai_bp.route('/generate-tests', methods=['POST'])
def generate_tests():
    """AI-powered test generation — creates comprehensive unit tests."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext')

    if not code:
        return jsonify({'error': 'Code is required'}), 400
    if not language or language == 'plaintext':
        language = detect_language(code)

    service = get_ai_service()
    
    # Map language to test framework
    framework_map = {
        'python': 'pytest with clear fixtures',
        'javascript': 'Jest with describe/it blocks',
        'typescript': 'Jest or Vitest with TypeScript types',
        'java': 'JUnit 5 with @Test annotations',
        'c': 'assert-based tests with a main function',
        'cpp': 'Google Test or Catch2',
        'go': 'Go testing package',
        'rust': '#[test] module',
    }
    framework = framework_map.get(language, 'appropriate testing framework')

    system_prompt = (
        f"You are a test generation expert. Generate comprehensive unit tests using {framework}.\n"
        "Rules:\n"
        "1. Test ALL public functions/methods\n"
        "2. Include edge cases: empty input, null/None, boundary values, large input\n"
        "3. Include at least one negative/error test\n"
        "4. Use descriptive test names explaining what is being tested\n"
        "5. Return ONLY the test code in a fenced code block\n"
        "6. Add a brief '### Test Coverage' summary after the code"
    )
    error = data.get('error', '')
    prompt = f"Generate unit tests for this {language} code:\n\n```{language}\n{code}\n```"
    if error:
        prompt += f"\n\nContext (Program Output/Error):\n```\n{error}\n```"

    result = run_async(service.chat(prompt, model='auto', system_prompt=system_prompt, hide_thinking=True))

    return jsonify({
        'response': result.get('response', ''),
        'model': result.get('model', 'unknown'),
        'provider': result.get('provider', 'unknown'),
        'feature': 'generate-tests'
    })


@ai_bp.route('/generate-docs', methods=['POST'])
def generate_docs():
    """AI-powered documentation — adds docstrings, comments, and README content."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext')

    if not code:
        return jsonify({'error': 'Code is required'}), 400
    if not language or language == 'plaintext':
        language = detect_language(code)

    service = get_ai_service()
    system_prompt = (
        "You are a documentation expert. Add comprehensive documentation to the given code.\n"
        "Rules:\n"
        "1. Add docstrings/JSDoc/Javadoc to ALL functions, classes, and methods\n"
        "2. Add inline comments for complex logic\n"
        "3. Include parameter types, return types, and descriptions\n"
        "4. Add usage examples in docstrings where helpful\n"
        "5. Return the COMPLETE documented code in a fenced code block\n"
        "6. After the code, add a '### API Reference' section summarizing public functions"
    )
    prompt = f"Add documentation to this {language} code:\n\n```{language}\n{code}\n```"

    result = run_async(service.chat(prompt, model='auto', system_prompt=system_prompt, hide_thinking=True))

    return jsonify({
        'response': result.get('response', ''),
        'model': result.get('model', 'unknown'),
        'provider': result.get('provider', 'unknown'),
        'feature': 'generate-docs'
    })


@ai_bp.route('/translate', methods=['POST'])
def translate_code():
    """AI-powered code translation — converts code between programming languages."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext')
    target_language = data.get('targetLanguage', 'python')

    if not code:
        return jsonify({'error': 'Code is required'}), 400
    if not language or language == 'plaintext':
        language = detect_language(code)

    service = get_ai_service()
    system_prompt = (
        f"You are a code translation expert. Convert code from {language} to {target_language}.\n"
        "Rules:\n"
        "1. Preserve ALL functionality exactly\n"
        "2. Use idiomatic patterns for the target language\n"
        "3. Map libraries to equivalent target-language libraries\n"
        "4. Return the COMPLETE translated code in a fenced code block\n"
        "5. After the code, add a '### Translation Notes' section highlighting key differences"
    )
    prompt = f"Translate this {language} code to {target_language}:\n\n```{language}\n{code}\n```"

    result = run_async(service.chat(prompt, model='auto', system_prompt=system_prompt, hide_thinking=True))

    return jsonify({
        'response': result.get('response', ''),
        'model': result.get('model', 'unknown'),
        'provider': result.get('provider', 'unknown'),
        'feature': 'translate',
        'targetLanguage': target_language
    })


@ai_bp.route('/fix', methods=['POST'])
def fix_code():
    """AI-powered bug fixing — finds and fixes bugs, returns corrected code."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext')
    error_message = data.get('error', '')

    if not code:
        return jsonify({'error': 'Code is required'}), 400
    if not language or language == 'plaintext':
        language = detect_language(code)

    service = get_ai_service()
    
    error_context = f"\n\nThe user is getting this error:\n```\n{error_message}\n```" if error_message else ""
    
    system_prompt = (
        "You are an expert debugger. Find and fix ALL bugs in the given code.\n"
        "Rules:\n"
        "1. Return the COMPLETE fixed code in a fenced code block\n"
        "2. Before the code, add a '### Bugs Found' section listing each bug with:\n"
        "   - Line number (approx)\n"
        "   - Description of the bug\n"
        "   - How you fixed it\n"
        "3. Check for: logic errors, off-by-one, null/undefined access, resource leaks, "
        "race conditions, type mismatches, missing error handling\n"
        "4. If the code has no bugs, say so and suggest preventive improvements"
    )
    prompt = f"Find and fix bugs in this {language} code:{error_context}\n\n```{language}\n{code}\n```"

    result = run_async(service.chat(prompt, model='auto', system_prompt=system_prompt, hide_thinking=True))

    return jsonify({
        'response': result.get('response', ''),
        'model': result.get('model', 'unknown'),
        'provider': result.get('provider', 'unknown'),
        'feature': 'fix'
    })


@ai_bp.route('/chat', methods=['POST'])
def chat_with_ai():
    """Handle interactive chat about code."""
    try:
        data = request.get_json()
        code = data.get('code', '')
        language = data.get('language', '')
        query = data.get('query', '')
        history = data.get('history', [])
        execution_output = data.get('executionOutput', '')

        # BYOK Support
        api_key = data.get('apiKey')
        provider = data.get('provider') or request.headers.get('X-AI-Provider')

        if not query:
            return jsonify({'error': 'Query is required'}), 400

        if not language and code:
            language = detect_language(code)

        if api_key and provider and not str(api_key).startswith('your-'):
            # Legacy fallback: Use the user's provided key if it's explicitly in the payload
            service = get_custom_ai_service(api_key, provider)
            target_model = provider
        else:
            # New flow: get_ai_service will automatically read X-AI-Key
            service = get_ai_service()
            target_model = provider if provider and provider != 'roolts' else 'auto'

        system_prompt = (
            "You are Roolts Assistant—a thoughtful, calm, and precise communicator. "
            "Write with an elegant, unhurried rhythm and a natural flow of thought.\n\n"
            "## 📝 CORE PRINCIPLES\n"
            "- **Tone**: Composed and deliberate. Address the user as an intelligent peer—never lecture or patronise. "
            "Avoid all enthusiastic openers (e.g., 'Sure!', 'Absolutely!') and casual fillers.\n"
            "- **Structure**: Most responses must follow this shape:\n"
            "  1. A direct, distilled answer in one to four well-formed sentences.\n"
            "  2. Only when genuinely needed, unfold the reasoning or context in calm, connected paragraphs that allow each idea space to settle.\n"
            "  3. Close naturally with the single most important takeaway or a logical next question.\n"
            "- **Formatting**: Leave intentional spaciousness between paragraphs so the text feels airy. "
            "Use italics for quiet nuance and em-dashes (—) for measured asides. Bold is exceptionally rare.\n"
            "- **Structural Aids**: Use markdown tables for structured comparisons or data presentation. "
            "Provide production-ready code blocks when technical implementation is required. "
            "Ensure these elements are introduced gracefully without breaking the unhurried narrative flow.\n"
            "- **Constraints**: Do NOT use markdown headings (###) unless the response is long (over 600 words). "
            "Steer clear of corporate buzzwords, TikTok cadence, and exaggerated enthusiasm markers.\n\n"
            "## 📊 TECHNICAL PRECISION\n"
            "When discussing algorithms or technical metrics, embed them naturally into your paragraphs using italics, "
            "for example: *The time complexity is O(n), while the space required remains O(1).*\n\n"
            f"{_cached_compiler_summary()}"
        )

        # Build context-aware query
        context_prefix = ""
        if code:
            context_prefix += f"[CONTEXT: Active File ({language})]\n```{language}\n{code}\n```\n\n"
        
        if execution_output:
            context_prefix += f"[CONTEXT: Execution Output]\n```\n{execution_output}\n```\n\n"

        messages = []
        if history:
            for msg in history:
                role = msg.get('role', 'user')
                messages.append({'role': role, 'content': msg.get('content', '')})
        
        # Ensure the AI "reads the code" by prepending context to the query
        final_query = f"{context_prefix}User Query: {query}"
        messages.append({'role': 'user', 'content': final_query})
        
        # EXECUTE ASYNC
        result = run_async(service.chat(
            prompt=final_query, 
            model=target_model, 
            system_prompt=system_prompt,
            messages=messages,
            hide_thinking=True
        ))
    except Exception as e:
        print(f"Chat Route Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'response': f"> [!ERROR]\n> **System Error**: {str(e)}\n\nPlease try again later.",
            'model': 'error',
            'provider': 'System'
        })
    
    if 'error' in result:
        return jsonify({
            'response': f"> [!CAUTION]\n> **AI Error ({result.get('model', 'unknown')})**: {result['error']}\n\nPlease check your API keys or try a different model.",
            'model': result.get('model', 'error'),
            'provider': result.get('provider', 'System')
        })
    
    # Try fetching a relevant image if the query asks for concepts, algorithms, etc.
    image_url = None
    if len(query) > 3 and len(query) < 200:
        # Avoid long blocks of code
        image_url = scrape_google_images(query + " diagram concept")
    
    return jsonify({
        'response': result.get('response', ''),
        'reasoning': result.get('reasoning', ''),
        'model': result.get('model', 'unknown'),
        'provider': result.get('provider', 'unknown'),
        'image': image_url
    })

@ai_bp.route('/history', methods=['GET'])
@require_auth
def get_chat_history():
    """Get chat history for the current user."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
        
    history = ChatHistory.query.filter_by(user_id=user.id).order_by(ChatHistory.created_at.asc()).all()
    return jsonify([h.to_dict() for h in history])

@ai_bp.route('/history', methods=['POST'])
@require_auth
def save_chat_message():
    """Save a new chat message to history."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    role = data.get('role')
    content = data.get('content')
    reasoning = data.get('reasoning')
    
    if not role or not content:
        return jsonify({'error': 'Role and content are required'}), 400
        
    message = ChatHistory(
        user_id=user.id,
        role=role,
        content=content,
        reasoning=reasoning
    )
    
    db.session.add(message)
    db.session.commit()
    
    return jsonify(message.to_dict()), 201

@ai_bp.route('/history', methods=['DELETE'])
@require_auth
def clear_chat_history():
    """Clear all chat history for the current user."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
        
    ChatHistory.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    
    return jsonify({'message': 'Chat history cleared'})


@ai_bp.route('/code-champ', methods=['POST'])
def code_champ_analysis():
    """Perform competitive programming analysis or specialized code generation."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid request body'}), 400
            
        code = data.get('code', '')
        language = data.get('language', '')
        action = data.get('action', 'analyze') 
        
        print(f"[CodeChamp] Action: {action}, Language: {language}")
        
        if not code and action != 'scrape':
            return jsonify({'error': 'Code is required'}), 400
        
        if not language:
            language = detect_language(code)
        
        service = get_ai_service()
        
        # 1. Handle Web Scraper Generation
        if action == 'scrape':
            url = data.get('url', 'https://example.com')
            target_data = data.get('target', 'all headers and paragraphs')
            
            system_prompt = "You are a web scraping expert. Generate concise, production-ready Python code using BeautifulSoup or Playwright."
            prompt = f"Generate a Python web scraper for {url} to extract {target_data}. Return ONLY the code in a JSON object under the 'result' key."
            
            # EXECUTE ASYNC
            result = run_async(service.chat(prompt, model='auto', system_prompt=system_prompt, hide_thinking=True))
            content = result.get('response', '').strip()
            
            return jsonify({
                'action': 'scrape',
                'result': content,
                'provider': result.get('provider', 'AI')
            })

        # 2. Unified CodeChamp Analysis
        # Use the specialized service within MultiAIService
        tone = data.get('tone', 'standard')
        result = run_async(service.code_champ.analyze_code(code, language, tone=tone))
        
        if 'error' in result:
             return jsonify({
                'error': f"AI Analysis Error: {result['error']}",
                'timeComplexity': 'N/A',
                'spaceComplexity': 'N/A',
                'optimalSolution': {'code': code, 'explanation': f"Analysis failed: {result['error']}", 'language': language},
                'provider': result.get('provider', 'System')
            })

        # Map snake_case to camelCase for frontend
        analysis_data = {
            'qualityScore': result.get('quality_score', 0),
            'timeComplexity': result.get('time_complexity', 'O(?)'),
            'spaceComplexity': result.get('space_complexity', 'O(?)'),
            'betterThan': result.get('better_than', '0%'),
            'detectedProblem': result.get('detected_problem', ''),
            'summary': result.get('summary', ''),
            'recommendations': result.get('recommendations', []),
            'bugs': result.get('bugs', []),
            'improvements': result.get('improvements', []),
            'variants': result.get('variants', []),
            'platformLinks': result.get('platform_links', []),
            'optimalSolution': result.get('optimal_solution') or {
                'code': code, 
                'explanation': 'No optimal solution suggested.', 
                'language': language
            },
            'processingTimeMs': result.get('processing_time_ms', 0),
            'provider': result.get('provider', 'DeepSeek'),
            'model': result.get('model', 'auto')
        }
        
        return jsonify(analysis_data)

    except Exception as e:
        print(f"CodeChamp Route Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f"Processing Error: {str(e)}",
            'timeComplexity': 'N/A',
            'spaceComplexity': 'N/A',
            'optimalSolution': {'code': code, 'explanation': f"System Error: {str(e)}", 'language': language},
            'provider': 'System'
        }), 500


@ai_bp.route('/leetcode-testcases', methods=['POST'])
def leetcode_testcases():
    """
    AI-powered: Identify the LeetCode problem from user code and generate test cases.
    Returns: { problem_name, problem_url, test_cases: [{input, expected}] }
    """
    try:
        data = request.json
        code = data.get('code', '')
        language = data.get('language', 'python')

        if not code or len(code.strip()) < 20:
            return jsonify({'error': 'Code too short to identify problem'}), 400

        service = get_ai_service()

        system_prompt = (
            "You are a LeetCode expert. Given the user's code, identify the LeetCode problem "
            "and generate high-accuracy test cases with correct expected outputs.\n\n"
            "CRITICAL RULES:\n"
            "1. IDENTIFY THE PROBLEM: Look at function names, logic patterns, and constraints.\n"
            "2. VERIFY EXPECTED OUTPUTS: Double-check the 'expected' field. It must be 100% correct "
            "based on the problem identified. Hallucinating wrong expected outputs is a failure.\n"
            "3. FORMAT: 'input' must be comma-separated Python expressions for each argument.\n"
            "   - For ListNode parameters: use a plain list like [1,2,3,4] (the harness auto-converts).\n"
            "   - For TreeNode parameters: use a level-order list like [1,2,3,None,None,4,5].\n"
            "   - For arrays/strings/ints: use normal Python literals.\n"
            "   'expected' must be a single Python expression (e.g., True, [0,1], 3, 'abc').\n"
            "4. SCOPE: Generate 3-5 test cases: basic, empty/minimum input, edge cases.\n"
            "5. Return ONLY valid JSON — no markdown, no extra text.\n\n"
            "JSON template:\n"
            "{"
            '  "problem_name": "Two Sum", "problem_url": "https://leetcode.com/problems/two-sum/", '
            '  "test_cases": [{"input": "[2,7,11,15], 9", "expected": "[0,1]"}]'
            "}"
        )

        user_prompt = f"Identify the LeetCode problem and generate test cases for this {language} code:\n\n```{language}\n{code}\n```"

        result = run_async(service.chat(user_prompt, model='auto', system_prompt=system_prompt, hide_thinking=True))

        if 'error' in result:
            return jsonify({'error': result['error']}), 500

        content = result.get('response', '') or result.get('content', '')
        print(f"[LeetCode Testcases] Raw AI response length: {len(content)}")
        print(f"[LeetCode Testcases] Raw AI response (first 500 chars): {content[:500]}")

        # Parse JSON using multiple strategies (same as code_champ)
        import re
        content_clean = re.sub(r'<think>[\s\S]*?</think>', '', content).strip()
        parsed = None

        # Strategy A: Direct parse
        try:
            parsed = json.loads(content_clean)
        except (json.JSONDecodeError, ValueError):
            pass

        # Strategy B: Markdown fence
        if parsed is None:
            fence_match = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', content_clean)
            if fence_match:
                try:
                    parsed = json.loads(fence_match.group(1).strip())
                except (json.JSONDecodeError, ValueError):
                    pass

        # Strategy C: Brace matching
        if parsed is None:
            brace_start = content_clean.find('{')
            if brace_start != -1:
                depth = 0
                brace_end = -1
                for idx in range(brace_start, len(content_clean)):
                    if content_clean[idx] == '{':
                        depth += 1
                    elif content_clean[idx] == '}':
                        depth -= 1
                        if depth == 0:
                            brace_end = idx + 1
                            break
                if brace_end > brace_start:
                    raw = content_clean[brace_start:brace_end]
                    try:
                        parsed = json.loads(raw)
                    except (json.JSONDecodeError, ValueError):
                        raw = raw.replace("'", '"')
                        raw = re.sub(r',\s*([}\]])', r'\1', raw)
                        try:
                            parsed = json.loads(raw)
                        except (json.JSONDecodeError, ValueError):
                            pass

        # Strategy D: Try to find multiple JSON objects (AI sometimes returns them line-by-line)
        if parsed is None:
            json_objects = re.findall(r'\{[^{}]*\}', content_clean)
            if json_objects:
                test_cases_from_objects = []
                for obj_str in json_objects:
                    try:
                        obj = json.loads(obj_str)
                        if 'input' in obj or 'expected' in obj:
                            test_cases_from_objects.append(obj)
                    except (json.JSONDecodeError, ValueError):
                        pass
                if test_cases_from_objects:
                    parsed = {'test_cases': test_cases_from_objects, 'problem_name': 'Detected Problem'}

        # Try to find test_cases in various response formats
        test_cases_found = []
        problem_name = 'Unknown Problem'
        problem_url = ''

        if parsed and isinstance(parsed, dict):
            problem_name = parsed.get('problem_name', parsed.get('problemName', 'Unknown Problem'))
            problem_url = parsed.get('problem_url', parsed.get('problemUrl', ''))

            # Look for test_cases under various key names
            for key in ['test_cases', 'testCases', 'tests', 'examples', 'testcases', 'test_case']:
                if key in parsed and isinstance(parsed[key], list):
                    test_cases_found = parsed[key]
                    break

            # If still not found, look for any list of dicts with input/expected
            if not test_cases_found:
                for val in parsed.values():
                    if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
                        if 'input' in val[0] or 'expected' in val[0] or 'output' in val[0]:
                            test_cases_found = val
                            break

        # Normalize test case format
        normalized = []
        for tc in test_cases_found:
            if isinstance(tc, dict):
                inp = tc.get('input', tc.get('args', tc.get('arguments', '')))
                exp = tc.get('expected', tc.get('output', tc.get('result', tc.get('answer', ''))))
                # Convert non-string values to string
                if not isinstance(inp, str):
                    inp = json.dumps(inp) if inp is not None else ''
                if not isinstance(exp, str):
                    exp = json.dumps(exp) if exp is not None else ''
                if inp or exp:  # Only add if at least one field is present
                    normalized.append({'input': inp, 'expected': exp})

        # If parsing completely failed, try to extract problem name from text and provide empty test cases
        if not normalized:
            print(f"[LeetCode Testcases] WARNING: Could not parse test cases from AI response")
            # Try to extract a problem name from the raw text
            name_match = re.search(r'(?:problem|question|leetcode)\s*(?:is|:)?\s*["\']?([^"\'.\n]+)', content_clean, re.IGNORECASE)
            if name_match:
                problem_name = name_match.group(1).strip()
            
            # Return placeholder test cases that user can fill in
            normalized = [
                {'input': '', 'expected': ''},
                {'input': '', 'expected': ''}
            ]
            return jsonify({
                'problem_name': problem_name,
                'problem_url': problem_url,
                'test_cases': normalized,
                'provider': result.get('provider', 'AI'),
                'warning': 'AI response could not be fully parsed. Please fill in the test cases manually.'
            })

        return jsonify({
            'problem_name': problem_name,
            'problem_url': problem_url,
            'test_cases': normalized,
            'provider': result.get('provider', 'AI')
        })

    except Exception as e:
        print(f"LeetCode testcases error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



# ══════════════════════════════════════════════════════════════════════════════
# ADVANCED AI FEATURES — Categories 1-8
# ══════════════════════════════════════════════════════════════════════════════

def _ai_endpoint(feature_name, system_prompt, user_prompt, extra_fields=None):
    """Helper to reduce boilerplate for AI endpoints."""
    service = get_ai_service()
    result = run_async(service.chat(user_prompt, model='auto', system_prompt=system_prompt, hide_thinking=True))
    response = {
        'response': result.get('response', ''),
        'model': result.get('model', 'unknown'),
        'provider': result.get('provider', 'unknown'),
        'feature': feature_name,
    }
    if extra_fields:
        response.update(extra_fields)
    return jsonify(response)


# ── 1. Code Refactoring & Improvements ────────────────────────────────────

@ai_bp.route('/extract-functions', methods=['POST'])
def extract_functions():
    """Extract reusable functions/classes from code."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    error = data.get('error', '')
    return _ai_endpoint('extract-functions',
        "You are an expert software architect. Analyze the code and extract logical "
        "sections into well-named reusable functions or classes.\n"
        "Rules:\n"
        "1. Return the COMPLETE refactored code with extracted functions in a fenced code block\n"
        "2. Each function should have a single responsibility\n"
        "3. Add proper docstrings and type hints\n"
        "4. After the code, add a '### Extracted Functions' section listing each function with its purpose\n"
        "5. Preserve ALL existing functionality",
        f"Extract functions from this {language} code:\n\n```{language}\n{code}\n```" + (f"\n\nContext (Program Output/Error):\n```\n{error}\n```" if error else "")
    )

@ai_bp.route('/rename-variables', methods=['POST'])
def rename_variables():
    """Intelligently rename variables for clarity."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    error = data.get('error', '')
    return _ai_endpoint('rename-variables',
        "You are an expert code reviewer. Rename variables, functions, and classes "
        "to follow naming conventions and be more descriptive.\n"
        "Rules:\n"
        "1. Return the COMPLETE code with renamed variables in a fenced code block\n"
        "2. Use camelCase for JS/TS, snake_case for Python, PascalCase for classes\n"
        "3. Names should clearly indicate purpose (e.g., 'x' → 'userCount')\n"
        "4. After the code, add a '### Renames' table: old name → new name → reason\n"
        "5. Do NOT change public API names unless they are truly unclear",
        f"Rename variables in this {language} code:\n\n```{language}\n{code}\n```" + (f"\n\nContext (Program Output/Error):\n```\n{error}\n```" if error else "")
    )


# ── 2. Advanced Code Analysis ─────────────────────────────────────────────

@ai_bp.route('/performance', methods=['POST'])
def analyze_performance():
    """Performance profiling suggestions."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    error = data.get('error', '')
    return _ai_endpoint('performance',
        "You are a senior performance engineer. Analyze the code for performance issues.\n"
        "Provide:\n"
        "1. **Time Complexity** — Big-O for each function\n"
        "2. **Memory Usage** — Identify memory-heavy patterns (large copies, leaks)\n"
        "3. **Bottlenecks** — Rank issues by severity (🔴 Critical, 🟡 Warning, 🟢 Info)\n"
        "4. **Optimized Code** — Provide the optimized version in a fenced code block\n"
        "5. **Benchmarks** — Estimate speedup for each optimization\n"
        "Be specific with line numbers.",
        f"Analyze performance of this {language} code:\n\n```{language}\n{code}\n```" + (f"\n\nContext (Program Output/Error):\n```\n{error}\n```" if error else "")
    )

@ai_bp.route('/dead-code', methods=['POST'])
def detect_dead_code():
    """Detect unused/dead code."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    return _ai_endpoint('dead-code',
        "You are a static analysis expert. Find all dead/unused code.\n"
        "Report:\n"
        "1. **Unused Variables** — Variables declared but never read\n"
        "2. **Unreachable Code** — Code after return/break/continue\n"
        "3. **Unused Functions** — Functions never called\n"
        "4. **Unused Imports** — Imported but never used\n"
        "5. **Redundant Code** — Duplicate logic or unnecessary operations\n"
        "For each item, specify the line number and why it's dead.\n"
        "Then provide the cleaned code in a fenced code block.",
        f"Find dead code in this {language} code:\n\n```{language}\n{code}\n```"
    )

@ai_bp.route('/complexity', methods=['POST'])
def analyze_complexity():
    """Cyclomatic complexity analysis."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    return _ai_endpoint('complexity',
        "You are a software metrics expert. Calculate cyclomatic complexity.\n"
        "For each function, provide:\n"
        "1. **Cyclomatic Complexity** (CC) number\n"
        "2. **Risk Level**: Low (1-5), Medium (6-10), High (11-20), Very High (21+)\n"
        "3. **Cognitive Complexity** — how hard it is for a human to understand\n"
        "4. **Suggestions** — how to reduce complexity (extract methods, use polymorphism, etc.)\n\n"
        "Format as a table: | Function | CC | Cognitive | Risk | Suggestion |\n"
        "Then provide simplified code for any High/Very High functions.",
        f"Analyze complexity of this {language} code:\n\n```{language}\n{code}\n```"
    )


# ── 3. Test Generation (Advanced) ─────────────────────────────────────────

@ai_bp.route('/edge-tests', methods=['POST'])
def generate_edge_tests():
    """Generate edge case and boundary tests."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    error = data.get('error', '')
    return _ai_endpoint('edge-tests',
        "You are a QA engineer specialized in edge case testing. Generate tests that cover:\n"
        "1. **Boundary Values** — min, max, zero, empty, null\n"
        "2. **Error Cases** — invalid input, exceptions, timeouts\n"
        "3. **Race Conditions** — concurrent access scenarios\n"
        "4. **Data Types** — type coercion, overflow, precision loss\n"
        "5. **Business Logic** — corner cases specific to the code's purpose\n\n"
        "Use the standard test framework for the language (pytest, jest, JUnit, etc.).\n"
        "Return the complete test file in a fenced code block.\n"
        "After the code, add a '### Edge Cases Covered' checklist.",
        f"Generate edge case tests for this {language} code:\n\n```{language}\n{code}\n```" + (f"\n\nContext (Program Output/Error):\n```\n{error}\n```" if error else "")
    )


# ── 4. Documentation Generation (Advanced) ────────────────────────────────

@ai_bp.route('/generate-readme', methods=['POST'])
def generate_readme():
    """Generate a README.md from code."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    return _ai_endpoint('generate-readme',
        "You are a technical writer. Generate a professional README.md for this project/module.\n"
        "Include:\n"
        "1. **Title & Description** — what the code does\n"
        "2. **Installation** — how to set up\n"
        "3. **Usage** — code examples with output\n"
        "4. **API Reference** — each function/class with params and return types\n"
        "5. **Dependencies** — required libraries\n"
        "6. **License** — MIT placeholder\n\n"
        "Use proper markdown formatting with badges, tables, and code blocks.\n"
        "Make it look professional and production-ready.",
        f"Generate a README.md for this {language} code:\n\n```{language}\n{code}\n```"
    )

@ai_bp.route('/api-docs', methods=['POST'])
def generate_api_docs():
    """Generate API documentation."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    return _ai_endpoint('api-docs',
        "You are an API documentation specialist. Generate comprehensive API docs.\n"
        "For each function/method/endpoint, document:\n"
        "1. **Signature** — full function signature\n"
        "2. **Description** — what it does\n"
        "3. **Parameters** — type, description, default, required/optional\n"
        "4. **Returns** — type and description\n"
        "5. **Raises** — possible exceptions\n"
        "6. **Example** — usage code block\n\n"
        "Format as a structured markdown document with a table of contents.",
        f"Generate API documentation for this {language} code:\n\n```{language}\n{code}\n```"
    )

@ai_bp.route('/inline-comments', methods=['POST'])
def add_inline_comments():
    """Add intelligent inline comments to code."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    return _ai_endpoint('inline-comments',
        "You are a code documentation expert. Add clear inline comments to the code.\n"
        "Rules:\n"
        "1. Return the COMPLETE code with comments in a fenced code block\n"
        "2. Comment WHY, not WHAT (explain reasoning, not obvious operations)\n"
        "3. Add comments before complex logic, algorithms, and non-obvious patterns\n"
        "4. Add docstrings/JSDoc to all functions and classes\n"
        "5. Do NOT over-comment simple assignments or trivial operations\n"
        "6. Use the language's standard comment style",
        f"Add inline comments to this {language} code:\n\n```{language}\n{code}\n```"
    )


# ── 5. Code Search & Navigation ───────────────────────────────────────────

@ai_bp.route('/semantic-search', methods=['POST'])
def semantic_search():
    """Semantic code search — find patterns described in natural language."""
    data = request.get_json()
    code = data.get('code', '')
    search_query = data.get('query', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code or not search_query: return jsonify({'error': 'Code and search query are required'}), 400

    return _ai_endpoint('semantic-search',
        "You are a code search engine. Find code that matches the natural language query.\n"
        "Rules:\n"
        "1. Find ALL code sections that match the user's description\n"
        "2. For each match, show: line number range, the code, and why it matches\n"
        "3. Rate each match's relevance: ✅ Exact Match, 🟡 Partial Match, 🔵 Related\n"
        "4. If no matches found, suggest similar patterns that exist in the code\n"
        "5. Also identify any dependencies or call chains related to the matches",
        f"Search query: \"{search_query}\"\n\nSearch in this {language} code:\n\n```{language}\n{code}\n```"
    )

@ai_bp.route('/dependency-analysis', methods=['POST'])
def analyze_dependencies():
    """Analyze code dependencies and call graph."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    return _ai_endpoint('dependency-analysis',
        "You are a software architect. Analyze the code's dependency structure.\n"
        "Provide:\n"
        "1. **Import/Dependency Map** — what external libraries are used and why\n"
        "2. **Call Graph** — as a Mermaid diagram showing which functions call which\n"
        "3. **Coupling Analysis** — identify tightly coupled components\n"
        "4. **Circular Dependencies** — detect any circular references\n"
        "5. **Suggestions** — how to reduce coupling and improve modularity\n\n"
        "Include a Mermaid flowchart diagram of the call graph.",
        f"Analyze dependencies in this {language} code:\n\n```{language}\n{code}\n```"
    )


# ── 6. AI-Powered Debugging ───────────────────────────────────────────────

@ai_bp.route('/stack-trace', methods=['POST'])
def analyze_stack_trace():
    """Analyze a stack trace and explain the error."""
    data = request.get_json()
    code = data.get('code', '')
    error_trace = data.get('error', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not error_trace: return jsonify({'error': 'Stack trace is required'}), 400

    return _ai_endpoint('stack-trace',
        "You are a debugging expert. Analyze the stack trace and explain:\n"
        "1. **Root Cause** — the actual error in plain English\n"
        "2. **Error Location** — which line and function caused it\n"
        "3. **Call Chain** — how execution reached the error point\n"
        "4. **Fix** — the exact code change needed (show before/after)\n"
        "5. **Prevention** — how to prevent this class of error in the future\n\n"
        "If code is provided, show the fixed version in a fenced code block.",
        f"Stack trace:\n```\n{error_trace}\n```\n\n"
        + (f"Code:\n```{language}\n{code}\n```" if code else "No source code provided.")
    )

@ai_bp.route('/bug-predict', methods=['POST'])
def predict_bugs():
    """Predict potential bugs before they happen."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    return _ai_endpoint('bug-predict',
        "You are a bug prediction AI. Analyze the code and predict potential bugs.\n"
        "For each potential bug:\n"
        "1. **Severity** — 🔴 Critical, 🟡 Warning, 🟢 Info\n"
        "2. **Location** — line number and code snippet\n"
        "3. **Type** — null reference, off-by-one, race condition, memory leak, etc.\n"
        "4. **Scenario** — when and how this bug would trigger\n"
        "5. **Fix** — the corrected code\n\n"
        "Focus on subtle bugs that static analysis might miss:\n"
        "- Edge cases in conditionals\n"
        "- Async/concurrency issues\n"
        "- Resource leaks\n"
        "- Integer overflow/underflow\n"
        "- Injection vulnerabilities",
        f"Predict bugs in this {language} code:\n\n```{language}\n{code}\n```"
    )


# ── 7. Code Completion & Snippets ─────────────────────────────────────────

@ai_bp.route('/design-patterns', methods=['POST'])
def suggest_design_patterns():
    """Suggest and apply design patterns."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    return _ai_endpoint('design-patterns',
        "You are a software design expert. Analyze the code and suggest applicable design patterns.\n"
        "For each suggestion:\n"
        "1. **Pattern Name** — e.g., Strategy, Observer, Factory, Singleton, etc.\n"
        "2. **Where** — which part of the code would benefit\n"
        "3. **Why** — the problem it solves (code smell it addresses)\n"
        "4. **Before/After** — show the code transformation\n"
        "5. **Trade-offs** — pros and cons of applying this pattern\n\n"
        "Provide the complete refactored code applying the most impactful pattern in a fenced code block.",
        f"Suggest design patterns for this {language} code:\n\n```{language}\n{code}\n```"
    )

@ai_bp.route('/boilerplate', methods=['POST'])
def generate_boilerplate():
    """Generate boilerplate code from a description."""
    data = request.get_json()
    description = data.get('description', '')
    language = data.get('language', 'python')
    if not description: return jsonify({'error': 'Description is required'}), 400

    return _ai_endpoint('boilerplate',
        "You are a code generation expert. Generate production-ready boilerplate code.\n"
        "Rules:\n"
        "1. Return the COMPLETE code in a fenced code block\n"
        "2. Include proper error handling, logging, and configuration\n"
        "3. Add docstrings and type hints\n"
        "4. Follow the language's standard project structure\n"
        "5. Include a '### Setup' section with installation instructions\n"
        "6. Make it ready to run — no placeholders or TODOs",
        f"Generate {language} boilerplate for: {description}"
    )


# ── 8. Multi-File Operations ──────────────────────────────────────────────

@ai_bp.route('/migration', methods=['POST'])
def generate_migration():
    """Generate migration helpers for framework/version upgrades."""
    data = request.get_json()
    code = data.get('code', '')
    from_version = data.get('fromVersion', '')
    to_version = data.get('toVersion', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    return _ai_endpoint('migration',
        "You are a migration specialist. Help upgrade code between framework versions.\n"
        "Provide:\n"
        "1. **Breaking Changes** — list all breaking changes that affect this code\n"
        "2. **Deprecated APIs** — APIs used that are deprecated in the new version\n"
        "3. **Migration Steps** — ordered checklist of changes to make\n"
        "4. **Migrated Code** — the complete updated code in a fenced code block\n"
        "5. **Testing Notes** — what to test after migration\n\n"
        "If versions are not specified, identify the current framework and suggest the latest.",
        f"Migrate this {language} code"
        + (f" from {from_version} to {to_version}" if from_version and to_version else "")
        + f":\n\n```{language}\n{code}\n```"
    )
