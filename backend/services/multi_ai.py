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
# from huggingface_hub import InferenceClient

from services.async_deepseek_provider import AsyncDeepSeekProvider
from services.ai_explainer import AIExplainerService
from services.code_champ import CodeChampService


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
             
        payload = {'contents': contents}
        
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
            response = requests.post(url, json=payload)
            data = response.json()
            
            if 'candidates' in data and data['candidates']:
                text = data['candidates'][0]['content']['parts'][0]['text']
                return {
                    'response': text,
                    'model': 'gemini',
                    'provider': 'Google Gemini'
                }
            
            error_msg = data.get('error', {}).get('message', 'Unknown error')
            print(f">>> Gemini API Error: {error_msg}")
            print(f">>> Gemini API Full Response: {data}")
            return {'error': error_msg}
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
            'max_tokens': 4096,
            'messages': api_messages
        }
        
        if system_prompt:
            data['system'] = system_prompt
        
        try:
            response = requests.post(
                f"{self.base_url}/messages",
                headers=headers,
                json=data
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
                json=data
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
        raw_key = api_key or os.getenv('HF_TOKEN', '')
        self.api_key = raw_key.strip() if raw_key else ''
        self.model = os.getenv('HF_MODEL_ID', 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B')
        self.client = None
        if self.api_key:
            try:
                # Use the latest HF Router for better model support
                from huggingface_hub import InferenceClient
                self.client = InferenceClient(
                    api_key=self.api_key,
                    base_url="https://router.huggingface.co/v1"
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
    
    def generate(self, prompt: str, system_prompt: str = None, messages: list = None) -> Dict[str, Any]:
        if not self.is_configured() or not self.client:
            return {'error': 'Hugging Face (HF_TOKEN) not configured'}
        
        try:
            # Construct messages for HF Chat Completion
            hf_messages = []
            if system_prompt:
                hf_messages.append({"role": "system", "content": system_prompt})
            
            if messages:
                for msg in messages:
                    # Filter out system if already added
                    if msg['role'] == 'system' and system_prompt: continue
                    hf_messages.append({"role": msg['role'], "content": msg['content']})
            else:
                hf_messages.append({"role": "user", "content": prompt})

            # Use non-streaming for stability with coding-optimized parameters
            response_obj = self.client.chat_completion(
                model=self.model,
                messages=hf_messages,
                max_tokens=2048,
                temperature=0.1,
                top_p=0.95,
                stream=False,
            )
            
            response_text = ""
            if hasattr(response_obj, 'choices') and len(response_obj.choices) > 0:
                choice = response_obj.choices[0]
                # Try content first, then check if there's reasoning
                msg = getattr(choice, 'message', None)
                if msg:
                    content = getattr(msg, 'content', '') or ''
                    reasoning = getattr(msg, 'reasoning_content', '') or ''
                    
                    if reasoning:
                        return {
                            'response': content,
                            'reasoning': reasoning,
                            'model': 'huggingface',
                            'provider': f'Hugging Face ({self.model})'
                        }
                    response_text = content
            
            if not response_text:
                print(f">>> HF Warning: Empty response received for model {self.model}")
                # Try raw parsing if it's a dict
                if isinstance(response_obj, dict):
                     response_text = response_obj.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            return {
                'response': response_text,
                'model': 'huggingface',
                'provider': f'Hugging Face ({self.model})'
            }
        except Exception as e:
            print(f">>> Hugging Face API Error: {str(e)}")
            return {'error': str(e)}


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
            "The AI assistant is running in **offline mode** because no API keys are configured on this server.\n\n"
            "**How to enable AI:**\n\n"
            "**Option 1 — Server Admin (recommended for shared access):**\n"
            "```bash\n"
            "cd backend/scripts\n"
            "python vault_tool.py add gemini YOUR_GEMINI_KEY\n"
            "# Then restart the server\n"
            "```\n\n"
            "**Option 2 — Personal Key (just for you):**\n"
            "Click the ⚙️ Settings icon in the AI panel and enter your own API key.\n\n"
            "> **Tip:** Get a free Gemini key at [aistudio.google.com](https://aistudio.google.com/apikey)"
        )
        return {
            'response': content,
            'model': 'mock',
            'provider': 'System (Mock)'
        }


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
        self.available = available_models if available_models is not None else ['gemini', 'claude', 'deepseek', 'qwen', 'huggingface']
    
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
            'deepseek': 0.0,
            'huggingface': 0.0,
            'claude': 0.0,
            'gemini': 0.0,
            'qwen': 0.0
        }
        
        prompt_lower = prompt.lower()
        prompt_length = len(prompt)
        
        # === Gemini: Speed and General Knowledge (Default for speed) ===
        # Boost Gemini significantly to make it the default fast model
        scores['gemini'] += 8.0 
        
        # === HuggingFace / DeepSeek-R1: Advanced Reasoning & Logic ===
        # Only select DeepSeek/HF if explicitly needed for complex tasks
        reasoning_matches = self._count_keyword_matches(prompt, self.REASONING_KEYWORDS)
        if reasoning_matches > 0:
            scores['huggingface'] += reasoning_matches * 4.0 
            scores['deepseek'] += reasoning_matches * 4.0
            
        # Coding: Gemini 2.0 Flash is fast and good enough for most things with the new system prompt.
        # Only switch if "complex" or "reasoning" is also present, or if it's a very specific DeepSeek request.
        code_matches = self._count_keyword_matches(prompt, self.CODE_KEYWORDS)
        if code_matches > 0:
            # Significant boost to DeepSeek/HF for coding
            scores['huggingface'] += code_matches * 6.0
            scores['deepseek'] += code_matches * 8.0
            # Dampen Gemini's default lead for coding
            scores['gemini'] -= 4.0
        
        # Check for code blocks - strong indicator for coding model
        if '```' in prompt or 'def ' in prompt or 'function ' in prompt or 'class ' in prompt:
             # Strong indicators for code, give massive boost to reasoning models
            scores['huggingface'] += 15.0
            scores['deepseek'] += 20.0
            scores['gemini'] -= 5.0
        
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
        Prefers DeepSeek for coding, Gemini for speed/general, with smart fallback.
        """
        if not self.available:
            raise ValueError("No AI models available")
        
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
            'huggingface': 'DeepSeek-R1 (Qwen-7B): Best for coding, reasoning and logic (Primary)',
            'deepseek': 'DeepSeek API: Primary model for technical tasks',
            'claude': 'Anthropic Claude: Specialized in nuanced text analysis',
            'gemini': 'Google Gemini: Optimized for speed and general knowledge',
            'qwen': 'Alibaba Qwen: Expert at multilingual content'
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


class MultiAIService:
    """
    Unified service for interacting with multiple AI providers.
    Supports automatic model selection or manual override.
    Asynchronous implementation.
    """
    
    def __init__(self, user_api_keys: Dict[str, str] = None):
        """
        Initialize the Multi-AI service.
        """
        user_api_keys = user_api_keys or {}
        
        # Initialize Providers
        self.providers = {
            'gemini': GeminiProvider(user_api_keys.get('gemini')),
            'claude': ClaudeProvider(user_api_keys.get('claude')),
            'qwen': QwenProvider(user_api_keys.get('qwen')),
            'huggingface': HuggingFaceProvider(user_api_keys.get('huggingface') or user_api_keys.get('hf_token')),
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
        self.selector = AISelector(available_models if available_models else ['mock'])
        # Pass a callback that uses the main chat method, enabling fallback logic
        async def explainer_callback(prompt, system_prompt):
            return await self.chat(prompt, model='deepseek', system_prompt=system_prompt)
            
        self.explainer = AIExplainerService(explainer_callback)
        self.code_champ = CodeChampService(self.async_deepseek)
        
        # AI Selector
        available = self.get_available_models()
        self.selector = AISelector(available)

    def _strip_thinking_tags(self, text: str) -> str:
        """Removes <think>...</think> blocks from the text."""
        if not text:
            return text
        
        # Keep a copy of the original text
        original_text = text
        
        # Remove <think>...</think> and any whitespace around it
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
        
        stripped = text.strip()
        
        # If stripping leaves us with nothing, but there was reasoning before
        # We might want to keep the reasoning or show a placeholder
        if not stripped and '<think>' in original_text:
            # Instead of returning nothing, we can extract the thinking content 
            # and present it as the content if that's all we have
            thinking_match = re.search(r'<think>(.*?)</think>', original_text, flags=re.DOTALL)
            if thinking_match:
                content = thinking_match.group(1).strip()
                if content:
                    return f"> *Internal Reasoning fallback:*\n\n{content}"
        
        return stripped
    
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
            if auto_selected:
                available = self.get_available_models()
                if not available:
                    # Final fallback to Mock
                    model = 'mock'
                    provider = self.providers['mock']
                else:
                    model = available[0]
                    provider = self.providers[model]
            else:
                # Even for manual selection, if it fails, let's offer the mock provider instead of a hard error 
                # to satisfy the "error should never happen" requirement
                return {
                    'warning': f'Model {model} is not configured (missing API key)',
                    'response': self.providers['mock'].generate(prompt)['response'],
                    'model': 'mock',
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
                print(f">>> Primary Model ({model}) failed: {error_msg}")
                
                # Check for recoverable errors (Balance, Rate Limit, Server Error, Auth)
                # Basically try fallback for almost anything except maybe invalid prompt
                should_fallback = any(x in error_msg for x in [
                    'Insufficient Balance', '402', '429', '500', '503', 'Overloaded',
                    'Connection error', 'rate limit', '401', 'Authentication'
                ])
                
                # Also fallback if we just have a generic "error" and a fallback is available
                if should_fallback:
                    available = self.get_available_models()
                    remaining = [m for m in available if m != model]
                    if 'mock' not in remaining and model != 'mock':
                        remaining.append('mock')
                    fallback_model = 'huggingface' if 'huggingface' in remaining and 'huggingface' != 'mock' else (remaining[0] if remaining else None)
                    
                    if fallback_model:
                        print(f">>> Attempting fallback to {fallback_model}...")
                        fallback_provider = self.providers[fallback_model]
                        if fallback_model == 'deepseek':
                             result = await fallback_provider.generate_async(prompt, system_prompt, messages)
                        else:
                            loop = asyncio.get_running_loop()
                            result = await loop.run_in_executor(
                                None, 
                                lambda: fallback_provider.generate(prompt, system_prompt, messages)
                            )
                            
                        if 'error' not in result:
                            result['fallback_used'] = True
                            result['original_model'] = model
                            result['model'] = fallback_model
                            result['warning'] = f"Original model {model} failed: {error_msg}"

            # Metadata
            if 'error' not in result:
                if 'response' in result and 'content' not in result:
                    result['content'] = result['response']
                
                # Strip thinking if requested
                if hide_thinking:
                    if 'content' in result:
                        result['content'] = self._strip_thinking_tags(result['content'])
                    if 'response' in result:
                        result['response'] = self._strip_thinking_tags(result['response'])

                if 'content' in result and not result['content'].strip() and result.get('reasoning'):
                     # Fallback to reasoning if content is empty
                     result['content'] = f"> *Analysis derived from reasoning:*\n\n{result.get('reasoning')}"

                result['auto_selected'] = auto_selected
                if selection:
                    result['all_scores'] = selection['scores']
                    result['selection_id'] = selection.get('selected_model')
            
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
