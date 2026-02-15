import logging
import json
import time
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional

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
    processing_time_ms: float = 0.0

class CodeChampService:
    """
    Service for automated code review and bug detection (CodeChamp).
    """
    
    def __init__(self, provider: Optional[AsyncDeepSeekProvider] = None):
        self.provider = provider or AsyncDeepSeekProvider()

    async def analyze_code(self, code: str, language: str = "python") -> Dict[str, Any]:
        """
        Analyze code for bugs, quality issues, and competitive programming metrics.
        """
        start_time = time.time()
        
        system_prompt = (
            "You are CodeChamp, an elite automated code reviewer and competitive programming expert. "
            "Analyze the provided code for bugs, performance bottlenecks, and algorithmic efficiency. "
            "SCRAPING REQUIREMENT: Act like a deep code scraper. Extract and identify time and space complexity. "
            "Provide alternative 'scraped' variants that might be more optimal. "
            "You must return your response in valid JSON format ONLY. "
            "The JSON structure must be: "
            "{"
            "  'quality_score': 85, "
            "  'time_complexity': 'O(n log n)', "
            "  'space_complexity': 'O(n)', "
            "  'better_than': '85%', "
            "  'summary': 'Overall assessment...', "
            "  'recommendations': ['...', '...'], "
            "  'bugs': ["
            "    {'line': 10, 'severity': 'Critical', 'description': '...', 'fix_suggestion': '...'}"
            "  ], "
            "  'improvements': ["
            "    {'category': 'Performance', 'description': '...', 'code_snippet': '...'}"
            "  ], "
            "  'variants': ["
            "    {'name': 'Iterative', 'explanation': '...', 'code': '...'}"
            "  ], "
            "  'optimal_solution': {'code': '...', 'explanation': '...', 'language': '...'}"
            "}"
        ).replace("'", '"')

        user_prompt = f"Review and scrape metrics from the following {language} code:\n\n```{language}\n{code}\n```"

        # Check Cache
        cache_key = response_cache._generate_key("code-champ-v2", code, language)
        cached_result = response_cache.get(cache_key)
        if cached_result:
            logger.info("Serving CodeChamp analysis from cache")
            return cached_result

        try:
            result = await self.provider.generate_async(
                prompt=user_prompt,
                system_prompt=system_prompt
            )
            
            if 'error' in result:
                return {'error': result['error']}
            
            content = result.get('response', '') or result.get('content', '')
            try:
                # Clean up markdown
                if '```json' in content:
                    content = content.split('```json')[1].split('```')[0].strip()
                elif '```' in content:
                    content = content.split('```')[1].split('```')[0].strip()
                
                data = json.loads(content)
                
                # Parse Bugs
                bugs = []
                for b in data.get('bugs', []):
                    bugs.append(BugReport(
                        line=b.get('line', 0),
                        severity=b.get('severity', 'Minor'),
                        description=b.get('description', 'Unknown bug'),
                        fix_suggestion=b.get('fix_suggestion', '')
                    ))

                # Parse Improvements
                improvements = []
                for i in data.get('improvements', []):
                    improvements.append(ImprovementSuggestion(
                        category=i.get('category', 'General'),
                        description=i.get('description', ''),
                        code_snippet=i.get('code_snippet')
                    ))
                
                # Parse Variants
                variants = []
                for v in data.get('variants', []):
                    variants.append(CodeVariant(
                        name=v.get('name', 'Alternative'),
                        explanation=v.get('explanation', ''),
                        code=v.get('code', '')
                    ))

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
                    optimal_solution=data.get('optimal_solution'),
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
