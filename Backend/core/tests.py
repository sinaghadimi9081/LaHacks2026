from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import ExpirationKnowledge, SharePost
from core.services.item_verifier import verify_and_enrich_items

User = get_user_model()

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


class SharePostApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password="safe-password-123",
            display_name="Owner User",
        )
        self.claimer = User.objects.create_user(
            username="claimer",
            email="claimer@example.com",
            password="safe-password-123",
            display_name="Claimer User",
        )
        self.owner_client = APIClient()
        self.owner_client.force_authenticate(self.owner)
        self.claimer_client = APIClient()
        self.claimer_client.force_authenticate(self.claimer)

    def test_create_and_list_my_posts(self):
        response = self.owner_client.post(
            "/api/share/",
            {
                "item_name": "Rainbow carrots",
                "quantity_label": "1 bunch",
                "estimated_price": "4.25",
                "title": "Carrots for soup night",
                "description": "Still crisp. Please pick up after 5pm.",
                "pickup_location": "Westwood community fridge",
                "pickup_latitude": "34.063500",
                "pickup_longitude": "-118.445500",
                "tags": ["soup", "roast trays"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["item_name"], "Rainbow carrots")
        self.assertEqual(response.data["food_item"]["recipe_uses"], ["soup", "roast trays"])

        my_posts_response = self.owner_client.get("/api/share/mine/")
        self.assertEqual(my_posts_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(my_posts_response.data["posts"]), 1)
        self.assertEqual(my_posts_response.data["posts"][0]["title"], "Carrots for soup night")

    def test_feed_supports_tag_and_location_filters(self):
        near_post = SharePost.objects.create(
            owner=self.owner,
            item_name="Basil bouquet",
            quantity_label="2 cups",
            title="Fresh basil bundle",
            description="Great for pesto.",
            pickup_location="Westwood",
            pickup_latitude="34.063500",
            pickup_longitude="-118.445500",
            tags=["pesto", "pasta"],
        )
        SharePost.objects.create(
            owner=self.owner,
            item_name="Pizza dough",
            quantity_label="2 dough balls",
            title="Dough to share",
            description="Use tonight.",
            pickup_location="Santa Monica",
            pickup_latitude="34.018900",
            pickup_longitude="-118.496500",
            tags=["pizza"],
        )

        response = self.owner_client.get(
            "/api/share/feed/",
            {
                "tag": "pesto",
                "lat": "34.063000",
                "lng": "-118.446000",
                "radius_miles": "2",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["posts"]), 1)
        self.assertEqual(response.data["posts"][0]["id"], near_post.id)
        self.assertIsNotNone(response.data["posts"][0]["distance_miles"])

    def test_owner_can_update_and_delete_own_post(self):
        post = SharePost.objects.create(
            owner=self.owner,
            item_name="Greek yogurt",
            quantity_label="32 oz tub",
            title="Yogurt for sauces",
            pickup_location="Dorm lobby",
        )

        update_response = self.owner_client.patch(
            f"/api/share/{post.id}/",
            {
                "title": "Updated yogurt post",
                "tags": ["sauces", "breakfast bowls"],
            },
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["title"], "Updated yogurt post")
        self.assertEqual(update_response.data["tags"], ["sauces", "breakfast bowls"])

        delete_response = self.owner_client.delete(f"/api/share/{post.id}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(SharePost.objects.filter(id=post.id).exists())

    def test_non_owner_cannot_edit_post_but_can_claim(self):
        post = SharePost.objects.create(
            owner=self.owner,
            item_name="Honeycrisp apples",
            quantity_label="8 apples",
            estimated_price="6.75",
            title="Apple snack pack",
            pickup_location="Shared shelf",
        )

        update_response = self.claimer_client.patch(
            f"/api/share/{post.id}/",
            {"title": "Trying to change"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)

        claim_response = self.claimer_client.patch(f"/api/share/{post.id}/claim/", {}, format="json")
        self.assertEqual(claim_response.status_code, status.HTTP_200_OK)
        self.assertEqual(claim_response.data["status"], SharePost.Status.CLAIMED)
        self.assertEqual(claim_response.data["claimed_by"], self.claimer.full_display_name)
