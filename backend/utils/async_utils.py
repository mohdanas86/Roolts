import asyncio

def run_async(coro):
    """
    Helper to run async coroutines in synchronous Flask routes.
    This bypasses conflicts between Flask's async handling (asgiref) and 
    other event loops (like SocketIO/eventlet).
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    # Check if loop is closed
    if loop.is_closed():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    # With nest_asyncio applied in app.py, this works even if the loop is already running
    return loop.run_until_complete(coro)
