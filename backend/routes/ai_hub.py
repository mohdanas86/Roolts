"""
Multi-AI Chat Routes
Provides endpoints for the AI Hub with smart model routing
"""

import os
from flask import Blueprint, jsonify, request

from routes.auth import get_current_user, require_auth
from models import User
from services.multi_ai import MultiAIService, AISelector

ai_hub_bp = Blueprint('ai_hub', __name__)


def get_user_ai_service(api_key=None, provider=None):
    """Get AI service configured with a merge of user's API keys and env vars."""
    user = get_current_user()
    
    # 1. Base from Environment
    raw_deepseek = os.getenv('DEEPSEEK_API_KEY')
    env_keys = {
        'gemini': os.getenv('GEMINI_API_KEY'),
        'claude': os.getenv('CLAUDE_API_KEY'),
        'deepseek': raw_deepseek,
        'qwen': os.getenv('QWEN_API_KEY'),
        'huggingface': os.getenv('HF_TOKEN')
    }
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
        # CRITICAL: Only include keys that the user HAS actually set
        user_keys = {k: v for k, v in user_keys.items() if v and not str(v).startswith('your-')}
    
    # 3. Add API key from request if it's not a placeholder
    request_keys = {}
    if api_key and provider and not str(api_key).startswith('your-'):
        request_keys = {provider: api_key}
        
    # 4. Merge: Request keys > User keys > Env keys
    final_keys = {**env_keys, **user_keys, **request_keys}
    return MultiAIService(final_keys)


@ai_hub_bp.route('/models', methods=['GET'])
def list_models():
    """List available AI models."""
    service = get_user_ai_service()
    available = service.get_available_models()
    
    models_info = {
        'gemini': {
            'name': 'Google Gemini',
            'icon': '💎',
            'description': 'Best for multimodal content, research, and factual queries',
            'strengths': ['Research', 'Facts', 'Multimodal'],
            'available': 'gemini' in available
        },
        'claude': {
            'name': 'Anthropic Claude',
            'icon': '🎭',
            'description': 'Best for nuanced writing, analysis, and long-form content',
            'strengths': ['Writing', 'Analysis', 'Creativity'],
            'available': 'claude' in available
        },
        'deepseek': {
            'name': 'DeepSeek',
            'icon': '🔍',
            'description': 'Best for coding, debugging, and technical explanations',
            'strengths': ['Code', 'Debugging', 'Algorithms'],
            'available': 'deepseek' in available
        },
        'qwen': {
            'name': 'Alibaba Qwen',
            'icon': '🌐',
            'description': 'Best for multilingual content and Asian languages',
            'strengths': ['Multilingual', 'Chinese', 'Translation'],
            'available': 'qwen' in available
        },
        'huggingface': {
            'name': 'DeepSeek-R1 (Qwen-7B)',
            'icon': '🧠',
            'description': 'Advanced reasoning model for complex algorithms and logic',
            'strengths': ['Reasoning', 'Complex Logic', 'Deep Analysis'],
            'available': 'huggingface' in available
        }
    }
    
    return jsonify({
        'models': models_info,
        'available': available,
        'has_any': len(available) > 0
    })


@ai_hub_bp.route('/chat', methods=['POST'])
def chat():
    """
    Send a message to an AI model.
    """
    import asyncio
    from utils.async_utils import run_async

    data = request.get_json()
    prompt = data.get('prompt', '').strip()
    model = data.get('model', 'auto')
    system_prompt = data.get('system_prompt')
    
    if not prompt:
        return jsonify({'error': 'Prompt is required'}), 400
    
    service = get_user_ai_service(api_key, provider)
    
    # EXECUTE ASYNC
    try:
        result = run_async(service.chat(prompt, model, system_prompt))
    except Exception as e:
        print(f"AI Hub Chat Error: {e}")
        return jsonify({'error': str(e)}), 500
    
    if 'error' in result:
        return jsonify(result), 400
    
    return jsonify(result)


@ai_hub_bp.route('/suggest', methods=['POST'])
def suggest():
    """
    Get AI suggestions while typing.
    """
    import asyncio
    from utils.async_utils import run_async

    data = request.get_json()
    text = data.get('text', '').strip()
    
    if len(text) < 10:
        return jsonify({'suggestions': []})
    
    service = get_user_ai_service()
    
    # EXECUTE ASYNC
    try:
        result = run_async(service.suggest(text))
    except Exception as e:
        print(f"AI Suggest Error: {e}")
        return jsonify({'suggestions': []}) # Fail silently for suggestions
    
    return jsonify(result)


@ai_hub_bp.route('/analyze-prompt', methods=['POST'])
def analyze_prompt():
    """
    Analyze a prompt to explain which AI would be best.
    """
    data = request.get_json()
    prompt = data.get('prompt', '').strip()
    
    if not prompt:
        return jsonify({'error': 'Prompt is required'}), 400
    
    service = get_user_ai_service()
    # get_available_models is sync (it just checks keys/config), but let's double check implementation
    # defined in MultiAIService, straightforward sync method.
    available = service.get_available_models()
    
    selector = AISelector(available)
    analysis = selector.explain_selection(prompt)
    
    # Add human-readable explanations
    reasons = {
        'deepseek': 'This prompt contains coding-related content. DeepSeek excels at programming tasks.',
        'claude': 'This prompt is suited for writing or detailed analysis. Claude is great for nuanced responses.',
        'gemini': 'This prompt is a research or factual query. Gemini is optimized for information retrieval.',
        'qwen': 'This prompt contains multilingual content. Qwen excels at non-English languages.'
    }
    
    analysis['detailed_reason'] = reasons.get(
        analysis['selected_model'],
        'Selected based on overall compatibility.'
    )
    
    return jsonify(analysis)


@ai_hub_bp.route('/stream', methods=['POST'])
def stream_chat():
    """
    Stream a chat response.
    """
    # For now, return the same as regular chat
    # To properly implement stream, we'd need a different approach with Response(generator())
    # But current implementation was just 'await chat()', so we keep it simple.
    return chat()
