import logging
import time
import statistics
from typing import Dict, Any, List

# Configure logging
logger = logging.getLogger(__name__)

class PerformanceMonitor:
    """
    Service to track and report AI provider performance metrics.
    """
    _instance = None
    
    def __init__(self):
        self.metrics: Dict[str, Dict[str, Any]] = {}
        # Structure:
        # {
        #   'deepseek': {
        #     'requests': 0,
        #     'errors': 0,
        #     'latencies': [], # Keep last N
        #     'total_tokens': 0
        #   }
        # }
        self.max_latency_history = 100

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def record_request(self, provider: str, duration: float, success: bool, tokens: int = 0):
        """Record a completed request."""
        if provider not in self.metrics:
            self.metrics[provider] = {
                'requests': 0,
                'errors': 0,
                'latencies': [],
                'total_tokens': 0
            }
        
        stats = self.metrics[provider]
        stats['requests'] += 1
        if not success:
            stats['errors'] += 1
        else:
            stats['latencies'].append(duration)
            if len(stats['latencies']) > self.max_latency_history:
                stats['latencies'].pop(0)
            stats['total_tokens'] += tokens

    def get_stats(self, provider: str = None) -> Dict[str, Any]:
        """Get stats for a provider or all."""
        if provider:
            stats = self.metrics.get(provider, {})
            latencies = stats.get('latencies', [])
            avg_latency = statistics.mean(latencies) if latencies else 0.0
            p95 = statistics.quantiles(latencies, n=20)[-1] if len(latencies) > 1 else 0.0
            
            return {
                'requests': stats.get('requests', 0),
                'errors': stats.get('errors', 0),
                'avg_latency': round(avg_latency, 3),
                'p95_latency': round(p95, 3),
                'total_tokens': stats.get('total_tokens', 0)
            }
        
        return {p: self.get_stats(p) for p in self.metrics}

# Global instance
performance_monitor = PerformanceMonitor.get_instance()
