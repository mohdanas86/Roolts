import aiohttp
import asyncio
import json
import logging
import time
from typing import Dict, Any, List, Optional, AsyncGenerator

# Centralized configuration
# Centralized configuration
from config_manager import config_manager
from services.rate_limiter import rate_limiter
from services.connection_pool import global_connection_pool
from services.performance_monitor import performance_monitor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AsyncDeepSeekProvider:
    """
    Asynchronous DeepSeek Provider using aiohttp.
    Features:
    - Connection pooling
    - Exponential backoff retries
    - Streaming support
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or config_manager.get_deepseek_key()
        self.base_url = 'https://api.deepseek.com/v1'
        # Update to 'deepseek-chat' for better compatibility with V3/R1
        self.model = 'deepseek-chat'
        self._session: Optional[aiohttp.ClientSession] = None
        
        # Performance & Retry Config
        self.max_retries = 3
        self.retry_delay = 1.0  # seconds
        self.timeout = aiohttp.ClientTimeout(total=30) # 30s timeout

    def is_configured(self) -> bool:
        """Check if API key is configured and valid."""
        if not self.api_key:
            return False
        if self.api_key.startswith('your-'):
            return False
        return len(self.api_key) > 5

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get global client session."""
        return await global_connection_pool.get_session()

    async def close(self):
        """Close the session (No-op as pool is shared)."""
        pass

    async def generate_async(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None, 
        messages: Optional[List[Dict[str, str]]] = None,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        Generate response asynchronously.
        """
        if not self.api_key:
            return {'error': 'DeepSeek API key not configured'}

        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

        # Construct messages
        api_messages = []
        if system_prompt:
            api_messages.append({'role': 'system', 'content': system_prompt})
        
        if messages:
            for msg in messages:
                if msg['role'] == 'system' and system_prompt:
                    continue
                api_messages.append(msg)
        else:
            api_messages.append({'role': 'user', 'content': prompt})

        payload = {
            'model': self.model,
            'messages': api_messages,
            'max_tokens': 4096,
            'stream': stream
        }

        return await self._make_request_with_retry(headers, payload, stream)

    async def _make_request_with_retry(
        self, 
        headers: Dict[str, str], 
        payload: Dict[str, Any],
        stream: bool
    ) -> Dict[str, Any]:
        """Execute request with exponential backoff."""
        # Rate Limit Check
        await rate_limiter.acquire()
        
        session = await self._get_session()
        url = f"{self.base_url}/chat/completions"
        
        start_time = time.time()
        try:
            for attempt in range(self.max_retries + 1):
                try:
                    # Use session.post context manager
                    async with session.post(url, headers=headers, json=payload) as response:
                        # Handle 429/5xx with retry
                        if response.status in [429, 500, 502, 503, 504]:
                            if attempt < self.max_retries:
                                delay = self.retry_delay * (2 ** attempt)
                                logger.warning(f"DeepSeek API error {response.status}. Retrying in {delay}s...")
                                await asyncio.sleep(delay)
                                continue
                            else:
                                error_text = await response.text()
                                performance_monitor.record_request('deepseek', time.time() - start_time, False)
                                return {'error': f"DeepSeek API failed after retries: {response.status} - {error_text}"}

                        if response.status != 200:
                            error_text = await response.text()
                            performance_monitor.record_request('deepseek', time.time() - start_time, False)
                            return {
                                'error': f"DeepSeek API Error: {response.status} - {error_text}",
                                'model': 'deepseek',
                                'provider': 'DeepSeek (Async)'
                            }

                        # Success path
                        if stream:
                            # For streaming, passed to caller
                            pass 

                        data = await response.json()
                        if 'choices' in data and data['choices']:
                            content = data['choices'][0]['message']['content']
                            # Estimate tokens (simple char count / 4)
                            tokens = len(content) // 4
                            performance_monitor.record_request('deepseek', time.time() - start_time, True, tokens)
                            
                            return {
                                'response': content,
                                'model': 'deepseek',
                                'provider': 'DeepSeek (Async)'
                            }
                        
                        performance_monitor.record_request('deepseek', time.time() - start_time, False)
                        return {'error': 'Empty response from DeepSeek', 'model': 'deepseek'}

                except aiohttp.ClientError as e:
                    logger.error(f"Network error: {e}")
                    if attempt < self.max_retries:
                        delay = self.retry_delay * (2 ** attempt)
                        await asyncio.sleep(delay)
                    else:
                        performance_monitor.record_request('deepseek', time.time() - start_time, False)
                        return {'error': f"Network error after retries: {str(e)}", 'model': 'deepseek'}
                except Exception as e:
                    logger.error(f"Unexpected error: {e}")
                    performance_monitor.record_request('deepseek', time.time() - start_time, False)
                    return {'error': str(e)}
                    
        except Exception as outer_e:
             # Catch-all for very unexpected errors outside loop
             performance_monitor.record_request('deepseek', time.time() - start_time, False)
             return {'error': str(outer_e)}

        return {'error': 'Max retries exceeded'}

    async def stream_chat(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None, 
        messages: Optional[List[Dict[str, str]]] = None
    ) -> AsyncGenerator[str, None]:
        """
        Yields chunks of response for real-time display.
        """
        if not self.api_key:
            yield "Error: DeepSeek API key not configured"
            return

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

        payload = {
            'model': self.model,
            'messages': api_messages,
            'max_tokens': 4096,
            'stream': True
        }
        
        # Rate Limit Check
        await rate_limiter.acquire()
        
        session = await self._get_session()
        url = f"{self.base_url}/chat/completions"
        
        start_time = time.time()
        success = False
        token_count = 0
        
        try:
            async with session.post(url, headers=headers, json=payload) as response:
                if response.status != 200:
                    yield f"Error: {response.status}"
                    performance_monitor.record_request('deepseek', time.time() - start_time, False)
                    return
                
                while True:
                    line = await response.content.readline()
                    if not line:
                        break
                    
                    line = line.decode('utf-8').strip()
                    if not line:
                        continue
                        
                    if line.startswith('data: '):
                        data_str = line[6:]
                        if data_str == '[DONE]':
                            success = True
                            break
                        try:
                            data = json.loads(data_str)
                            if 'choices' in data and data['choices']:
                                delta = data['choices'][0].get('delta', {})
                                if 'content' in delta:
                                    content = delta['content']
                                    token_count += len(content) // 4 + 1 # Rough estimate
                                    yield content
                        except json.JSONDecodeError:
                            continue
                            
            # Record success if we reached [DONE] or end of stream without error
            performance_monitor.record_request('deepseek', time.time() - start_time, True, token_count)
                            
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"Error during streaming: {str(e)}"
            performance_monitor.record_request('deepseek', time.time() - start_time, False)
