import aiohttp
import logging
import threading
from typing import Optional

# Configure logging
logger = logging.getLogger(__name__)

class ConnectionPool:
    """
    Singleton Wrapper for aiohttp.ClientSession to ensure connection reuse.
    Updated to be thread-safe for Flask threading mode where each request has its own loop.
    """
    _instance = None
    _local = threading.local()
    
    def __init__(self):
        # We don't store session on self anymore, we use _local
        pass
        
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
        
    async def get_session(self) -> aiohttp.ClientSession:
        """Get or create the thread-local client session."""
        import asyncio
        
        # Get current loop (we are in async context here)
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = asyncio.get_event_loop()

        # Check if session exists for this thread
        if hasattr(self._local, 'session') and self._local.session and not self._local.session.closed:
            # CRITICAL: Check if the session belongs to the CURRENT loop
            if self._local.session.loop is not current_loop:
                logger.warning(f"Thread {threading.get_ident()}: Session loop {id(self._local.session.loop)} != Current loop {id(current_loop)}. Recreating session.")
                try:
                    await self._local.session.close()
                except:
                    pass
                self._local.session = None

        if not hasattr(self._local, 'session') or self._local.session is None or self._local.session.closed:
            logger.info(f"Initializing connection pool for thread {threading.get_ident()} on loop {id(current_loop)}...")
            
            # Optimized connector settings
            # Note: Connector triggers loop check, so must be created inside the loop
            connector = aiohttp.TCPConnector(
                limit=100, 
                limit_per_host=20, 
                ttl_dns_cache=300,
                enable_cleanup_closed=True
            )
            
            # Default timeout can be overridden per request
            timeout = aiohttp.ClientTimeout(total=60, connect=10)
            
            self._local.session = aiohttp.ClientSession(
                connector=connector, 
                timeout=timeout,
                loop=current_loop # Explicitly bind to current loop
            )
        return self._local.session
        
    async def close(self):
        """Gracefully close the current thread's session."""
        if hasattr(self._local, 'session') and self._local.session and not self._local.session.closed:
            logger.info(f"Closing connection pool for thread {threading.get_ident()}...")
            await self._local.session.close()
            self._local.session = None

# Global instance
global_connection_pool = ConnectionPool.get_instance()
