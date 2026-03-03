"""
Multi-AI Service with Smart Router
Integrates Gemini, Claude, DeepSeek, and Qwen with intelligent model selection
"""

import os
import re
import json
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import asyncio
import requests
import base64
# from huggingface_hub import InferenceClient

from services.async_deepseek_provider import AsyncDeepSeekProvider
from services.ai_explainer import AIExplainerService
from services.code_champ import CodeChampService
from services.cache_service import response_cache


class AIProvider(ABC):
    """Abstract base class for AI providers."""
    
    @abstractmethod
    def generate(self, prompt: str, system_prompt: str = None, messages: list = None) -> Dict[str, Any]:
        """
        Generate a response from the AI model.
        
        Args:
            prompt: Single text prompt (legacy/simple mode)
            system_prompt: Optional system instructions
            messages: List of conversation messages [{'role': 'user', 'content': '...'}, ...]
                     If provided, this takes precedence over 'prompt' for chat history.
        """
        pass
    
    @abstractmethod
    def is_configured(self) -> bool:
        """Check if the provider is properly configured."""
        pass


class GeminiProvider(AIProvider):
    """Google Gemini AI Provider."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY', '')
        self.base_url = 'https://generativelanguage.googleapis.com/v1'
        self.model = 'gemini-2.0-flash'
    
    def is_configured(self) -> bool:
        """Check if API key is configured and valid."""
        if not self.api_key:
            return False
        if self.api_key.startswith('your-'):
            return False
        return len(self.api_key) > 5
    
    def generate(self, prompt: str, system_prompt: str = None, messages: list = None) -> Dict[str, Any]:
        if not self.is_configured():
            return {'error': 'Gemini API key not configured'}
        
        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
        
        contents = []
        
        # System prompt handling
        if system_prompt:
             # Gemini 1.5/2.0 supports system instructions via separate field, 
             # but for compatibility with older endpoints or simple structure we can prepend or use specific fields.
             # Ideally validation of model version is needed.
             # For 'generateContent', system instructions are passed differently or prepended.
             # Let's try prepending for broad compatibility or check API spec.
             # Actually Gemini Pro (1.0) didn't support system instructions easily, Flash 1.5+ does.
             # We'll use the 'system_instruction' field if creating a new formatted request, 
             # but to keep it simple and robust with the existing requests approach:
             pass 

        # Build contents from messages or prompt
        if messages:
            for msg in messages:
                role = 'user' if msg['role'] == 'user' else 'model'
                # Map 'system' role if present in messages to system instruction or prepend
                if msg['role'] == 'system':
                    continue # specific handling below
                contents.append({
                    'role': role,
                    'parts': [{'text': msg['content']}]
                })
        else:
             # Legacy single prompt
             contents.append({
                 'role': 'user',
                 'parts': [{'text': prompt}]
             })
             
        payload = {'contents': contents, 'generationConfig': {'maxOutputTokens': 2048}}
        
        # Add system instruction if supported/provided
        # Inject standard system prompt for better code if not present
        effective_system_prompt = system_prompt
        if not effective_system_prompt:
             effective_system_prompt = (
                 "You are an expert Senior Software Engineer. "
                 "When provided with code or coding questions, verify your logic step-by-step before answering. "
                 "Ensure all code is production-ready, clean, and follows best practices. "
                 "If the user asks a simple question, be concise. "
                 "If the user asks for code, provide full, working implementations."
             )

        if effective_system_prompt:
            payload['systemInstruction'] = {
                'parts': [{'text': effective_system_prompt}]
            }
        # Also check for system message in messages list
        elif messages and len(messages) > 0 and messages[0]['role'] == 'system':
             payload['systemInstruction'] = {
                'parts': [{'text': messages[0]['content']}]
            }
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            data = response.json()
            
            if 'candidates' in data and data['candidates']:
                text = data['candidates'][0]['content']['parts'][0]['text']
                return {
                    'response': text,
                    'model': 'gemini',
                    'provider': 'Google Gemini'
                }
            
            error_msg = data.get('error', {}).get('message', 'Unknown error')
            status_code = response.status_code
            print(f">>> Gemini API Error ({status_code}): {error_msg}")
            print(f">>> Gemini API Full Response: {data}")
            return {'error': f'Gemini {status_code}: {error_msg}'}
        except Exception as e:
            return {'error': str(e)}


class ClaudeProvider(AIProvider):
    """Anthropic Claude AI Provider."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('CLAUDE_API_KEY', '')
        self.base_url = 'https://api.anthropic.com/v1'
        self.model = 'claude-3-haiku-20240307'
    
    def is_configured(self) -> bool:
        """Check if API key is configured and valid."""
        if not self.api_key:
            return False
        if self.api_key.startswith('your-'):
            return False
        return len(self.api_key) > 5
    
    def generate(self, prompt: str, system_prompt: str = None, messages: list = None) -> Dict[str, Any]:
        if not self.is_configured():
            return {'error': 'Claude API key not configured'}
        
        headers = {
            'x-api-key': self.api_key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        }
        
        api_messages = []
        if messages:
            for msg in messages:
                if msg['role'] == 'system':
                     if not system_prompt: system_prompt = msg['content']
                     continue
                api_messages.append({'role': msg['role'], 'content': msg['content']})
        else:
            api_messages.append({'role': 'user', 'content': prompt})

        data = {
            'model': self.model,
            'max_tokens': 2048,
            'messages': api_messages
        }
        
        if system_prompt:
            data['system'] = system_prompt
        
        try:
            response = requests.post(
                f"{self.base_url}/messages",
                headers=headers,
                json=data,
                timeout=10
            )
            result = response.json()
            
            if 'content' in result and result['content']:
                text = result['content'][0]['text']
                return {
                    'response': text,
                    'model': 'claude',
                    'provider': 'Anthropic Claude'
                }
            
            return {'error': result.get('error', {}).get('message', 'Unknown error')}
        except Exception as e:
            return {'error': str(e)}



