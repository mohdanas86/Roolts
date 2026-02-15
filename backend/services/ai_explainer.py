import logging
import json
import time
from dataclasses import dataclass, asdict
from typing import Dict, Any, List, Optional, Callable, Awaitable

from services.cache_service import response_cache

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class ExplanationResult:
    overview: str
    key_concepts: List[str]
    logic_flow: str
    complexity: str
    improvement_suggestions: List[str]
    diagram_description: Optional[str] = None
    language: str = "python"
    processing_time_ms: float = 0.0

class AIExplainerService:
    """
    Service for generating structured code explanations.
    Decoupled from specific providers to allow fallback logic.
    """
    
    def __init__(self, generate_func: Callable[[str, Optional[str]], Awaitable[Dict[str, Any]]]):
        """
        Initialize with an async generation function.
        Args:
            generate_func: A function (prompt, system_prompt) -> Dict
        """
        self.generate_func = generate_func

    async def explain_code(self, code: str, language: str = "python", context_query: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate a structured explanation for the given code.
        """
        start_time = time.time()
        
        system_prompt = (
            "You are an expert code explainer. Your goal is to explain code clearly and structured for a developer. "
            "You must return your response in valid JSON format ONLY. "
            "The JSON structure must be: "
            "{"
            "  'overview': 'Brief summary of what the code does', "
            "  'key_concepts': ['concept1', 'concept2'], "
            "  'logic_flow': 'Step-by-step description of execution flow', "
            "  'complexity': 'Time and Space complexity analysis', "
            "  'improvement_suggestions': ['suggestion1', 'suggestion2'], "
            "  'diagram_description': 'Description for a flowchart or sequence diagram (optional)'"
            "}"
        ).replace("'", '"') # Ensure valid JSON quotes in prompt

        user_prompt = f"Explain the following {language} code:\n\n```{language}\n{code}\n```"
        if context_query:
            user_prompt += f"\n\nFocus on this question: {context_query}"

        # Check Cache
        cache_key = response_cache._generate_key("explain", code, language, context_query)
        cached_result = response_cache.get(cache_key)
        if cached_result:
            logger.info("Serving explanation from cache")
            return cached_result

        try:
            # Use the injected generation function (supports fallback)
            result = await self.generate_func(
                prompt=user_prompt,
                system_prompt=system_prompt
            )
            
            if 'error' in result:
                return {'error': result['error']}
            
            # Parse JSON response
            content = result.get('response', '') or result.get('content', '')
            try:
                # Clean up markdown code blocks if present
                if '```json' in content:
                    content = content.split('```json')[1].split('```')[0].strip()
                elif '```' in content:
                    content = content.split('```')[1].split('```')[0].strip()
                
                data = json.loads(content)
                
                # Validate/Fill missing fields
                explanation = ExplanationResult(
                    overview=data.get('overview', 'No overview provided'),
                    key_concepts=data.get('key_concepts', []),
                    logic_flow=data.get('logic_flow', 'No logic flow provided'),
                    complexity=data.get('complexity', 'Not analyzed'),
                    improvement_suggestions=data.get('improvement_suggestions', []),
                    diagram_description=data.get('diagram_description'),
                    language=language,
                    processing_time_ms=(time.time() - start_time) * 1000
                )
                
                final_result = asdict(explanation)
                
                # Cache success result for 24 hours
                response_cache.set(cache_key, final_result, ttl=86400)
                
                return final_result
                
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON response: {content}")
                return {
                    'error': 'Failed to parse explanation format',
                    'raw_response': content
                }
                
        except Exception as e:
            logger.error(f"Explanation failed: {e}")
            return {'error': str(e)}
