from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Notification
from .models import Post, PostRequest

User = get_user_model()


class PostApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password="safe-password-123",
            display_name="Owner User",
        )
        self.requester = User.objects.create_user(
            username="requester",
            email="requester@example.com",
            password="safe-password-123",
            display_name="Requester User",
        )
        self.observer = User.objects.create_user(
            username="observer",
            email="observer@example.com",
            password="safe-password-123",
            display_name="Observer User",
        )
        self.owner_client = APIClient()
        self.owner_client.force_authenticate(self.owner)
        self.requester_client = APIClient()
        self.requester_client.force_authenticate(self.requester)
        self.observer_client = APIClient()
        self.observer_client.force_authenticate(self.observer)

    def _create_post(self, **overrides):
        defaults = {
            "owner": self.owner,
            "item_name": "Rainbow carrots",
            "quantity_label": "1 bunch",
            "estimated_price": "4.25",
            "title": "Carrots for soup night",
            "description": "Still crisp. Please pick up after 5pm.",
            "pickup_location": "123 Main Street, Los Angeles, CA",
            "pickup_latitude": "34.063500",
            "pickup_longitude": "-118.445500",
            "tags": ["soup", "roast trays"],
        }
        defaults.update(overrides)
        return Post.objects.create(**defaults)

    @patch("posts.serializers.post.geocode_address")
    def test_create_and_list_my_posts_return_exact_location_for_owner(self, mock_geocode_address):
        mock_geocode_address.return_value = {
            "pickup_location": "123 Main Street, Los Angeles, CA",
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
                "pickup_location": "123 Main Street, Los Angeles, CA",
                "tags": ["soup", "roast trays"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["pickup_location"], "123 Main Street, Los Angeles, CA")
        self.assertEqual(response.data["public_pickup_location"], "Los Angeles, CA")
        self.assertTrue(response.data["exact_location_visible"])

        my_posts_response = self.owner_client.get("/api/share/mine/")
        self.assertEqual(my_posts_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(my_posts_response.data["posts"]), 1)
        self.assertEqual(
            my_posts_response.data["posts"][0]["pickup_location"],
            "123 Main Street, Los Angeles, CA",
        )
        self.assertTrue(my_posts_response.data["posts"][0]["exact_location_visible"])

    def test_feed_supports_tag_and_location_filters_and_hides_exact_location(self):
        near_post = self._create_post()
        self._create_post(
            item_name="Pizza dough",
            quantity_label="2 dough balls",
            title="Dough to share",
            description="Use tonight.",
            pickup_location="555 Ocean Avenue, Santa Monica, CA",
            pickup_latitude="34.018900",
            pickup_longitude="-118.496500",
            tags=["pizza"],
        )

        response = self.owner_client.get(
            "/api/share/feed/",
            {
                "tag": "soup",
                "lat": "34.063000",
                "lng": "-118.446000",
                "radius_miles": "2",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["posts"]), 1)
        self.assertEqual(response.data["posts"][0]["id"], near_post.id)
        self.assertEqual(response.data["posts"][0]["pickup_location"], "Los Angeles, CA")
        self.assertEqual(response.data["posts"][0]["pickup_latitude"], "34.060000")
        self.assertEqual(response.data["posts"][0]["pickup_longitude"], "-118.450000")
        self.assertFalse(response.data["posts"][0]["exact_location_visible"])
        self.assertIsNotNone(response.data["posts"][0]["distance_miles"])

    def test_owner_can_update_and_delete_own_post(self):
        post = self._create_post(title="Greek yogurt")

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
        self.assertTrue(update_response.data["exact_location_visible"])

        delete_response = self.owner_client.delete(f"/api/share/{post.id}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Post.objects.filter(id=post.id).exists())

    @patch("posts.serializers.post.geocode_address")
    def test_owner_can_upload_post_image(self, mock_geocode_address):
        mock_geocode_address.return_value = {
            "pickup_location": "123 Main Street, Los Angeles, CA",
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
                "pickup_location": "123 Main Street, Los Angeles, CA",
                "tags": "soup,roast trays",
                "image_file": image_file,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["food_item"]["image"])
        self.assertTrue(Post.objects.get(id=response.data["id"]).image_file.name)

    @patch("core.notifications.NotificationService._send_email")
    def test_non_owner_cannot_edit_post_and_request_creates_pending_state(self, mock_send_email):
        post = self._create_post(
            item_name="Honeycrisp apples",
            quantity_label="8 apples",
            estimated_price="6.75",
            title="Apple snack pack",
        )

        update_response = self.requester_client.patch(
            f"/api/share/{post.id}/",
            {"title": "Trying to change"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)

        request_response = self.requester_client.patch(f"/api/share/{post.id}/claim/", {}, format="json")
        self.assertEqual(request_response.status_code, status.HTTP_200_OK)
        self.assertEqual(request_response.data["status"], Post.Status.PENDING)
        self.assertEqual(request_response.data["viewer_request_status"], PostRequest.Status.PENDING)
        self.assertEqual(request_response.data["pickup_location"], "Los Angeles, CA")
        self.assertFalse(request_response.data["exact_location_visible"])

        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.PENDING)
        self.assertIsNone(post.claimed_by_user)
        self.assertEqual(post.match_requests.count(), 1)
        self.assertEqual(post.match_requests.first().status, PostRequest.Status.PENDING)
        notification = Notification.objects.get(user=self.owner)
        self.assertEqual(notification.title, "New marketplace request")
        mock_send_email.assert_called_once()
        self.assertEqual(mock_send_email.call_args[0][0], self.owner)
        self.assertEqual(mock_send_email.call_args[0][1], "New marketplace request")
        self.assertEqual(
            post.match_requests.first().fulfillment_method,
            PostRequest.FulfillmentMethod.PICKUP,
        )

    @patch("posts.serializers.request.reverse_geocode")
    def test_delivery_request_returns_simulated_quote_and_persists_dropoff(self, mock_reverse_geocode):
        mock_reverse_geocode.return_value = {
            "pickup_location": "Bruin Plaza, Los Angeles, CA",
            "pickup_latitude": "34.071234",
            "pickup_longitude": "-118.444321",
        }

        post = self._create_post(title="Pantry soup bundle")

        request_response = self.requester_client.patch(
            f"/api/share/{post.id}/claim/",
            {
                "fulfillment_method": "delivery",
                "dropoff_latitude": "34.071234",
                "dropoff_longitude": "-118.444321",
            },
            format="json",
        )

        self.assertEqual(request_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            request_response.data["fulfillment_method"],
            PostRequest.FulfillmentMethod.DELIVERY,
        )
        self.assertEqual(
            request_response.data["viewer_fulfillment_method"],
            PostRequest.FulfillmentMethod.DELIVERY,
        )
        self.assertIsNotNone(request_response.data["delivery_quote"])
        self.assertTrue(request_response.data["delivery_quote"]["delivery_available"])
        self.assertEqual(request_response.data["delivery_quote"]["pickup_location"], "Los Angeles, CA")
        self.assertEqual(
            request_response.data["delivery_quote"]["dropoff_location"],
            "Bruin Plaza, Los Angeles, CA",
        )

        post_request = PostRequest.objects.get(post=post, requester=self.requester)
        self.assertEqual(post_request.fulfillment_method, PostRequest.FulfillmentMethod.DELIVERY)
        self.assertEqual(post_request.dropoff_location, "Bruin Plaza, Los Angeles, CA")

        outgoing_response = self.requester_client.get("/api/share/requests/outgoing/")
        self.assertEqual(outgoing_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(outgoing_response.data["requests"]), 1)
        self.assertEqual(
            outgoing_response.data["requests"][0]["fulfillment_method"],
            PostRequest.FulfillmentMethod.DELIVERY,
        )
        self.assertEqual(
            outgoing_response.data["requests"][0]["delivery_quote"]["pickup_location"],
            "Los Angeles, CA",
        )

    @patch("core.notifications.NotificationService._send_email")
    def test_owner_can_approve_request_and_requester_gains_exact_access(self, mock_send_email):
        post = self._create_post(title="Spinach dropoff")
        self.requester_client.patch(f"/api/share/{post.id}/claim/", {}, format="json")
        mock_send_email.reset_mock()

        incoming_response = self.owner_client.get("/api/share/requests/incoming/")
        self.assertEqual(incoming_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(incoming_response.data["requests"]), 1)
        request_id = incoming_response.data["requests"][0]["id"]
        self.assertEqual(
            incoming_response.data["requests"][0]["post"]["pickup_location"],
            "123 Main Street, Los Angeles, CA",
        )

        approve_response = self.owner_client.patch(
            f"/api/share/requests/{request_id}/approve/",
            {},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_response.data["request"]["status"], PostRequest.Status.APPROVED)
        self.assertEqual(
            approve_response.data["request"]["post"]["pickup_location"],
            "123 Main Street, Los Angeles, CA",
        )

        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.CLAIMED)
        self.assertEqual(post.claimed_by_user_id, self.requester.id)

        detail_response = self.requester_client.get(f"/api/share/{post.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["pickup_location"], "123 Main Street, Los Angeles, CA")
        self.assertTrue(detail_response.data["exact_location_visible"])
        self.assertEqual(detail_response.data["viewer_request_status"], PostRequest.Status.APPROVED)

        observer_detail_response = self.observer_client.get(f"/api/share/{post.id}/")
        self.assertEqual(observer_detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(observer_detail_response.data["pickup_location"], "Los Angeles, CA")
        self.assertFalse(observer_detail_response.data["exact_location_visible"])
        notification = Notification.objects.get(user=self.requester, title="Marketplace request approved")
        self.assertIn('Your request for "Spinach dropoff" was approved.', notification.message)
        mock_send_email.assert_called_once()
        self.assertEqual(mock_send_email.call_args[0][0], self.requester)
        self.assertEqual(mock_send_email.call_args[0][1], "Marketplace request approved")

    @patch("posts.serializers.request.reverse_geocode")
    def test_approved_delivery_request_reveals_exact_pickup_in_quote(self, mock_reverse_geocode):
        mock_reverse_geocode.return_value = {
            "pickup_location": "UCLA Residence Hall, Los Angeles, CA",
            "pickup_latitude": "34.072050",
            "pickup_longitude": "-118.450000",
        }

        post = self._create_post(title="Late night snacks")
        self.requester_client.patch(
            f"/api/share/{post.id}/claim/",
            {
                "fulfillment_method": "delivery",
                "dropoff_latitude": "34.072050",
                "dropoff_longitude": "-118.450000",
            },
            format="json",
        )

        request_id = PostRequest.objects.get(post=post, requester=self.requester).id
        approve_response = self.owner_client.patch(
            f"/api/share/requests/{request_id}/approve/",
            {},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            approve_response.data["request"]["delivery_quote"]["pickup_location"],
            "123 Main Street, Los Angeles, CA",
        )

        detail_response = self.requester_client.get(f"/api/share/{post.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            detail_response.data["viewer_fulfillment_method"],
            PostRequest.FulfillmentMethod.DELIVERY,
        )
        self.assertEqual(
            detail_response.data["viewer_delivery_quote"]["pickup_location"],
            "123 Main Street, Los Angeles, CA",
        )
        self.assertEqual(
            detail_response.data["viewer_delivery_quote"]["dropoff_location"],
            "UCLA Residence Hall, Los Angeles, CA",
        )

    @patch("core.notifications.NotificationService._send_email")
    def test_owner_can_decline_request_and_post_returns_to_available(self, mock_send_email):
        post = self._create_post(title="Soup base")
        self.requester_client.patch(f"/api/share/{post.id}/claim/", {}, format="json")
        mock_send_email.reset_mock()

        outgoing_response = self.requester_client.get("/api/share/requests/outgoing/")
        self.assertEqual(outgoing_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(outgoing_response.data["requests"]), 1)
        request_id = outgoing_response.data["requests"][0]["id"]
        self.assertEqual(
            outgoing_response.data["requests"][0]["post"]["pickup_location"],
            "Los Angeles, CA",
        )

        decline_response = self.owner_client.patch(
            f"/api/share/requests/{request_id}/decline/",
            {},
            format="json",
        )
        self.assertEqual(decline_response.status_code, status.HTTP_200_OK)
        self.assertEqual(decline_response.data["request"]["status"], PostRequest.Status.DECLINED)

        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.AVAILABLE)
        self.assertIsNone(post.claimed_by_user)

        detail_response = self.requester_client.get(f"/api/share/{post.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["pickup_location"], "Los Angeles, CA")
        self.assertFalse(detail_response.data["exact_location_visible"])
        self.assertEqual(detail_response.data["viewer_request_status"], PostRequest.Status.DECLINED)
        notification = Notification.objects.get(user=self.requester, title="Marketplace request declined")
        self.assertIn('Your request for "Soup base" was declined.', notification.message)
        mock_send_email.assert_called_once()
        self.assertEqual(mock_send_email.call_args[0][0], self.requester)
        self.assertEqual(mock_send_email.call_args[0][1], "Marketplace request declined")

    @patch("posts.views.location.reverse_geocode")
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
