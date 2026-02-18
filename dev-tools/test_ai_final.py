import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add backend path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Mock Flask and dependencies for isolation
sys.modules['flask'] = MagicMock()
sys.modules['flask_cors'] = MagicMock()
sys.modules['flask_sqlalchemy'] = MagicMock()
sys.modules['werkzeug.security'] = MagicMock()
sys.modules['models'] = MagicMock()
sys.modules['routes.auth'] = MagicMock()

# Import the service to test
from services.multi_ai import MultiAIService, HuggingFaceProvider

class TestAIServiceReliability(unittest.TestCase):
    def setUp(self):
        # Mock env vars
        os.environ['HF_TOKEN'] = 'hf_test_token'
        
    @patch('services.multi_ai.InferenceClient')
    def test_huggingface_provider_init(self, MockClient):
        """Test if HuggingFace provider initializes correctly with router URL"""
        provider = HuggingFaceProvider(api_key='test_key')
        
        # Verify call args
        MockClient.assert_called_with(
            base_url="https://router.huggingface.co/v1",
            api_key='test_key'
        )
        print("✅ HuggingFace Provider: Initialization with Router URL OK")

    @patch('services.multi_ai.InferenceClient')
    def test_huggingface_chat(self, MockClient):
        """Test successful chat with HuggingFace"""
        # Mock response
        mock_response = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "I am DeepSeek-R1"
        mock_response.choices = [mock_choice]
        
        # Configure client mock
        mock_client_instance = MockClient.return_value
        mock_client_instance.chat_completion.return_value = mock_response
        
        provider = HuggingFaceProvider(api_key='test_key')
        result = provider.generate("Who are you?")
        
        self.assertEqual(result['model'], 'huggingface')
        self.assertIn('DeepSeek-R1', result['response'])
        print("✅ HuggingFace Provider: Normal Chat OK")

    @patch('services.multi_ai.InferenceClient')
    def test_fallback_logic(self, MockClient):
        """Test fallback logic when Insufficient Balance occurs"""
        # Initialize service with multiple providers
        service = MultiAIService({
            'deepseek': 'sk-empty',
            'huggingface': 'hf-valid'
        })
        
        # Mock DeepSeek provider to fail
        service.providers['deepseek'].generate = MagicMock(return_value={
            'error': 'Insufficient Balance'
        })
        
        # Mock HuggingFace provider to succeed
        service.providers['huggingface'].generate = MagicMock(return_value={
            'response': 'Fallback Success',
            'model': 'huggingface',
            'provider': 'Hugging Face'
        })
        
        # Test chat with 'deepseek' requested
        print("\n>>> Testing Fallback Mechanism...")
        result = service.chat("Help me", model="deepseek")
        
        # Assertions
        self.assertTrue(result.get('fallback_used'), "Fallback should be triggered")
        self.assertEqual(result['model'], 'huggingface', "Should switch to HuggingFace")
        print("✅ System: Fallback Protection OK")

if __name__ == '__main__':
    unittest.main()
