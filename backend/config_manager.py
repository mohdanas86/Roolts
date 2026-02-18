import os
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError

# Load .env file
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

class AIConfig(BaseModel):
    gemini_api_key: Optional[str] = Field(default=None, alias='GEMINI_API_KEY')
    claude_api_key: Optional[str] = Field(default=None, alias='CLAUDE_API_KEY')
    deepseek_api_key: Optional[str] = Field(default=None, alias='DEEPSEEK_API_KEY')
    qwen_api_key: Optional[str] = Field(default=None, alias='QWEN_API_KEY')
    hf_token: Optional[str] = Field(default=None, alias='HF_TOKEN')
    openai_api_key: Optional[str] = Field(default=None, alias='OPENAI_API_KEY')

    def validate_deepseek_key(self) -> bool:
        """Check if DeepSeek key appears valid."""
        if not self.deepseek_api_key:
            return False
            
        # Reject placeholders
        if self.deepseek_api_key.startswith('your-'):
            return False
            
        return len(self.deepseek_api_key) > 5

class AppConfig(BaseModel):
    flask_env: str = Field(default='development', alias='FLASK_ENV')
    flask_debug: bool = Field(default=True, alias='FLASK_DEBUG')
    secret_key: str = Field(default='dev-key', alias='SECRET_KEY')
    database_url: str = Field(default='sqlite:///roolts.db', alias='DATABASE_URL')
    
    ai: AIConfig = Field(default_factory=AIConfig)

class ConfigManager:
    _instance = None
    
    def __init__(self):
        # Load environment variables into Pydantic models
        # We use os.environ to populate the fields
        
        # Helper to get env vars loosely
        ai_data = {
            'GEMINI_API_KEY': os.getenv('GEMINI_API_KEY'),
            'CLAUDE_API_KEY': os.getenv('CLAUDE_API_KEY'),
            'DEEPSEEK_API_KEY': os.getenv('DEEPSEEK_API_KEY'),
            'QWEN_API_KEY': os.getenv('QWEN_API_KEY'),
            'HF_TOKEN': os.getenv('HF_TOKEN'),
            'OPENAI_API_KEY': os.getenv('OPENAI_API_KEY'),
        }
        
        app_data = {
            'FLASK_ENV': os.getenv('FLASK_ENV', 'development'),
            'FLASK_DEBUG': os.getenv('FLASK_DEBUG', '1') == '1',
            'SECRET_KEY': os.getenv('SECRET_KEY', 'dev-key'),
            'DATABASE_URL': os.getenv('DATABASE_URL', 'sqlite:///roolts.db'),
            'ai': ai_data
        }
        
        try:
            self.config = AppConfig(**app_data)
        except ValidationError as e:
            print(f"Configuration Error: {e}")
            # Fallback to defaults if validation fails totally, though defaults are set
            self.config = AppConfig()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def ai(self) -> AIConfig:
        return self.config.ai

    @property
    def app(self) -> AppConfig:
        return self.config

    def get_deepseek_key(self) -> Optional[str]:
        """Get DeepSeek key if valid."""
        if self.config.ai.validate_deepseek_key():
            return self.config.ai.deepseek_api_key
        return None

# Global instance for easy import
config_manager = ConfigManager.get_instance()