class OpenAIProvider(AIProvider):
    """OpenAI AI Provider."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('OPENAI_API_KEY', '')
        self.base_url = 'https://api.openai.com/v1/chat/completions'
        self.model = 'gpt-4o-mini'
    
    def is_configured(self) -> bool:
        """Check if API key is configured and valid."""
        if not self.api_key:
            return False
        if self.api_key.startswith('your-'):
            return False
        return len(self.api_key) > 5
    
    def generate(self, prompt: str, system_prompt: str = None, messages: list = None) -> Dict[str, Any]:
        if not self.is_configured():
            return {'error': 'OpenAI API key not configured'}
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        api_messages = []
        if system_prompt:
            api_messages.append({'role': 'system', 'content': system_prompt})
            
        if messages:
            for msg in messages:
                if msg['role'] == 'system' and system_prompt: continue
                api_messages.append({'role': msg['role'], 'content': msg['content']})
        else:
            api_messages.append({'role': 'user', 'content': prompt})

        data = {
            'model': self.model,
            'messages': api_messages
        }
        
        try:
            response = requests.post(
                self.base_url,
                headers=headers,
                json=data,
                timeout=15
            )
            result = response.json()
            
            if 'choices' in result and result['choices']:
                text = result['choices'][0]['message']['content']
                return {
                    'response': text,
                    'model': 'openai',
                    'provider': 'OpenAI'
                }
            
            error_msg = result.get('error', {}).get('message', 'Unknown error')
            status_code = response.status_code
            return {'error': f'OpenAI {status_code}: {error_msg}'}
        except Exception as e:
            return {'error': str(e)}


class QwenProvider(AIProvider):
    """Alibaba Qwen AI Provider - Excellent multilingual support."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('QWEN_API_KEY', '')
        self.base_url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
        self.model = 'qwen-turbo'
    
    def is_configured(self) -> bool:
        """Check if API key is configured and valid."""
        if not self.api_key:
            return False
        if self.api_key.startswith('your-'):
            return False
        return len(self.api_key) > 5
    
    def generate(self, prompt: str, system_prompt: str = None, messages: list = None) -> Dict[str, Any]:
        if not self.is_configured():
            return {'error': 'Qwen API key not configured'}
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        api_messages = []
        if system_prompt:
            api_messages.append({'role': 'system', 'content': system_prompt})
            
        if messages:
            for msg in messages:
                if msg['role'] == 'system' and system_prompt: continue
                api_messages.append(msg)
        else:
            api_messages.append({'role': 'user', 'content': prompt})
        
        data = {
            'model': self.model,
            'input': {
                'messages': api_messages
            }
        }
        
        try:
            response = requests.post(
                self.base_url,
                headers=headers,
                json=data,
                timeout=10
            )
            result = response.json()
            
            if 'output' in result:
                text = result['output'].get('text', '')
                return {
                    'response': text,
                    'model': 'qwen',
                    'provider': 'Alibaba Qwen'
                }
            
            return {'error': result.get('message', 'Unknown error')}
        except Exception as e:
            return {'error': str(e)}


