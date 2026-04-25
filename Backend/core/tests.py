from unittest.mock import patch, MagicMock

from django.test import TestCase

from core.models import ExpirationKnowledge
from core.services.item_verifier import verify_and_enrich_items

class ItemVerifierTests(TestCase):
    def test_verify_uses_knowledge_base_bypassing_ai(self):
        """Test that if an item exists in the ExpirationKnowledge DB, the AI is bypassed."""
        ExpirationKnowledge.objects.create(
            food_name="Apple",
            category_tag="produce",
            expiration_days=10,
            image_url="http://apple.com/a.jpg",
            description="Red fruit"
        )
        raw_items = [{"name": "Apple", "quantity": 1}]
        
        # We don't patch genai here; if it tries to use genai it will fail without an API key, proving it bypassed it.
        enriched = verify_and_enrich_items(raw_items)
        
        self.assertEqual(len(enriched), 1)
        self.assertEqual(enriched[0]["standardized_name"], "Apple")
        self.assertEqual(enriched[0]["category_tag"], "produce")
        self.assertEqual(enriched[0]["expiration_days"], 10)
        self.assertEqual(enriched[0]["image_url"], "http://apple.com/a.jpg")
        self.assertEqual(enriched[0]["description"], "Red fruit")

    @patch('core.services.item_verifier.DDGS')
    @patch('core.services.item_verifier.genai.Client')
    def test_verify_uses_gemini_and_ddgs_for_new_items(self, mock_client_class, mock_ddgs_class):
        """Test that new items are sent to Gemini and DDGS, and then saved to the DB."""
        # Mock Gemini response
        mock_response = MagicMock()
        mock_response.text = '[{"name": "bnn", "standardized_name": "Banana", "category_tag": "produce", "expiration_days": 7, "estimated_price": 0.5, "description": "Yellow fruit"}]'
        
        mock_models = MagicMock()
        mock_models.generate_content.return_value = mock_response
        
        mock_client_instance = MagicMock()
        mock_client_instance.models = mock_models
        mock_client_class.return_value = mock_client_instance
        
        # Mock DDGS response
        mock_ddgs_instance = MagicMock()
        mock_ddgs_instance.text.return_value = [{"title": "Banana info"}]
        mock_ddgs_instance.images.return_value = [{"image": "http://banana.com/b.jpg"}]
        mock_ddgs_instance.__enter__.return_value = mock_ddgs_instance
        mock_ddgs_class.return_value = mock_ddgs_instance
        
        raw_items = [{"name": "bnn", "quantity": 2}]
        with patch('core.services.item_verifier.settings', GEMINI_API_KEY="fake-key"):
            enriched = verify_and_enrich_items(raw_items, store_name="Grocery")
        
        self.assertEqual(len(enriched), 1)
        self.assertEqual(enriched[0]["standardized_name"], "Banana")
        self.assertEqual(enriched[0]["category_tag"], "produce")
        self.assertEqual(enriched[0]["expiration_days"], 7)
        self.assertEqual(enriched[0]["description"], "Yellow fruit")
        self.assertEqual(enriched[0]["image_url"], "http://banana.com/b.jpg")
        
        # Ensure the new knowledge was saved to the database
        kb = ExpirationKnowledge.objects.filter(food_name="Banana").first()
        self.assertIsNotNone(kb)
        self.assertEqual(kb.category_tag, "produce")
        self.assertEqual(kb.expiration_days, 7)
        self.assertEqual(kb.image_url, "http://banana.com/b.jpg")
        self.assertEqual(kb.description, "Yellow fruit")
