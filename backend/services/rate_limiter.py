import asyncio
import time
import logging
from typing import Optional

# Configure logging
logger = logging.getLogger(__name__)

class RateLimiter:
    """
    Async implementation of Token Bucket algorithm for rate limiting.
    """
    
    def __init__(self, signs_per_second: float = 5.0, capacity: int = 10):
        self.rate = signs_per_second
        self.capacity = float(capacity)
        self.tokens = float(capacity)
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: int = 1):
        """
        Acquire tokens, waiting if necessary.
        """
        async with self._lock:
            while True:
                self._refill()
                
                if self.tokens >= tokens:
                    self.tokens -= tokens
                    return
                
                # Not enough tokens, wait
                wait_time = (tokens - self.tokens) / self.rate
                if wait_time < 0.01:
                    wait_time = 0.01
                
                logger.debug(f"Rate limit hit. Waiting {wait_time:.2f}s")
                # Release lock while waiting? 
                # Ideally yes, but here we are inside lock. 
                # If we await sleep inside lock, no one else can acquire or refill.
                # BUT refill is computed on access. No background thread refilling.
                # So if we sleep with lock, we block everyone.
                # Correct pattern: calculate wait, release lock, sleep, retry.
                # However, simplistic: just sleep. But blocking others is bad if parallel requests.
                
                # Better approach:
                # 1. Calculate deficit
                # 2. Update state to "reserve" tokens in future?
                # 3. Or just sleep with lock if contention is low.
                
                # Let's try the sleep-with-lock for simplicity as this is per-provider limiter.
                # If multiple requests come, they queue up. This is actually desired for strict ordering/politeness.
                await asyncio.sleep(wait_time)

    def _refill(self):
        """Refill tokens based on time elapsed."""
        now = time.monotonic()
        elapsed = now - self.last_refill
        
        new_tokens = elapsed * self.rate
        if new_tokens > 0:
            self.tokens = min(self.capacity, self.tokens + new_tokens)
            self.last_refill = now

# Global instance (e.g. 5 requests/sec, burst 10)
# DeepSeek rate limits are generous but good to be safe
rate_limiter = RateLimiter(signs_per_second=5.0, capacity=10)
