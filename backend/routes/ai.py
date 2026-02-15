import os
import re
from flask import Blueprint, jsonify, request
from services.multi_ai import MultiAIService
from services.vault import vault
from routes.auth import get_current_user
from utils.async_utils import run_async
import asyncio

ai_bp = Blueprint('ai', __name__)


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
            'gemini': user.gemini_api_key,
            'claude': user.claude_api_key,
            'deepseek': user.deepseek_api_key,
            'qwen': user.qwen_api_key,
            'huggingface': getattr(user, 'hf_token', None) if hasattr(user, 'hf_token') else None
        }
        user_keys = {k: v for k, v in user_keys.items() if v and not str(v).startswith('your-')}
    
    # 4. Merge: vault → env → user (later sources override earlier)
    final_keys = {**vault_keys, **env_keys, **user_keys}
    
    return MultiAIService(final_keys)

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
    """Generate an AI-powered explanation of code."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', '')
    
    if not code:
        return jsonify({'error': 'Code is required'}), 400
    
    # Detect language if not provided
    if not language:
        language = detect_language(code)
    
    service = get_ai_service()
    
    # Use the specialized explainer service
    try:
        # EXECUTE ASYNC
        result = run_async(service.explainer.explain_code(code, language))
        
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
    result = run_async(service.chat(prompt, model='deepseek', system_prompt=system_prompt, hide_thinking=True))
    
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
    """Suggest learning resources based on code."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', '')
    
    if not language:
        language = detect_language(code)
    
    resources = generate_mock_resources(language)
    
    return jsonify({
        'resources': resources,
        'language': language
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
                model='deepseek',
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


@ai_bp.route('/refactor', methods=['POST'])
def refactor_code():
    """AI-powered code refactoring — rewrites code following best practices."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext')

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
    prompt = f"Refactor this {language} code:\n\n```{language}\n{code}\n```"

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
    prompt = f"Generate unit tests for this {language} code:\n\n```{language}\n{code}\n```"

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
        
        # BYOK Support
        api_key = data.get('apiKey')
        provider = data.get('provider') # 'gemini', 'deepseek', 'openai' (mapped to claude/deepseek in backend for now or we add openai)

        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        if not language and code:
            language = detect_language(code)
        
        if api_key and provider and not str(api_key).startswith('your-'):
            # Use the user's provided key if it's not a placeholder
            service = get_custom_ai_service(api_key, provider)
            target_model = provider
        else:
            service = get_ai_service()
            target_model = 'auto'
        
        system_prompt = (
            "You are Roolts AI — an elite full-stack developer, systems architect, and world-class coding mentor.\n\n"
            "## Core Directives\n"
            "1. **Code Quality**: All code you write MUST be production-ready, clean, efficient, well-commented, and secure. "
            "Use modern language features (Python 3.10+, ES2022+, Java 17+). Never use deprecated APIs.\n"
            "2. **Step-by-Step Reasoning**: Think through problems methodically. For debugging, identify the root cause before suggesting fixes.\n"
            "3. **Complete Solutions**: When asked to write or fix code, provide the FULL working code — never leave placeholders like '// rest of code here'.\n"
            "4. **Error Handling**: Always include robust error handling (try/except, try/catch, null checks, input validation).\n"
            "5. **Best Practices**: Follow SOLID principles, DRY, clean architecture patterns. Suggest design patterns when appropriate.\n"
            "6. **Performance Awareness**: Mention time/space complexity for algorithms. Suggest optimizations proactively.\n"
            "7. **Security First**: Flag XSS, SQL injection, CSRF, hardcoded secrets, and other vulnerabilities immediately.\n\n"
            "## Response Format\n"
            "- Use markdown with proper language-tagged code blocks (```python, ```javascript, etc.)\n"
            "- For multi-file changes, clearly label each file\n"
            "- Use bullet points for lists of suggestions\n"
            "- Bold key terms and important warnings\n\n"
            "## What NOT to Do\n"
            "- Do NOT wrap your answer inside <think> or reasoning tags\n"
            "- Do NOT provide vague or generic advice — be specific and actionable\n"
            "- Do NOT apologize excessively. Be direct and helpful.\n\n"
            "At the end of your response, include a '**Sources:**' section with 1-3 relevant documentation links."
        )
        
        messages = []
        if code:
            system_prompt += f"\n\n## User's Active Code ({language}):\n```{language}\n{code}\n```"
            system_prompt += "\nRefer to this code context when answering. If the user asks to modify it, provide the complete updated version."
    
        if history:
             for msg in history:
                 role = msg.get('role', 'user')
                 messages.append({'role': role, 'content': msg.get('content', '')})
        
        messages.append({'role': 'user', 'content': query})
        
        # EXECUTE ASYNC
        result = run_async(service.chat(
            prompt=query, 
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
    
    return jsonify({
        'response': result.get('response', ''),
        'model': result.get('model', 'unknown'),
        'provider': result.get('provider', 'unknown')
    })


@ai_bp.route('/code-champ', methods=['POST'])
def code_champ_analysis():
    """Perform competitive programming analysis or specialized code generation."""
    try:
        data = request.get_json()
        code = data.get('code', '')
        language = data.get('language', '')
        action = data.get('action', 'analyze') 
        
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
            result = run_async(service.chat(prompt, model='deepseek', system_prompt=system_prompt, hide_thinking=True))
            content = result.get('response', '').strip()
            
            return jsonify({
                'action': 'scrape',
                'result': content,
                'provider': result.get('provider', 'AI')
            })

        # 2. Unified CodeChamp Analysis
        # Use the specialized service within MultiAIService
        result = run_async(service.code_champ.analyze_code(code, language))
        
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
            'summary': result.get('summary', ''),
            'recommendations': result.get('recommendations', []),
            'bugs': result.get('bugs', []),
            'improvements': result.get('improvements', []),
            'variants': result.get('variants', []),
            'optimalSolution': result.get('optimal_solution') or {
                'code': code, 
                'explanation': 'No optimal solution suggested.', 
                'language': language
            },
            'processingTimeMs': result.get('processing_time_ms', 0),
            'provider': result.get('provider', 'DeepSeek')
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
        })


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

    return _ai_endpoint('extract-functions',
        "You are an expert software architect. Analyze the code and extract logical "
        "sections into well-named reusable functions or classes.\n"
        "Rules:\n"
        "1. Return the COMPLETE refactored code with extracted functions in a fenced code block\n"
        "2. Each function should have a single responsibility\n"
        "3. Add proper docstrings and type hints\n"
        "4. After the code, add a '### Extracted Functions' section listing each function with its purpose\n"
        "5. Preserve ALL existing functionality",
        f"Extract functions from this {language} code:\n\n```{language}\n{code}\n```"
    )

@ai_bp.route('/rename-variables', methods=['POST'])
def rename_variables():
    """Intelligently rename variables for clarity."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    return _ai_endpoint('rename-variables',
        "You are an expert code reviewer. Rename variables, functions, and classes "
        "to follow naming conventions and be more descriptive.\n"
        "Rules:\n"
        "1. Return the COMPLETE code with renamed variables in a fenced code block\n"
        "2. Use camelCase for JS/TS, snake_case for Python, PascalCase for classes\n"
        "3. Names should clearly indicate purpose (e.g., 'x' → 'userCount')\n"
        "4. After the code, add a '### Renames' table: old name → new name → reason\n"
        "5. Do NOT change public API names unless they are truly unclear",
        f"Rename variables in this {language} code:\n\n```{language}\n{code}\n```"
    )


# ── 2. Advanced Code Analysis ─────────────────────────────────────────────

@ai_bp.route('/performance', methods=['POST'])
def analyze_performance():
    """Performance profiling suggestions."""
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'plaintext') or detect_language(code)
    if not code: return jsonify({'error': 'Code is required'}), 400

    return _ai_endpoint('performance',
        "You are a senior performance engineer. Analyze the code for performance issues.\n"
        "Provide:\n"
        "1. **Time Complexity** — Big-O for each function\n"
        "2. **Memory Usage** — Identify memory-heavy patterns (large copies, leaks)\n"
        "3. **Bottlenecks** — Rank issues by severity (🔴 Critical, 🟡 Warning, 🟢 Info)\n"
        "4. **Optimized Code** — Provide the optimized version in a fenced code block\n"
        "5. **Benchmarks** — Estimate speedup for each optimization\n"
        "Be specific with line numbers.",
        f"Analyze performance of this {language} code:\n\n```{language}\n{code}\n```"
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
        f"Generate edge case tests for this {language} code:\n\n```{language}\n{code}\n```"
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
