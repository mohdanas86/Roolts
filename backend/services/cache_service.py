import time
import hashlib
import json
import logging
from typing import Dict, Any, Optional, Tuple, Callable, Awaitable

# Configure logging
logger = logging.getLogger(__name__)

class ResponseCache:
    """
    Simple in-memory cache with TTL for AI responses.
    """
    
    def __init__(self, default_ttl: int = 3600):
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self.default_ttl = default_ttl
        self.hits = 0
        self.misses = 0

    def _generate_key(self, *args, **kwargs) -> str:
        """Generate a consistent cache key from arguments."""
        # Convert args/kwargs to a stable string representation
        key_content = json.dumps({
            'args': args,
            'kwargs': kwargs
        }, sort_keys=True, default=str)
        
        return hashlib.md5(key_content.encode('utf-8')).hexdigest()

    def get(self, key: str) -> Optional[Any]:
        """Retrieve item from cache if valid."""
        if key in self._cache:
            value, expiry = self._cache[key]
            if time.time() < expiry:
                self.hits += 1
                logger.debug(f"Cache HIT for {key}")
                return value
            else:
                # Expired
                del self._cache[key]
        
        self.misses += 1
        logger.debug(f"Cache MISS for {key}")
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Store item in cache."""
        expiry = time.time() + (ttl or self.default_ttl)
        self._cache[key] = (value, expiry)

    def clear(self):
        """Clear all cache."""
        self._cache.clear()
        self.hits = 0
        self.misses = 0

    def get_stats(self) -> Dict[str, int]:
        return {
            'hits': self.hits,
            'misses': self.misses,
            'size': len(self._cache)
        }

# Global instance
response_cache = ResponseCache()
