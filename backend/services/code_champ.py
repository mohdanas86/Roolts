import logging
import json
import time
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional, Callable, Awaitable

from services.async_deepseek_provider import AsyncDeepSeekProvider
from services.cache_service import response_cache, ResponseCache

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class BugReport:
    line: int
    severity: str  # Critical, Major, Minor
    description: str
    fix_suggestion: str

@dataclass
class ImprovementSuggestion:
    category: str # Performance, readability, security
    description: str
    code_snippet: Optional[str] = None

@dataclass
class CodeVariant:
    name: str
    explanation: str
    code: str

@dataclass
class AnalysisResult:
    quality_score: int # 0-100
    time_complexity: str
    space_complexity: str
    better_than: str
    bugs: List[BugReport]
    improvements: List[ImprovementSuggestion]
    summary: str
    recommendations: List[str]
    variants: List[CodeVariant] = field(default_factory=list)
    optimal_solution: Optional[Dict[str, Any]] = None
    platform_links: List[Dict[str, str]] = field(default_factory=list)
    processing_time_ms: float = 0.0

class CodeChampService:
    """
    Service for automated code review and bug detection (CodeChamp).
    """
    
    def __init__(self, generate_func: Optional[Callable[[str, str], Awaitable[Dict[str, Any]]]] = None):
        """
        Initialize with an async generation function.
        Args:
            generate_func: A function (prompt, system_prompt) -> Dict
        """
        self.generate_func = generate_func

    async def analyze_code(self, code: str, language: str = "python") -> Dict[str, Any]:
        """
        Analyze code for bugs, quality issues, and competitive programming metrics.
        """
        if not self.generate_func:
            return {'error': 'Analysis engine (generate_func) not configured'}
            
        start_time = time.time()
        
        system_prompt = (
            "You are CodeChamp, an expert code reviewer. "
            "Analyze code for bugs, performance, and complexity. "
            "Return valid JSON ONLY: "
            "{"
            "  'quality_score': 85, "
            "  'time_complexity': 'O(n log n)', "
            "  'space_complexity': 'O(1)', "
            "  'better_than': '85%', "
            "  'summary': 'Brief assessment...', "
            "  'recommendations': ['...', '...'], "
            "  'bugs': [{'line': 1, 'severity': 'Minor', 'description': '...', 'fix_suggestion': '...'}], "
            "  'improvements': [{'category': 'Speed', 'description': '...', 'code_snippet': '...'}], "
            "  'variants': [{'name': 'Fast', 'explanation': '...', 'code': '...'}], "
            "  'optimal_solution': {'code': '...', 'explanation': '...', 'language': '...'}, "
            "  'platform_links': [{'name': 'LeetCode 1', 'url': 'https://leetcode.com/problems/two-sum/'}]"
            "}"
        ).replace("'", '"')

        user_prompt = f"Review and scrape metrics from the following {language} code:\n\n```{language}\n{code}\n```"

        # Check Cache
        cache_key = response_cache._generate_key("code-champ-v4", code, language)
        cached_result = response_cache.get(cache_key)
        if cached_result:
            logger.info("Serving CodeChamp analysis from cache")
            return cached_result

        try:
            result = await self.generate_func(
                prompt=user_prompt,
                system_prompt=system_prompt
            )
            
            if 'error' in result:
                logger.error(f"Generate func returned error: {result['error']}")
                return {'error': result['error']}
            
            content = result.get('response', '') or result.get('content', '')
            logger.debug(f"AI Response Content length: {len(content)}")
            try:
                # Clean up markdown
                if '```json' in content:
                    content = content.split('```json')[1].split('```')[0].strip()
                elif '```' in content:
                    content = content.split('```')[1].split('```')[0].strip()
                
                data = json.loads(content)
                
                # Robust parsing for bugs
                bugs = []
                for b in data.get('bugs', []):
                    if isinstance(b, dict):
                        bugs.append(BugReport(
                            line=b.get('line', 0),
                            severity=b.get('severity', 'Minor'),
                            description=b.get('description', ''),
                            fix_suggestion=b.get('fix_suggestion', '')
                        ))
                    elif isinstance(b, str):
                        bugs.append(BugReport(line=0, severity='Minor', description=b, fix_suggestion=''))

                # Robust parsing for improvements
                improvements = []
                for imp in data.get('improvements', []):
                    if isinstance(imp, dict):
                        improvements.append(ImprovementSuggestion(
                            category=imp.get('category', 'General'),
                            description=imp.get('description', ''),
                            code_snippet=imp.get('code_snippet')
                        ))
                    elif isinstance(imp, str):
                        improvements.append(ImprovementSuggestion(category='General', description=imp, code_snippet=None))

                # Robust parsing for variants
                variants = []
                for v in data.get('variants', []):
                    if isinstance(v, dict):
                        variants.append(CodeVariant(
                            name=v.get('name', 'Alternative'),
                            explanation=v.get('explanation', ''),
                            code=v.get('code', '')
                        ))

                # Optimal solution
                optimal = data.get('optimal_solution')
                if optimal and not isinstance(optimal, dict):
                    optimal = {'code': code, 'explanation': str(optimal), 'language': language}

                result_obj = AnalysisResult(
                    quality_score=data.get('quality_score', 0),
                    time_complexity=data.get('time_complexity', 'N/A'),
                    space_complexity=data.get('space_complexity', 'N/A'),
                    better_than=data.get('better_than', '0%'),
                    summary=data.get('summary', 'No summary provided'),
                    recommendations=data.get('recommendations', []),
                    bugs=bugs,
                    improvements=improvements,
                    variants=variants,
                    optimal_solution=optimal,
                    platform_links=data.get('platform_links', []),
                    processing_time_ms=(time.time() - start_time) * 1000
                )
                
                final_result = asdict(result_obj)
                
                # Cache for 24 hours
                response_cache.set(cache_key, final_result, ttl=86400)
                
                return final_result
                
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON response: {content}")
                return {
                    'error': 'Failed to parse analysis format',
                    'raw_response': content
                }
                
        except Exception as e:
            logger.error(f"Code analysis failed: {e}")
            return {'error': str(e)}

# Singleton instance
code_champ_service = CodeChampService()
