import os
import re
from flask import Blueprint, jsonify, request
from services.multi_ai import MultiAIService
from routes.auth import get_current_user
from utils.async_utils import run_async
import asyncio

ai_bp = Blueprint('ai', __name__)

def get_ai_service():
    """Get AI service configured with a merge of user's API keys and env vars."""
    user = get_current_user()
    
    # 1. Start with environment variables as the base
    raw_deepseek = os.getenv('DEEPSEEK_API_KEY')
    env_keys = {
        'gemini': os.getenv('GEMINI_API_KEY'),
        'claude': os.getenv('CLAUDE_API_KEY'),
        'deepseek': raw_deepseek,
        'qwen': os.getenv('QWEN_API_KEY'),
        'huggingface': os.getenv('HF_TOKEN')
    }
    # Filter out placeholders
    env_keys = {k: v for k, v in env_keys.items() if v and not v.startswith('your-')}
    
    # 2. Add user's stored API keys (they take precedence if they exist)
    user_keys = {}
    if user:
        user_keys = {
            'gemini': user.gemini_api_key,
            'claude': user.claude_api_key,
            'deepseek': user.deepseek_api_key,
            'qwen': user.qwen_api_key,
            'huggingface': getattr(user, 'hf_token', None) if hasattr(user, 'hf_token') else None
        }
        # CRITICAL: Only include keys that the user HAS actually set to avoid overwriting env vars with None
        # Also filter out placeholders
        user_keys = {k: v for k, v in user_keys.items() if v and not str(v).startswith('your-')}
    
    # 3. Merge: User keys overwrite Env keys ONLY if user keys are present
    final_keys = {**env_keys, **user_keys}
    
    # print(f">>> MultiAIService init - Combined Keys available: {list(final_keys.keys())}")
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
            "You are an elite full-stack developer and world-class technical mentor. "
            "Your goal is to help the user design, implement, debug, and optimize high-quality code. "
            "When helping with code, always: "
            "1. Think step-by-step and explain the rationale behind your logic. "
            "2. Ensure all generated code is clean, efficient, secure, and follows industry best practices. "
            "3. Use modern language features and robust error handling. "
            "4. Provide specific, technical, and actionable advice. "
            "Always use markdown for code snippets with appropriate language tags.\n\n"
            "CITATION REQUIREMENT: At the end of your response, always include a section named 'Sources:' "
            "where you list 2-3 relevant documentation links (MDN, Python Docs, etc.) or library references. "
            "Use markdown links.\n\n"
            "IMPORTANT: Always provide a clear, concise, and helpful final answer. "
            "Ensure that you provide the direct answer outside of any thinking or reasoning tags."
        )
        
        messages = []
        if code:
            system_prompt += f"\n\nContext Code ({language}):\n```{language}\n{code}\n```"
            system_prompt += "\n\nRefer to the code above when answering the user's questions."
    
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
