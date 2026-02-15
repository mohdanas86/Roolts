import os
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    """User account model."""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(100))
    profile_image = db.Column(db.String(500))
    bio = db.Column(db.Text)
    tagline = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # API Keys (encrypted in production)
    gemini_api_key = db.Column(db.String(500))
    claude_api_key = db.Column(db.String(500))
    deepseek_api_key = db.Column(db.String(500))
    qwen_api_key = db.Column(db.String(500))
    
    # Relationships
    social_tokens = db.relationship('SocialToken', back_populates='user', cascade='all, delete-orphan')
    
    def set_password(self, password):
        """Hash and set the user's password."""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verify the user's password."""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convert user to dictionary (safe for JSON response)."""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'profile_image': self.profile_image,
            'bio': self.bio,
            'tagline': self.tagline,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'has_gemini_key': bool(self.gemini_api_key),
            'has_claude_key': bool(self.claude_api_key),
            'has_deepseek_key': bool(self.deepseek_api_key),
            'has_qwen_key': bool(self.qwen_api_key),
            'connected_socials': [t.platform for t in self.social_tokens if t.is_valid()]
        }


class SocialToken(db.Model):
    """OAuth tokens for social media platforms."""
    __tablename__ = 'social_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    platform = db.Column(db.String(50), nullable=False)  # 'twitter' or 'linkedin'
    access_token = db.Column(db.String(1000), nullable=False)
    refresh_token = db.Column(db.String(1000))
    token_type = db.Column(db.String(50))
    expires_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Platform-specific data
    platform_user_id = db.Column(db.String(100))
    platform_username = db.Column(db.String(100))
    
    # Relationship
    user = db.relationship('User', back_populates='social_tokens')
    
    def is_valid(self):
        """Check if the token is still valid."""
        if not self.expires_at:
            return True
        return datetime.utcnow() < self.expires_at
    
    def to_dict(self):
        """Convert token to dictionary."""
        return {
            'platform': self.platform,
            'platform_user_id': self.platform_user_id,
            'platform_username': self.platform_username,
            'is_valid': self.is_valid(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None
        }


class Snippet(db.Model):
    """User code snippets."""
    __tablename__ = 'snippets'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Optional for now
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    language = db.Column(db.String(50), default='plaintext')
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert snippet to dictionary."""
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'language': self.language,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class VirtualEnvironment(db.Model):
    """User virtual development environments."""
    __tablename__ = 'virtual_environments'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    environment_type = db.Column(db.String(50), nullable=False)  # 'nodejs', 'python', 'fullstack', 'cpp'
    container_id = db.Column(db.String(100), unique=True)  # Docker container ID
    status = db.Column(db.String(20), default='creating')  # 'creating', 'running', 'stopped', 'error', 'destroyed'
    volume_name = db.Column(db.String(100))  # Docker volume for persistent storage
    
    # Resource tracking
    cpu_limit = db.Column(db.Float, default=1.0)  # CPU cores
    memory_limit = db.Column(db.Integer, default=512)  # MB
    disk_limit = db.Column(db.Integer, default=1024)  # MB
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_accessed_at = db.Column(db.DateTime, default=datetime.utcnow)
    destroyed_at = db.Column(db.DateTime)
    
    # Relationships
    logs = db.relationship('EnvironmentLog', back_populates='environment', cascade='all, delete-orphan')
    sessions = db.relationship('EnvironmentSession', back_populates='environment', cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert environment to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'type': self.environment_type,
            'container_id': self.container_id,
            'status': self.status,
            'resources': {
                'cpu_limit': self.cpu_limit,
                'memory_limit': self.memory_limit,
                'disk_limit': self.disk_limit
            },
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_accessed_at': self.last_accessed_at.isoformat() if self.last_accessed_at else None
        }
    
    def update_access_time(self):
        """Update the last accessed timestamp."""
        self.last_accessed_at = datetime.utcnow()


class EnvironmentSession(db.Model):
    """Active sessions for virtual environments."""
    __tablename__ = 'environment_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    environment_id = db.Column(db.Integer, db.ForeignKey('virtual_environments.id'), nullable=False)
    session_token = db.Column(db.String(100), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    environment = db.relationship('VirtualEnvironment', back_populates='sessions')
    
    def is_valid(self):
        """Check if session is still valid."""
        return self.is_active and datetime.utcnow() < self.expires_at
    
    def to_dict(self):
        """Convert session to dictionary."""
        return {
            'id': self.id,
            'environment_id': self.environment_id,
            'session_token': self.session_token,
            'is_active': self.is_active,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_valid': self.is_valid()
        }


class EnvironmentLog(db.Model):
    """Audit logs for environment operations."""
    __tablename__ = 'environment_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    environment_id = db.Column(db.Integer, db.ForeignKey('virtual_environments.id'), nullable=False)
    action_type = db.Column(db.String(50), nullable=False)  # 'command', 'install', 'file_create', 'file_delete', etc.
    command = db.Column(db.Text)  # The actual command or operation
    status = db.Column(db.String(20))  # 'success', 'error', 'blocked'
    output = db.Column(db.Text)  # Command output or error message
    execution_time = db.Column(db.Float)  # Execution time in seconds
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    environment = db.relationship('VirtualEnvironment', back_populates='logs')
    
    def to_dict(self):
        """Convert log to dictionary."""
        return {
            'id': self.id,
            'environment_id': self.environment_id,
            'action_type': self.action_type,
            'command': self.command,
            'status': self.status,
            'output': self.output,
            'execution_time': self.execution_time,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


def init_db(app):
    """Initialize the database with the Flask app."""
    # Configure SQLite database
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL', 
        'sqlite:///roolts.db'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
    
    return db


if __name__ == "__main__":
    print("="*50)
    print("[OK] models.py execution successful")
    print("="*50)
    print("This file defines the database models for Roolts.")
    print("\n[Available Models]")
    print(f"- User: {User}")
    print(f"- SocialToken: {SocialToken}")
    print(f"- Snippet: {Snippet}")
    print(f"- VirtualEnvironment: {VirtualEnvironment}")
    print(f"- EnvironmentSession: {EnvironmentSession}")
    print(f"- EnvironmentLog: {EnvironmentLog}")
    print("\nNote: This file is intended to be imported by the Flask app.")
    print("To start the backend server, run 'app.py' instead.")