class HuggingFaceProvider(AIProvider):
    """Hugging Face Inference AI Provider (DeepSeek-R1-Distill-Llama-8B)."""
    
    def __init__(self, api_key: str = None):
        # Token Locker Logic (Obfuscated hardcoded fallback)
        LO_KEY = 'Um9vTHRzX1NlY3VyRV9WYXVsdF9LZVlfMjAyNl8hQCM='
        LO_TOK = 'gAAAAABpktIec2F1oMtuZc7Pc9kKj8EPwJZi7P8GAKcPUGaaYTVAEOWReP3jt8qVxvAb5oE_jWkSb54FHlg7hE6EGhee34MzESkSbzteAfV6EHlo4egb61R4uze4KSN-3VYP'
        
        fallback_token = ''
        try:
            from cryptography.fernet import Fernet
            f = Fernet(LO_KEY.encode())
            fallback_token = f.decrypt(LO_TOK.encode()).decode()
        except:
            pass # Fallback to empty if decryption fails

        # Prioritize passed key, then ENV, then hardcoded default from user
        raw_key = api_key or os.getenv('HF_TOKEN', fallback_token)
        self.api_key = raw_key.strip() if raw_key else ''
        self.model = os.getenv('HF_MODEL_ID', 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B')
        self.client = None
        if self.api_key:
            try:
                # Use the latest HF Router for better model support
                from huggingface_hub import InferenceClient
                self.client = InferenceClient(
                    token=self.api_key
                )
            except Exception as e:
                print(f"HF Client Init Error: {e}")
    
    def is_configured(self) -> bool:
        """Check if API key is configured and valid (not a placeholder)."""
        if not self.api_key:
            return False
        if self.api_key.startswith('your-'):
            return False
        return len(self.api_key) > 5
    
    def _format_hf_prompt(self, prompt: str, system_prompt: str = None, messages: list = None) -> str:
        """Format messages using the ChatML/DeepSeek template."""
        formatted = ""
        if system_prompt:
            formatted += f"<|im_start|>system\n{system_prompt}<|im_end|>\n"
            
        if messages:
            for msg in messages:
                role = msg['role']
                content = msg['content']
                # Skip system if already added
                if role == 'system' and system_prompt: continue
                formatted += f"<|im_start|>{role}\n{content}<|im_end|>\n"
        else:
            formatted += f"<|im_start|>user\n{prompt}<|im_end|>\n"
            
        formatted += "<|im_start|>assistant\n"
        return formatted

    def generate(self, prompt: str, system_prompt: str = None, messages: list = None) -> Dict[str, Any]:
        if not self.is_configured():
            return {'error': 'Hugging Face (HF_TOKEN) not configured'}
        
        try:
            # Use the verified OpenAI-compatible Chat Completions endpoint on the HF Router
            url = "https://router.huggingface.co/v1/chat/completions"
            
            # Detect if user wants speed or brevity
            is_fast_request = any(kw in prompt.lower() for kw in ['fast', 'short', 'quick', 'brief', 'simple', 'summary'])
            preferred_model = "deepseek-ai/DeepSeek-R1-Distill-Llama-8B" if is_fast_request else self.model
            
            # OpenAI-style message format
            hf_messages = []
            if system_prompt:
                hf_messages.append({"role": "system", "content": system_prompt})
            
            if messages:
                for msg in messages:
                    if msg['role'] == 'system' and system_prompt: continue
                    hf_messages.append({"role": msg['role'], "content": msg['content']})
            else:
                hf_messages.append({"role": "user", "content": prompt})

            # Try preferred model, then secondary, then safe fallback
            models_to_try = [preferred_model]
            if preferred_model != self.model:
                models_to_try.append(self.model)
            if "meta-llama/Llama-3.1-8B-Instruct" not in models_to_try:
                models_to_try.append("meta-llama/Llama-3.1-8B-Instruct")
                
            last_error = ""
            
            for target_model in models_to_try:
                payload = {
                    "model": target_model,
                    "messages": hf_messages,
                    "max_tokens": 1024,
                    "temperature": 0.1,
                    "top_p": 0.95,
                    "stream": False
                }
                
                response = requests.post(
                    url,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # OpenAI-compatible response parsing
                    response_text = ""
                    if isinstance(result, dict) and 'choices' in result:
                        if len(result['choices']) > 0:
                            message = result['choices'][0].get('message', {})
                            response_text = message.get('content', '')
                            
                            # Check for reasoning (DeepSeek-R1 often provides this)
                            reasoning = message.get('reasoning_content')
                            if reasoning:
                                return {
                                    'response': response_text,
                                    'reasoning': reasoning,
                                    'model': 'huggingface',
                                    'provider': f'Hugging Face ({target_model})'
                                }
                            
                            return {
                                'response': response_text,
                                'model': 'huggingface',
                                'provider': f'Hugging Face ({target_model})'
                            }
                else:
                    last_error = f"HF Router API Error ({response.status_code}): {response.text}"
                    # If the first one fails, continue to the second model
                    continue
            
            # If we reached here, both models failed
            return {'error': last_error}
        except Exception as e:
            print(f">>> Hugging Face API Error: {str(e)}")
            return {'error': str(e)}




class AISelector:
    """
    Intelligent AI Model Selection Algorithm
    
    Selects the best AI model based on prompt characteristics:
    - DeepSeek: Best for coding, debugging, algorithms
    - Claude: Best for writing, analysis, nuanced responses
    - Gemini: Best for factual queries, multimodal, research
    - Qwen: Best for multilingual, Chinese content
    """
    
    # Keywords and patterns for each model's strengths
    CODE_KEYWORDS = [
        'code', 'function', 'debug', 'algorithm', 'python', 'java', 'javascript',
        'typescript', 'programming', 'compiler', 'syntax', 'error', 'bug', 'api',
        'class', 'method', 'variable', 'loop', 'array', 'list', 'dictionary',
        'database', 'sql', 'query', 'git', 'docker', 'kubernetes', 'aws',
        'react', 'vue', 'angular', 'node', 'flask', 'django', 'spring'
    ]
    
    WRITING_KEYWORDS = [
        'write', 'essay', 'story', 'blog', 'article', 'creative', 'poem',
        'narrative', 'content', 'copywriting', 'draft', 'rewrite', 'summarize',
        'explain', 'describe', 'elaborate', 'persuade', 'argue', 'analyze',
        'review', 'critique', 'edit', 'proofread', 'tone', 'style'
    ]
    
    RESEARCH_KEYWORDS = [
        'what is', 'how does', 'explain', 'define', 'compare', 'difference',
        'facts', 'history', 'science', 'research', 'data', 'statistics',
        'study', 'analysis', 'report', 'information', 'learn', 'understand',
        'search', 'find', 'look up', 'reference', 'source', 'cite'
    ]
    
    MULTILINGUAL_PATTERNS = [
        # Chinese characters
        r'[\u4e00-\u9fff]',
        # Japanese
        r'[\u3040-\u309f\u30a0-\u30ff]',
        # Korean
        r'[\uac00-\ud7af]',
        # Arabic
        r'[\u0600-\u06ff]',
        # Hindi/Devanagari
        r'[\u0900-\u097f]'
    ]
    
    REASONING_KEYWORDS = [
        'reason', 'think', 'solve', 'complex', 'logic', 'thought', 'step-by-step',
        'why', 'how to', 'deep', 'analysis', 'math', 'proof', 'explain carefully'
    ]
    
    def __init__(self, available_models: list = None):
        """
        Initialize with available models.
        """
        self.available = available_models if available_models is not None else ['openai', 'gemini', 'claude', 'deepseek', 'qwen', 'huggingface', 'pollinations']
    
    def _count_keyword_matches(self, text: str, keywords: list) -> int:
        """Count how many keywords appear in the text as whole words."""
        text_lower = f" {text.lower()} "
        # Use simple boundary spaces for efficiency, or could use regex
        count = 0
        for kw in keywords:
            if f" {kw} " in text_lower or text_lower.startswith(f"{kw} ") or text_lower.endswith(f" {kw}"):
                count += 1
        return count
    
    def _has_non_latin(self, text: str) -> bool:
        """Check if text contains non-Latin scripts."""
        for pattern in self.MULTILINGUAL_PATTERNS:
            if re.search(pattern, text):
                return True
        return False
    
    def _calculate_scores(self, prompt: str) -> Dict[str, float]:
        """Calculate suitability scores for each model."""
        scores = {
            'openai': 0.0,
            'deepseek': 0.0,
            'huggingface': 0.0,
            'claude': 0.0,
            'gemini': 0.0,
            'qwen': 0.0,
            'pollinations': 0.0
        }
        
        prompt_lower = prompt.lower()
        prompt_length = len(prompt)
        
        # Base score for Pollinations (PREFERRED - free, always available, reliable)
        scores['pollinations'] = 15.0
        
        # === OpenAI: General capabilities ===
        # Very solid baseline score if configured
        scores['openai'] += 7.0
        
        # === Gemini: Speed and General Knowledge (Default for speed) ===
        # Boost Gemini significantly to make it the default fast model
        scores['gemini'] += 8.0 
        
        # === HuggingFace / DeepSeek-R1: Advanced Reasoning & Logic ===
        # Only select DeepSeek/HF if explicitly needed for complex tasks
        reasoning_matches = self._count_keyword_matches(prompt, self.REASONING_KEYWORDS)
        if reasoning_matches > 0:
            scores['huggingface'] += reasoning_matches * 4.0 
            scores['deepseek'] += reasoning_matches * 4.0
            
        # Coding: Pollinations still preferred for code, with DeepSeek/HF as alternatives
        code_matches = self._count_keyword_matches(prompt, self.CODE_KEYWORDS)
        if code_matches > 0:
            scores['pollinations'] += code_matches * 3.0  # Keep Pollinations ahead for code too
            scores['huggingface'] += code_matches * 8.0
            scores['deepseek'] += code_matches * 10.0
            scores['openai'] += code_matches * 9.0
            # Gemini is fallback/speed backup but not first choice for code now
            scores['gemini'] -= 2.0
        
        # Check for code blocks
        if '```' in prompt or 'def ' in prompt or 'function ' in prompt or 'class ' in prompt:
            # Toned down from 20/25 to 10/12 to prevent over-switching for simple chats
            scores['huggingface'] += 10.0
            scores['deepseek'] += 12.0
            scores['openai'] += 11.0
            scores['gemini'] += 2.0 # Keep Gemini neutral for code, don't penalize it

        # === Claude: Writing and nuanced analysis ===
        writing_matches = self._count_keyword_matches(prompt, self.WRITING_KEYWORDS)
        if writing_matches > 0:
            scores['claude'] += writing_matches * 5.0
        
        # Long-form content preference
        if prompt_length > 500:
            scores['claude'] += 2.0
        
        # === Gemini: Research and factual queries ===
        research_matches = self._count_keyword_matches(prompt, self.RESEARCH_KEYWORDS)
        if research_matches > 0:
            scores['gemini'] += research_matches * 2.0
        
        # Question patterns - Gemini is great for simple Q&A
        if prompt_lower.startswith(('what', 'how', 'why', 'when', 'where', 'who')):
            scores['gemini'] += 2.0
        
        # === Qwen: Multilingual content ===
        if self._has_non_latin(prompt):
            scores['qwen'] += 10.0  # Strong preference for non-Latin text
        
        # Base scores
        for model in scores:
             # Ensure no negative scores if we had them (we don't, but safe practice)
             pass 
        
        # Filter to only available models
        return {k: v for k, v in scores.items() if k in self.available}
    
    def select_best_model(self, prompt: str) -> str:
        """
        Select the best AI model for the given prompt based on scores.
        ALWAYS prefers Pollinations as the default provider.
        """
        if not self.available:
            raise ValueError("No AI models available")
        
        # Always prefer Pollinations when it's available (free, reliable, no key needed)
        if 'pollinations' in self.available:
            return 'pollinations'
        
        scores = self._calculate_scores(prompt)
        
        if not scores:
            return self.available[0]
        
        # Pick the model with the highest score
        best_model = max(scores, key=scores.get)
        return best_model
    
    def explain_selection(self, prompt: str) -> Dict[str, Any]:
        """
        Explain why a particular model was selected.
        """
        selected = self.select_best_model(prompt)
        scores = self._calculate_scores(prompt)
        
        explanations = {
            'huggingface': 'DeepSeek-R1 (Hugging Face): High-quality reasoning and logic',
            'deepseek': 'DeepSeek API: Primary model for technical and reasoning tasks',
            'claude': 'Anthropic Claude: Specialized in nuanced text analysis',
            'gemini': 'Google Gemini: Optimized for speed and general knowledge',
            'qwen': 'Alibaba Qwen: Expert at multilingual content',
            'pollinations': 'Pollinations AI: Preferred default provider (free, reliable)',
        }
        
        is_primary = selected in ['huggingface', 'deepseek']
        reason = explanations.get(selected, 'Default selection')
        if is_primary:
            reason = f"Mandatory Preference: {reason}"
            
        return {
            'selected_model': selected,
            'reason': reason,
            'scores': scores
        }


class PollinationsProvider(AIProvider):
    """
    Pollinations.ai Provider - Free (with API key), no-cost AI service.
    Uses the OpenAI-compatible endpoint at gen.pollinations.ai.
    Serves as the PREFERRED default provider.

    Available models (check https://text.pollinations.ai/models for current list):
        - openai / openai-fast  : GPT-OSS 20B Reasoning LLM (OVH) - primary model

    API key: Obtain at https://enter.pollinations.ai
    Set via env var: POLLINATIONS_API_KEY=sk_...
    """
    def __init__(self, model: str = None, json_mode: bool = False, api_key: str = None):
        self.base_url = "https://gen.pollinations.ai/v1/chat/completions"
        # openai-fast is the primary model alias (also aliased as 'openai')
        self.model = model or os.getenv('POLLINATIONS_MODEL', 'openai-fast')
        self.json_mode = json_mode
        # API key passed explicitly (e.g. from vault) takes priority over env var
        self._explicit_api_key = api_key

    def _get_api_key(self) -> str:
        """Lazy-load API key: explicit param > env var. Checked on every call so hot-reloads work."""
        return self._explicit_api_key or os.getenv('POLLINATIONS_API_KEY', '')

    def is_configured(self) -> bool:
        return True  # Always available even without API key (anonymous tier)
    
    def generate(self, prompt: str, system_prompt: str = None, messages: list = None, json_mode: bool = None) -> Dict[str, Any]:
        import time
        use_json_mode = json_mode if json_mode is not None else self.json_mode
        try:
            # Truncate large payloads to stay within limits
            max_total_chars = 12000
            payload_messages = []
            
            if messages:
                current_chars = 0
                for msg in reversed(messages):
                    content = msg.get('content', '')
                    role = msg.get('role', 'user')
                    
                    if current_chars + len(content) > max_total_chars:
                        if len(payload_messages) == 0:
                            half = max_total_chars // 2
                            content = content[:half] + "\n\n...[TRUNCATED]...\n\n" + content[-half:]
                            payload_messages.insert(0, {'role': role, 'content': content})
                            current_chars += len(content)
                        else:
                            continue
                    else:
                        payload_messages.insert(0, {'role': role, 'content': content})
                        current_chars += len(content)
            else:
                content = prompt
                if len(content) > max_total_chars:
                    half = max_total_chars // 2
                    content = content[:half] + "\n\n...[TRUNCATED]...\n\n" + content[-half:]
                payload_messages.append({'role': 'user', 'content': content})
                
            if system_prompt:
                payload_messages.insert(0, {'role': 'system', 'content': system_prompt})

            # OpenAI-compatible payload
            payload = {
                'model': self.model,
                'messages': payload_messages,
            }
            
            # JSON mode: instructs the model to return valid JSON only
            if use_json_mode:
                payload['response_format'] = {'type': 'json_object'}

            # Build headers — resolve key lazily so vault changes are picked up without restart
            api_key = self._get_api_key()
            headers = {'Content-Type': 'application/json'}
            if api_key:
                headers['Authorization'] = f'Bearer {api_key}'

            last_error_text = ""
            last_status = 0
            
            for attempt in range(3):
                try:
                    response = requests.post(
                        self.base_url, 
                        headers=headers,
                        json=payload,
                        timeout=60  # Generous timeout for free tier
                    )
                    
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            # OpenAI-compatible response format
                            text = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                            if text:
                                return {
                                    'response': text,
                                    'model': 'pollinations',
                                    'provider': f'Pollinations AI ({self.model})'
                                }
                            else:
                                # If JSON parsed but no content, use raw text
                                raw = response.text.strip()
                                if raw:
                                    return {
                                        'response': raw,
                                        'model': 'pollinations',
                                        'provider': f'Pollinations AI ({self.model})'
                                    }
                        except (ValueError, KeyError, IndexError):
                            # If response is plain text (not JSON), use it directly
                            if response.text and len(response.text.strip()) > 10:
                                return {
                                    'response': response.text.strip(),
                                    'model': 'pollinations',
                                    'provider': f'Pollinations AI ({self.model})'
                                }
                        
                    last_status = response.status_code
                    last_error_text = response.text[:500]
                    print(f"[Pollinations] Attempt {attempt+1} failed: {last_status} - {last_error_text[:200]}")
                    
                    # Only retry on server errors
                    if response.status_code >= 500 and attempt < 2:
                        time.sleep(2 ** (attempt + 1))
                        continue
                    else:
                        break
                except requests.exceptions.Timeout:
                    last_error_text = f"Timeout on attempt {attempt+1}"
                    print(f"[Pollinations] {last_error_text}")
                    if attempt < 2:
                        time.sleep(2)
                        continue
                    break
            
            print(f"Pollinations Error: {last_status} - {last_error_text}")
            return {
                'error': f"Pollinations AI returned {last_status}: {last_error_text}",
                'model': 'pollinations',
                'provider': 'Pollinations AI'
            }

        except Exception as e:
            print(f"Pollinations Exception: {e}")
            return {
                'error': f"Pollinations AI network error: {str(e)}",
                'model': 'pollinations',
                'provider': 'Pollinations AI'
            }

class MockProvider(AIProvider):
    """
    Mock AI Provider - Always available.
    Provides helpful instructions when no real API keys are configured.
    """
    def is_configured(self) -> bool:
        return True
    
    def generate(self, prompt: str, system_prompt: str = None, messages: list = None) -> Dict[str, Any]:
        content = (
            "### 🔐 AI Setup Required\n\n"
            "The AI assistant is running in **offline mode** because no API keys are configured on this server, "
            "and the free fallback service is currently unavailable.\n\n"
            "**How to enable AI:**\n\n"
            "1. **Option 1 — Personal Key (private):** Click the ⚙️ Settings icon in the AI panel and enter your own API key.\n"
            "2. **Option 2 — Server Admin:** Add keys to the server vault using `vault_tool.py`.\n\n"
            "> **Tip:** Get a free Gemini key at [aistudio.google.com](https://aistudio.google.com/apikey)"
        )
        return {
            'response': content,
            'model': 'mock',
            'is_mock': True,
            'provider': 'System (Offline)'
        }
        

class MultiAIService:
    """Entry point for AI generation with automatic failover."""
    
    def __init__(self, user_api_keys: Dict[str, str] = None):
        """
        Initialize with optional user API keys (maps provider_name -> api_key)
        """
        user_api_keys = user_api_keys or {}
        print(f"[AI] Initializing MultiAIService with keys: {list(user_api_keys.keys())}")
        
        # Initialize Providers
        self.providers = {
            'openai': OpenAIProvider(user_api_keys.get('openai')),
            'gemini': GeminiProvider(user_api_keys.get('gemini')),
            'claude': ClaudeProvider(user_api_keys.get('claude')),
            'qwen': QwenProvider(user_api_keys.get('qwen')),
            'huggingface': HuggingFaceProvider(user_api_keys.get('huggingface') or user_api_keys.get('hf_token')),
            'pollinations': PollinationsProvider(api_key=user_api_keys.get('pollinations_api_key') or user_api_keys.get('pollinations')),
            'mock': MockProvider()
        }
        
        # Async providers - DeepSeek
        self.async_deepseek = None
        try:
            from services.async_deepseek_provider import AsyncDeepSeekProvider
            self.async_deepseek = AsyncDeepSeekProvider(user_api_keys.get('deepseek'))
            self.providers['deepseek'] = self.async_deepseek
        except ImportError:
            print("Warning: AsyncDeepSeekProvider could not be imported")
            self.providers['deepseek'] = None

        # Route logic
        available_models = self.get_available_models()
        # Use mock as a fallback if no other models are configured
        self.selector = AISelector(available_models if available_models else ['mock'])
        
        # Initialize Sub-Services
        async def explainer_callback(prompt, system_prompt):
            return await self.chat(prompt, model='deepseek', system_prompt=system_prompt)
            
        async def code_champ_callback(prompt, system_prompt):
            # CodeChamp needs deterministic JSON output. Pollinations with openai-large
            # is free, always-on, and reliably returns structured JSON.
            # We try Pollinations (JSON mode) first, then fall back through 'auto'.
            pollinations = self.providers.get('pollinations')
            if pollinations and pollinations.is_configured():
                try:
                    loop = asyncio.get_running_loop()
                    result = await loop.run_in_executor(
                        None,
                        lambda: pollinations.generate(prompt, system_prompt, json_mode=True)
                    )
                    if 'error' not in result:
                        return result
                    print(f"[CodeChamp] Pollinations JSON mode failed: {result.get('error')}, falling back to auto")
                except Exception as e:
                    print(f"[CodeChamp] Pollinations exception: {e}, falling back to auto")
            # Fallback: use auto-routing (DeepSeek, HF, etc.)
            return await self.chat(prompt, model='auto', system_prompt=system_prompt)
            
        self.explainer = AIExplainerService(explainer_callback)
        self.code_champ = CodeChampService(code_champ_callback)

    def _strip_thinking_tags(self, text: str) -> tuple[str, str]:
        """Removes <think>...</think> blocks from the text and returns (stripped_text, reasoning_content)."""
        if not text:
            return text, ""
        
        # Keep a copy of the original text
        original_text = text
        
        # Extract reasoning content
        reasoning = ""
        thinking_match = re.search(r'<think>(.*?)</think>', original_text, flags=re.DOTALL)
        if thinking_match:
            reasoning = thinking_match.group(1).strip()
            
        # Remove <think>...</think> and any whitespace around it
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
        
        stripped = text.strip()
        
        # If stripping leaves us with nothing, but there was reasoning before
        # We might want to keep the reasoning or show a placeholder in the content
        if not stripped and reasoning:
            return f"> *Internal Reasoning fallback:*\n\n{reasoning}", reasoning
        
        return stripped, reasoning
    
    def get_available_models(self) -> list:
        """
        Get list of configured AI models.
        Returns all properly configured providers.
        """
        available = []
        for name, provider in self.providers.items():
            if name == 'mock':
                continue  # mock is always available as fallback, don't list it
            if provider is not None and provider.is_configured():
                available.append(name)
        return available
    
    async def chat(
        self, 
        prompt: str, 
        model: str = 'auto',
        system_prompt: str = None,
        messages: list = None,
        hide_thinking: bool = False
    ) -> Dict[str, Any]:
        """Send a message to an AI model asynchronously."""
        if not prompt and (not messages or len(messages) == 0):
            return {'error': 'Prompt or messages required'}
        
        # --- Response caching (1-hour TTL) ---
        # Build a cache key from (prompt, model, system_prompt)
        prompt_for_key = prompt[:500] if prompt else ''
        sp_for_key = (system_prompt or '')[:200]
        cache_key = response_cache._generate_key('chat-v1', prompt_for_key, model, sp_for_key)
        cached = response_cache.get(cache_key)
        if cached:
            cached['from_cache'] = True
            return cached
        
        # Auto-select model if not specified
        if model == 'auto':
            selection = self.selector.explain_selection(prompt)
            model = selection['selected_model']
            auto_selected = True
        else:
            auto_selected = False
            selection = None
        
        # Validate model
        if model not in self.providers:
            return {'error': f'Unknown model: {model}'}
        
        provider = self.providers[model]
        
        if not provider.is_configured():
            # If the requested model isn't configured, try to find a fallback
            available = self.get_available_models()
            if available:
                # Use the first available model (likely Pollinations or Gemini if configured)
                fallback_model = available[0]
                # Prefer Pollinations as generic fallback if in list
                if 'pollinations' in available:
                     fallback_model = 'pollinations'
                
                print(f"Model {model} not configured. Falling back to {fallback_model}")
                model = fallback_model
                provider = self.providers[model]
                # Treat as auto-selected now since we switched
                auto_selected = True 
            else:
                # Final fallback to Mock
                return {
                    'warning': f'Model {model} is not configured (missing API key)',
                    'response': self.providers['mock'].generate(prompt)['response'],
                    'model': 'mock',
                    'is_mock': True,
                    'provider': 'System (Mock)'
                }
        
        # Execution
        try:
            if model == 'deepseek':
                # Async path
                result = await provider.generate_async(prompt, system_prompt, messages)
            else:
                # Sync path -> Run in executor
                loop = asyncio.get_running_loop()
                result = await loop.run_in_executor(
                    None, 
                    lambda: provider.generate(prompt, system_prompt, messages)
                )
            
            # Fallback Logic
            if 'error' in result:
                error_msg = str(result['error'])
                error_lower = error_msg.lower()
                print(f">>> Primary Model ({model}) failed: {error_msg}")
                
                # Check for recoverable errors (Balance, Rate Limit, Server Error)
                recoverable_patterns = [
                    'insufficient balance', '402', '429', '500', '502', '503', '504', 'overloaded',
                    'connection error', 'rate limit', 'rate_limit',
                    'remotedisconnected', 'connection aborted', 'timeout', 'timed out', 'protocolerror',
                    'server error', 'service unavailable', 'bad gateway'
                ]
                should_fallback = any(x in error_lower for x in recoverable_patterns)
                
                # Auth error patterns (case-insensitive)
                auth_patterns = [
                    '401', '403', 'authentication', 'not configured', 'invalid api key', 'invalid_api_key',
                    'incorrect api key', 'incorrect key', 'forbidden', 'unauthorized',
                    'api key not valid', 'invalid key', 'expired', 'permission denied',
                    'invalid x-goog-api-key', 'api_key_invalid', 'invalid auth'
                ]
                is_auth_error = any(x in error_lower for x in auth_patterns)
                
                if auto_selected:
                    # Auto mode: always fallback on auth errors (key might just be missing for this model)
                    should_fallback = should_fallback or is_auth_error
                else:
                    # Explicit model selected by user. Show them the auth error.
                    if is_auth_error:
                        should_fallback = False
                
                if should_fallback:
                    available = self.get_available_models()
                    remaining = [m for m in available if m != model and m != 'mock']
                    
                    # Prefer Pollinations and Gemini as fallback (most reliable)
                    preferred_order = ['pollinations', 'gemini', 'huggingface', 'openai', 'deepseek', 'claude', 'qwen']
                    remaining.sort(key=lambda m: preferred_order.index(m) if m in preferred_order else 99)
                    
                    # Always append mock as the absolute last resort
                    remaining.append('mock')
                    
                    print(f">>> [DEBUG] Fallback array: {remaining}")
                    debug_traces = []
                    
                    for fallback_model in remaining:
                        debug_traces.append(f"Attempting {fallback_model}...")
                        fallback_provider = self.providers[fallback_model]
                        if fallback_model == 'deepseek':
                            fallback_result = await fallback_provider.generate_async(prompt, system_prompt, messages)
                        else:
                            loop = asyncio.get_running_loop()
                            fallback_result = await loop.run_in_executor(
                                None, 
                                lambda: fallback_provider.generate(prompt, system_prompt, messages)
                            )
                            
                        if 'error' not in fallback_result:
                            fallback_result['fallback_used'] = True
                            fallback_result['original_model'] = model
                            fallback_result['model'] = fallback_model
                            # Use exact warning format needed for UI awareness but ensure no error key
                            fallback_result['warning'] = f"Original model {model} failed: {error_msg}"
                            
                            if fallback_model == 'mock':
                                fallback_result['is_mock'] = True
                                fallback_result['debug_traces'] = debug_traces
                            
                            result = fallback_result
                            break
                        else:
                            debug_traces.append(f"{fallback_model} failed: {fallback_result.get('error')}")
                            
            print(f">>> [DEBUG] Final result model: {result.get('model')}")
            # Metadata
            if 'error' not in result:
                if 'response' in result and 'content' not in result:
                    result['content'] = result['response']
                
                # Strip thinking and parse reasoning
                if 'content' in result:
                    stripped_content, extracted_reasoning = self._strip_thinking_tags(result['content'])
                    if hide_thinking:
                        result['content'] = stripped_content
                    # Always save extracted reasoning if it exists and wasn't natively provided
                    if extracted_reasoning and not result.get('reasoning'):
                        result['reasoning'] = extracted_reasoning
                        
                if 'response' in result:
                    stripped_response, extracted_reasoning_resp = self._strip_thinking_tags(result['response'])
                    if hide_thinking:
                        result['response'] = stripped_response
                    if extracted_reasoning_resp and not result.get('reasoning'):
                        result['reasoning'] = extracted_reasoning_resp

                if 'content' in result and not result['content'].strip() and result.get('reasoning'):
                     # Fallback to reasoning if content is empty
                     result['content'] = f"> *Analysis derived from reasoning:*\n\n{result.get('reasoning')}"

                result['auto_selected'] = auto_selected
                if selection:
                    result['all_scores'] = selection['scores']
                    result['selection_id'] = selection.get('selected_model')
                
                # Cache the successful result (1 hour TTL) - DO NOT cache mock failures
                if result.get('model') != 'mock':
                    response_cache.set(cache_key, result, ttl=3600)
            
            return result

        except Exception as e:
            return {'error': str(e)}

    async def suggest(self, partial_text: str) -> Dict[str, Any]:
        """Get AI suggestions while user is typing."""
        if len(partial_text) < 10:
            return {'suggestions': []}
        
        available = self.get_available_models()
        if not available:
            return {'suggestions': [], 'error': 'No AI models configured'}
        
        # DeepSeek is good for code completion, Gemini for speed
        # If deepseek is available, use it via code_champ logic or direct?
        # Let's prefer Gemini for speed if available, otherwise DeepSeek
        model = 'gemini' if 'gemini' in available else available[0]
        provider = self.providers[model]
        
        system_prompt = (
            "You are a helpful assistant providing quick suggestions. "
            "Based on the partial text, provide 3 brief completions or improvements. "
            "Return only a JSON array of 3 strings, no explanation."
        )
        prompt = f"Suggest completions for: \"{partial_text}\""
        
        try:
            if model == 'deepseek':
                result = await provider.generate_async(prompt, system_prompt)
            else:
                loop = asyncio.get_running_loop()
                result = await loop.run_in_executor(
                    None, 
                    lambda: provider.generate(prompt, system_prompt)
                )
            
            if 'error' in result:
                return {'suggestions': [], 'error': result['error']}
            
            # Parse logic (same as before)
            text = result['response']
            try:
                match = re.search(r'\[.*?\]', text, re.DOTALL)
                if match:
                    json_str = match.group()
                    suggestions = json.loads(json_str)
                    if not (isinstance(suggestions, list) and all(isinstance(s, str) for s in suggestions)):
                         suggestions = [text.strip()]
                else:
                    suggestions = [text.strip()]
            except json.JSONDecodeError:
                suggestions = [result['response'].strip()]
                
            return {
                'suggestions': suggestions[:3],
                'model': model
            }
            
        except Exception as e:
            return {'suggestions': [], 'error': str(e)}
