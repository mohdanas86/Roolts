"""
Environment Cleanup Utility
Background service to clean up idle and old virtual environments.
"""

from datetime import datetime, timedelta
from models import db, VirtualEnvironment
from services.docker_manager import get_docker_manager


class EnvironmentCleanup:
    """Manages cleanup of idle and old environments."""
    
    def __init__(self):
        """Initialize cleanup service."""
        self.docker_manager = get_docker_manager()
    
    def cleanup_idle_environments(self, idle_minutes: int = 30) -> int:
        """
        Stop environments that have been idle for specified minutes.
        
        Args:
            idle_minutes: Minutes of inactivity before stopping
        
        Returns:
            Number of environments stopped
        """
        try:
            threshold = datetime.utcnow() - timedelta(minutes=idle_minutes)
            
            # Find running environments that haven't been accessed recently
            idle_envs = VirtualEnvironment.query.filter(
                VirtualEnvironment.status == 'running',
                VirtualEnvironment.last_accessed_at < threshold
            ).all()
            
            stopped_count = 0
            for env in idle_envs:
                try:
                    self.docker_manager.stop_environment(env.container_id)
                    env.status = 'stopped'
                    db.session.commit()
                    stopped_count += 1
                    print(f"[OK] Stopped idle environment: {env.name} (ID: {env.id})")
                except Exception as e:
                    print(f"[WARN] Failed to stop environment {env.id}: {e}")
            
            return stopped_count
        
        except Exception as e:
            print(f"❌ Cleanup failed: {e}")
            return 0
    
    def cleanup_old_environments(self, days: int = 7) -> int:
        """
        Destroy environments that haven't been used in specified days.
        
        Args:
            days: Days of inactivity before destruction
        
        Returns:
            Number of environments destroyed
        """
        try:
            threshold = datetime.utcnow() - timedelta(days=days)
            
            # Find environments that haven't been accessed in a long time
            old_envs = VirtualEnvironment.query.filter(
                VirtualEnvironment.status.in_(['stopped', 'error']),
                VirtualEnvironment.last_accessed_at < threshold
            ).all()
            
            destroyed_count = 0
            for env in old_envs:
                try:
                    if env.container_id:
                        self.docker_manager.destroy_environment(
                            env.container_id,
                            env.volume_name
                        )
                    
                    env.status = 'destroyed'
                    env.destroyed_at = datetime.utcnow()
                    db.session.commit()
                    destroyed_count += 1
                    print(f"[OK] Destroyed old environment: {env.name} (ID: {env.id})")
                except Exception as e:
                    print(f"[WARN] Failed to destroy environment {env.id}: {e}")
            
            return destroyed_count
        
        except Exception as e:
            print(f"❌ Cleanup failed: {e}")
            return 0
    
    def cleanup_orphaned_containers(self) -> int:
        """
        Clean up Docker containers that don't have database records.
        
        Returns:
            Number of orphaned containers removed
        """
        try:
            # Get all roolts containers
            all_containers = self.docker_manager.client.containers.list(
                all=True,
                filters={'label': 'roolts.user_id'}
            )
            
            removed_count = 0
            for container in all_containers:
                container_id = container.id
                
                # Check if container exists in database
                env = VirtualEnvironment.query.filter_by(
                    container_id=container_id
                ).first()
                
                if not env:
                    # Orphaned container - remove it
                    try:
                        container.remove(force=True)
                        removed_count += 1
                        print(f"[OK] Removed orphaned container: {container_id[:12]}")
                    except Exception as e:
                        print(f"[WARN] Failed to remove orphaned container {container_id[:12]}: {e}")
            
            return removed_count
        
        except Exception as e:
            print(f"❌ Orphan cleanup failed: {e}")
            return 0
    
    def get_cleanup_stats(self) -> dict:
        """
        Get statistics about environments that need cleanup.
        
        Returns:
            Dictionary with cleanup statistics
        """
        try:
            total_envs = VirtualEnvironment.query.filter(
                VirtualEnvironment.status != 'destroyed'
            ).count()
            
            running_envs = VirtualEnvironment.query.filter_by(
                status='running'
            ).count()
            
            stopped_envs = VirtualEnvironment.query.filter_by(
                status='stopped'
            ).count()
            
            # Idle environments (running but not accessed in 30 minutes)
            idle_threshold = datetime.utcnow() - timedelta(minutes=30)
            idle_envs = VirtualEnvironment.query.filter(
                VirtualEnvironment.status == 'running',
                VirtualEnvironment.last_accessed_at < idle_threshold
            ).count()
            
            # Old environments (not accessed in 7 days)
            old_threshold = datetime.utcnow() - timedelta(days=7)
            old_envs = VirtualEnvironment.query.filter(
                VirtualEnvironment.status.in_(['stopped', 'error']),
                VirtualEnvironment.last_accessed_at < old_threshold
            ).count()
            
            return {
                'total_environments': total_envs,
                'running': running_envs,
                'stopped': stopped_envs,
                'idle_candidates': idle_envs,
                'old_candidates': old_envs
            }
        
        except Exception as e:
            print(f"❌ Failed to get stats: {e}")
            return {}


# Singleton instance
_cleanup_service = None


def get_cleanup_service() -> EnvironmentCleanup:
    """Get or create the cleanup service singleton."""
    global _cleanup_service
    if _cleanup_service is None:
        _cleanup_service = EnvironmentCleanup()
    return _cleanup_service


# CLI interface for manual cleanup
if __name__ == "__main__":
    import sys
    
    cleanup = get_cleanup_service()
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == 'idle':
            minutes = int(sys.argv[2]) if len(sys.argv) > 2 else 30
            count = cleanup.cleanup_idle_environments(minutes)
            print(f"\n[OK] Stopped {count} idle environments")
        
        elif command == 'old':
            days = int(sys.argv[2]) if len(sys.argv) > 2 else 7
            count = cleanup.cleanup_old_environments(days)
            print(f"\n[OK] Destroyed {count} old environments")
        
        elif command == 'orphans':
            count = cleanup.cleanup_orphaned_containers()
            print(f"\n[OK] Removed {count} orphaned containers")
        
        elif command == 'stats':
            stats = cleanup.get_cleanup_stats()
            print("\n📊 Environment Statistics:")
            for key, value in stats.items():
                print(f"  {key}: {value}")
        
        else:
            print("Usage: python environment_cleanup.py [idle|old|orphans|stats] [value]")
    else:
        print("Usage: python environment_cleanup.py [idle|old|orphans|stats] [value]")
        print("\nCommands:")
        print("  idle [minutes]   - Stop idle environments (default: 30 minutes)")
        print("  old [days]       - Destroy old environments (default: 7 days)")
        print("  orphans          - Remove orphaned Docker containers")
        print("  stats            - Show environment statistics")
