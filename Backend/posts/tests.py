from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from .models import Post

User = get_user_model()


class PostApiTests(TestCase):
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

    @patch("posts.serializers.geocode_address")
    def test_create_and_list_my_posts(self, mock_geocode_address):
        mock_geocode_address.return_value = {
            "pickup_location": "Westwood community fridge, Los Angeles, CA",
            "pickup_latitude": "34.063500",
            "pickup_longitude": "-118.445500",
        }

        response = self.owner_client.post(
            "/api/share/",
            {
                "item_name": "Rainbow carrots",
                "quantity_label": "1 bunch",
                "estimated_price": "4.25",
                "title": "Carrots for soup night",
                "description": "Still crisp. Please pick up after 5pm.",
                "pickup_location": "Westwood community fridge",
                "tags": ["soup", "roast trays"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["item_name"], "Rainbow carrots")
        self.assertEqual(response.data["food_item"]["recipe_uses"], ["soup", "roast trays"])
        self.assertEqual(response.data["pickup_location"], "Westwood community fridge, Los Angeles, CA")
        self.assertEqual(response.data["pickup_latitude"], "34.063500")
        self.assertEqual(response.data["pickup_longitude"], "-118.445500")

        my_posts_response = self.owner_client.get("/api/share/mine/")
        self.assertEqual(my_posts_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(my_posts_response.data["posts"]), 1)
        self.assertEqual(my_posts_response.data["posts"][0]["title"], "Carrots for soup night")

    def test_feed_supports_tag_and_location_filters(self):
        near_post = Post.objects.create(
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
        Post.objects.create(
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
        post = Post.objects.create(
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
        self.assertFalse(Post.objects.filter(id=post.id).exists())

    @patch("posts.serializers.geocode_address")
    def test_owner_can_upload_post_image(self, mock_geocode_address):
        mock_geocode_address.return_value = {
            "pickup_location": "Westwood community fridge, Los Angeles, CA",
            "pickup_latitude": "34.063500",
            "pickup_longitude": "-118.445500",
        }

        image_file = SimpleUploadedFile(
            "post.gif",
            (
                b"GIF87a\x01\x00\x01\x00\x80\x00\x00"
                b"\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,"
                b"\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
            ),
            content_type="image/gif",
        )

        response = self.owner_client.post(
            "/api/share/",
            {
                "item_name": "Rainbow carrots",
                "quantity_label": "1 bunch",
                "title": "Picture post",
                "pickup_location": "Westwood community fridge",
                "tags": "soup,roast trays",
                "image_file": image_file,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["food_item"]["image"])
        self.assertTrue(Post.objects.get(id=response.data["id"]).image_file.name)

    def test_non_owner_cannot_edit_post_but_can_claim(self):
        post = Post.objects.create(
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
        self.assertEqual(claim_response.data["status"], Post.Status.CLAIMED)
        self.assertEqual(claim_response.data["claimed_by"], self.claimer.full_display_name)

    @patch("posts.views.reverse_geocode")
    def test_location_resolve_supports_browser_coordinates(self, mock_reverse_geocode):
        mock_reverse_geocode.return_value = {
            "pickup_location": "Bruin Plaza, Los Angeles, CA",
            "pickup_latitude": "34.071234",
            "pickup_longitude": "-118.444321",
        }

        response = self.owner_client.post(
            "/api/share/location/resolve/",
            {
                "latitude": "34.071234",
                "longitude": "-118.444321",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["pickup_location"], "Bruin Plaza, Los Angeles, CA")
        self.assertEqual(response.data["pickup_latitude"], "34.071234")
        self.assertEqual(response.data["pickup_longitude"], "-118.444321")
