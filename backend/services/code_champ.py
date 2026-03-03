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

    TONE_INSTRUCTIONS = {
        'standard': '',
        'beginner': (
            '\n\nTONE INSTRUCTION: Explain everything as if teaching a complete beginner. '
            'Use simple language, avoid jargon, and explain technical terms when you must use them. '
            'Use analogies and real-world comparisons. Be encouraging and supportive.'
        ),
        'concise': (
            '\n\nTONE INSTRUCTION: Be extremely concise and direct. No fluff, no filler. '
            'Use bullet points. Keep the summary under 2 sentences. Keep recommendations short and actionable.'
        ),
        'detailed': (
            '\n\nTONE INSTRUCTION: Be thorough and detailed. Explain WHY each issue matters. '
            'Provide in-depth explanations of time/space complexity trade-offs. '
            'Include edge cases and potential pitfalls in your analysis.'
        ),
        'humorous': (
            '\n\nTONE INSTRUCTION: Be witty and fun while staying technically accurate. '
            'Use humor, clever analogies, and playful language. Make the code review entertaining '
            'to read while still being genuinely helpful. Add occasional coding jokes or puns.'
        ),
    }

    async def analyze_code(self, code: str, language: str = "python", tone: str = "standard") -> Dict[str, Any]:
        """
        Analyze code for bugs, quality issues, and competitive programming metrics.
        """
        if not self.generate_func:
            return {'error': 'Analysis engine (generate_func) not configured'}
            
        start_time = time.time()

        tone_instruction = self.TONE_INSTRUCTIONS.get(tone, '')
        
        system_prompt = (
            "You are CodeChamp, an expert competitive programming analyst and code reviewer. "
            "CRITICAL: You MUST return ONLY a raw JSON object. NO markdown code fences (no ```json), NO explanations before or after the JSON. OUTPUT ONLY THE JSON OBJECT.\n\n"
            "Your PRIMARY task is to:\n"
            "1. IDENTIFY the specific algorithm/problem the code is solving (e.g. 'Two Sum', 'Binary Search', 'Merge Sort', 'DFS on Graph')\n"
            "2. Analyze code for bugs, performance, and complexity\n"
            "3. Provide the OPTIMAL solution for THIS SPECIFIC problem — not a generic template\n"
            "4. Provide 1-3 approach variants (e.g. brute force O(n²) → hashmap O(n))\n\n"
            "Be objective: only report genuine bugs, not style preferences. "
            "The optimal_solution MUST be a complete, runnable solution for the IDENTIFIED problem. "
            "Return ONLY valid JSON (no markdown fences, no preamble, no postamble). Template: "
            "{"
            '  "quality_score": 85, '
            '  "time_complexity": "O(n log n)", '
            '  "space_complexity": "O(1)", '
            '  "better_than": "85%", '
            '  "detected_problem": "Two Sum", '
            '  "summary": "This code solves Two Sum using a brute force approach...", '
            '  "recommendations": ["Use a hashmap for O(n) lookup", "..."], '
            '  "bugs": [{"line": 1, "severity": "Minor", "description": "...", "fix_suggestion": "..."}], '
            '  "improvements": [{"category": "Speed", "description": "...", "code_snippet": "..."}], '
            '  "variants": [{"name": "Hashmap Approach (Optimal)", "explanation": "Uses a hashmap to achieve O(n)...", "code": "class Solution:\\n    def twoSum(self, nums, target):\\n        seen = {}\\n        for i, n in enumerate(nums):\\n            if target - n in seen:\\n                return [seen[target-n], i]\\n            seen[n] = i"}], '
            '  "optimal_solution": {"code": "COMPLETE OPTIMAL SOLUTION CODE HERE", "explanation": "Detailed explanation of the optimal approach for THIS problem...", "language": "python"}, '
            '  "platform_links": [{"name": "LeetCode: Two Sum", "url": "https://leetcode.com/problems/two-sum/"}]'
            "}"
            f"{tone_instruction}"
        )

        user_prompt = f"Identify the algorithm/problem and review the following {language} code. Provide the optimal solution for THIS SPECIFIC problem. Return ONLY a JSON object (no markdown, no code fences):\n\n```{language}\n{code}\n```"


        # Check Cache
        cache_key = response_cache._generate_key("code-champ-v6", code, language)
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
            
            if result.get('is_mock'):
                return {
                    'quality_score': 0,
                    'time_complexity': 'OFFLINE',
                    'space_complexity': 'OFFLINE',
                    'better_than': '0%',
                    'is_mock': True,
                    'summary': result.get('response', 'AI is currently offline.'),
                    'recommendations': ['Configure an AI API key in Settings to enable code analysis.'],
                    'bugs': [],
                    'improvements': [],
                    'variants': [],
                    'optimal_solution': None,
                    'platform_links': []
                }

            content = result.get('response', '') or result.get('content', '')
            logger.debug(f"AI Response Content length: {len(content)}")
            try:
                import re
                
                # Step 1: Strip thinking tags
                content_clean = re.sub(r'<think>[\s\S]*?</think>', '', content).strip()
                
                # Step 2: Try to extract JSON — multiple strategies
                data = None
                
                # Strategy A: Direct JSON parse
                try:
                    data = json.loads(content_clean)
                except json.JSONDecodeError:
                    pass
                
                # Strategy B: Extract from markdown code fence
                if data is None:
                    fence_match = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', content_clean)
                    if fence_match:
                        try:
                            data = json.loads(fence_match.group(1).strip())
                        except json.JSONDecodeError:
                            pass
                
                # Strategy C: Greedy brace matching (find outermost { ... })
                if data is None:
                    brace_start = content_clean.find('{')
                    if brace_start != -1:
                        # Find matching closing brace by counting depth
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
                            try:
                                data = json.loads(content_clean[brace_start:brace_end])
                            except json.JSONDecodeError:
                                # Try fixing common issues: single quotes, trailing commas
                                raw = content_clean[brace_start:brace_end]
                                raw = raw.replace("'", '"')
                                raw = re.sub(r',\s*([}\]])', r'\1', raw)
                                try:
                                    data = json.loads(raw)
                                except json.JSONDecodeError:
                                    pass
                
                # Strategy D: Final fallback — generate a basic analysis from the text
                if data is None:
                    logger.warning(f"All JSON parse strategies failed, using text fallback")
                    data = {
                        'quality_score': 70,
                        'time_complexity': 'Unable to determine',
                        'space_complexity': 'Unable to determine',
                        'better_than': '50%',
                        'summary': content_clean[:500] if content_clean else 'AI returned a non-structured response.',
                        'recommendations': ['Re-analyze by clicking the Analyze button.'],
                        'bugs': [],
                        'improvements': [],
                        'variants': [],
                        'optimal_solution': None,
                        'platform_links': []
                    }
                
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
                
            except Exception as parse_err:
                logger.error(f"Failed to parse/process AI response: {parse_err}")
                # Return a minimal but valid analysis instead of an error
                return {
                    'quality_score': 60,
                    'time_complexity': 'N/A',
                    'space_complexity': 'N/A',
                    'better_than': '50%',
                    'summary': 'Analysis could not be fully parsed. Try clicking Analyze again.',
                    'recommendations': ['Re-analyze your code by clicking the Analyze button.'],
                    'bugs': [],
                    'improvements': [],
                    'variants': [],
                    'optimal_solution': None,
                    'platform_links': [],
                    'processing_time_ms': (time.time() - start_time) * 1000
                }
                
        except Exception as e:
            logger.error(f"Code analysis failed: {e}")
            return {'error': str(e)}

# Singleton instance
code_champ_service = CodeChampService()
