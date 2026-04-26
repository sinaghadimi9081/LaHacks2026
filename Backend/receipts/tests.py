import shutil
import tempfile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from households.models import Household, HouseholdMembership

from .models import ParsedReceiptItem, Receipt
from .receipt_processing import ReceiptProcessingResult
from .veryfi_provider import map_document_to_result as map_veryfi_document_to_receipt_result
from .receipt_parser import (
    extract_receipt_total_from_text,
    extract_store_name,
    parse_receipt_text,
)

User = get_user_model()

TARGET_RECEIPT_RAW_TEXT = "\n".join(
    [
        "Menphis East ~ 901-261-5079",
        "5959 Poplar Ave",
        "Memphis, Tennessee 38119-3938",
        "06/06/2021 08:57 PH",
        "",
        "VTEC AAO",
        "",
        "GROCERY",
        "270030028 MORNIF MEAT BE $3.79",
        "211180116 NASOYA VEGET BF $4.49",
        "284060377 GG OATMILK BE «$3.49",
        "284000087 PILLSBURY BF $1.89",
        "284050333 STARBUCKS BF $4.69",
        "266500028 GG FRUIT BF $3.69",
        "270140410 GG_FRUIT BF $2.49",
        "284040499 TA20 BF $3.79",
        "211180091 TOFURKY MEAT BF $2.99",
        "212141019 ANNIE'S BF $2.79",
        "212040050 SBR BF $2.29",
        "212180873 SOUP BF $3.69",
        "284100452 SILK BF $2.50",
        "20 $1.25 0a",
        "Regular Price $1.69",
        "212060196 MT OLIVE PKL BF $1.99",
        "071090692 BISCOFFS. 802 BF «$2.69",
        "231130524 GG GRANOLA BF $3.39",
        "261040708 HW KINGAR BF $4.29",
        "071200533 NATURE'S BF $2.99",
        "071180218 ANNIES FRT TF $3.39",
        "SUBTOTAL. $61.52",
        "B = TN TAX 6.75000 on $58.19 $3.91",
        "T = TN TAX 9.75000 on $3.39 $0.34",
        "$65.77",
        "$65.77",
        "10000031010",
        "",
        "TH CODE 035721",
        "",
        "Your Target Circle earnings are int",
        "Open the Target App or visit",
        "Target.con/Circle to see your benefits.",
        "",
        "TOTAL SAVINGS THIS TRIP",
        "$0.88",
    ]
)


class ReceiptParserTests(TestCase):
    def test_parse_receipt_text_extracts_food_lines(self):
        raw_text = "\n".join(
            [
                "2 BANANAS 1.99",
                "2 X YOGURT 6.99",
                "3 @ 1.50 APPLES 4.50",
                "SPINACH 4.99",
                "SUBTOTAL 18.47",
                "VISA 18.47",
                "THANK YOU",
            ]
        )

        self.assertEqual(
            parse_receipt_text(raw_text),
            [
                {"name": "BANANAS", "estimated_price": "1.99", "quantity": 2},
                {"name": "YOGURT", "estimated_price": "6.99", "quantity": 2},
                {"name": "APPLES", "estimated_price": "4.50", "quantity": 3},
                {"name": "SPINACH", "estimated_price": "4.99", "quantity": 1},
            ],
        )

    def test_parse_receipt_text_handles_split_weight_and_bundle_lines(self):
        raw_text = "\n".join(
            [
                "BANANAS 000000004011KI",
                "1.75 lb @ 1 lb /0.54 0.95 R",
                "AVOCADO 000000004046KT",
                "4 AT 1 FOR 0.44 1.76 R",
                "BEVERAGE 003120002133 F 2.00 R",
                "OS CRAN POM 003120027015 F 2,00 R",
                "SUBTOTAL 10.00",
            ]
        )

        self.assertEqual(
            parse_receipt_text(raw_text),
            [
                {"name": "BANANAS", "estimated_price": "0.95", "quantity": 1},
                {"name": "AVOCADO", "estimated_price": "1.76", "quantity": 4},
                {"name": "BEVERAGE", "estimated_price": "2.00", "quantity": 1},
                {"name": "OS CRAN POM", "estimated_price": "2.00", "quantity": 1},
            ],
        )

    def test_parse_receipt_text_handles_trailing_noise_and_missing_decimal_leading_zero(self):
        raw_text = "\n".join(
            [
                "MAHATMA JASM 001740010951 F 5.48 |",
                "BNLS BRST MD 022990430952 F 9 52",
                "A-AVOCADOS EACH HASS 40 CT. O88",
                "TOTAL 15.88",
            ]
        )

        self.assertEqual(
            parse_receipt_text(raw_text),
            [
                {"name": "MAHATMA JASM", "estimated_price": "5.48", "quantity": 1},
                {"name": "BNLS BRST MD", "estimated_price": "9.52", "quantity": 1},
                {"name": "AVOCADOS EACH HASS", "estimated_price": "0.88", "quantity": 1},
            ],
        )

    def test_parse_receipt_text_extracts_target_style_lines(self):
        self.assertEqual(
            parse_receipt_text(TARGET_RECEIPT_RAW_TEXT),
            [
                {"name": "MORNIF MEAT", "estimated_price": "3.79", "quantity": 1},
                {"name": "NASOYA VEGET", "estimated_price": "4.49", "quantity": 1},
                {"name": "GG OATMILK", "estimated_price": "3.49", "quantity": 1},
                {"name": "PILLSBURY", "estimated_price": "1.89", "quantity": 1},
                {"name": "STARBUCKS", "estimated_price": "4.69", "quantity": 1},
                {"name": "GG FRUIT", "estimated_price": "3.69", "quantity": 1},
                {"name": "GG FRUIT", "estimated_price": "2.49", "quantity": 1},
                {"name": "TA20", "estimated_price": "3.79", "quantity": 1},
                {"name": "TOFURKY MEAT", "estimated_price": "2.99", "quantity": 1},
                {"name": "ANNIE'S", "estimated_price": "2.79", "quantity": 1},
                {"name": "SBR", "estimated_price": "2.29", "quantity": 1},
                {"name": "SOUP", "estimated_price": "3.69", "quantity": 1},
                {"name": "SILK", "estimated_price": "2.50", "quantity": 1},
                {"name": "MT OLIVE PKL", "estimated_price": "1.99", "quantity": 1},
                {"name": "BISCOFFS", "estimated_price": "2.69", "quantity": 1},
                {"name": "GG GRANOLA", "estimated_price": "3.39", "quantity": 1},
                {"name": "HW KINGAR", "estimated_price": "4.29", "quantity": 1},
                {"name": "NATURE'S", "estimated_price": "2.99", "quantity": 1},
                {"name": "ANNIES FRT", "estimated_price": "3.39", "quantity": 1},
            ],
        )

    def test_parse_receipt_text_ignores_promotions_and_payment_rows(self):
        raw_text = "\n".join(
            [
                "SKNYCW CONE RC 5.49 F",
                "SC RALPHS SAVED YOU 1.50",
                "LCSN FZ MEAL <+ 2.49 F",
                "SC LC/Stouff Save .49 0.49-F",
                "MR TRGT BX $25 25.00",
                "GB ********8736 25.00 Blinc",
                "BALANCE 53.47",
            ]
        )

        self.assertEqual(
            parse_receipt_text(raw_text),
            [
                {"name": "SKNYCW CONE RC", "estimated_price": "5.49", "quantity": 1},
                {"name": "LCSN FZ MEAL +", "estimated_price": "2.49", "quantity": 1},
                {"name": "MR TRGT BX", "estimated_price": "25.00", "quantity": 1},
            ],
        )

    def test_extract_receipt_total_from_text_prefers_balance_over_line_items(self):
        raw_text = "\n".join(
            [
                "ANNIE DRSSNG RC 3.99 F",
                "MR TRGT BX $25 25.00",
                "TAX 0.00",
                "BALANCE 53.47",
            ]
        )

        self.assertEqual(extract_receipt_total_from_text(raw_text), "53.47")

    def test_extract_store_name_prefers_known_brand_mentions(self):
        self.assertEqual(extract_store_name(TARGET_RECEIPT_RAW_TEXT), "Target")
        self.assertEqual(
            extract_store_name(
                "\n".join(
                    [
                        "Wal - Ka",
                        "almart 7,5",
                        "Save money. Live better.",
                        "( 970 ) 259 - 8755",
                    ]
                )
            ),
            "Walmart",
        )
        self.assertEqual(
            extract_store_name(
                "\n".join(
                    [
                        "10309 West Olympic Blvd.",
                        "YOUR CASHIER WAS ROBERT",
                        "SC RALPHS SAVED YOU 1.50",
                        "BALANCE 53.47",
                    ]
                )
            ),
            "Ralphs",
        )

    def test_extract_store_name_falls_back_to_header_candidate(self):
        raw_text = "\n".join(
            [
                "Neighborhood Market",
                "123 Demo Ave",
                "Anytown, CA 90000",
                "BANANAS 1.99",
            ]
        )

        self.assertEqual(extract_store_name(raw_text), "Neighborhood Market")


class ReceiptProviderTests(TestCase):
    def test_map_veryfi_document_uses_normalized_line_items(self):
        payload = {
            "ocr_text": "RALPHS\nLCSN FZ MEAL 2.49\nBALANCE 53.47",
            "vendor": {"raw_name": "Ralphs"},
            "total": 53.47,
            "line_items": [
                {
                    "order": 1,
                    "type": "food",
                    "description": "LCSN FZ MEAL",
                    "normalized_description": "Lean Cuisine Frozen Meal",
                    "total": 2.49,
                    "quantity": 1,
                },
                {
                    "order": 2,
                    "type": "discount",
                    "description": "RALPHS SAVED YOU",
                    "total": 0.80,
                    "quantity": 1,
                },
                {
                    "order": 3,
                    "type": "product",
                    "description": "ANNIE DRSSNG",
                    "product_details": [
                        {"product_name": "Annie's Dressing", "brand": "Annie's"}
                    ],
                    "price": 3.99,
                    "quantity": 1,
                },
            ],
        }

        result = map_veryfi_document_to_receipt_result(
            payload,
            image_path="/tmp/receipt.jpg",
        )

        self.assertEqual(result.store_name, "Ralphs")
        self.assertEqual(result.detected_total, "53.47")
        self.assertEqual(
            result.parsed_items,
            [
                {
                    "name": "Lean Cuisine Frozen Meal",
                    "estimated_price": "2.49",
                    "quantity": 1,
                },
                {
                    "name": "Annie's Dressing",
                    "estimated_price": "3.99",
                    "quantity": 1,
                },
            ],
        )

    def test_map_veryfi_document_filters_discount_and_payment_noise(self):
        payload = {
            "ocr_text": "RALPHS\nBALANCE 53.47",
            "vendor": {"raw_name": "RALPHS", "name": "Ralphs"},
            "total": 53.47,
            "line_items": [
                {
                    "order": 1,
                    "type": "food",
                    "description": "LCSN FZ MEAL\nLC/Stouff Save .49",
                    "text": "LCSN FZ MEAL\t<+\t2.49 F\nSC\tRALPHS SAVED YOU\t0.80\tLC/Stouff Save .49\t0.49-F",
                    "total": 2.49,
                    "quantity": 1,
                },
                {
                    "order": 2,
                    "type": "food",
                    "description": "LC/Stouff Save 49.",
                    "text": "LC/Stouff Save 49.\t0.49-F",
                    "total": -0.49,
                    "quantity": 1,
                },
                {
                    "order": 3,
                    "type": "product",
                    "description": "TRGT BX $25\nGB **** ********8736 25.00 Blnc",
                    "text": "TRGT BX $25\t25.00\nGB ****\t********8736\t25.00 Blnc",
                    "total": 25.0,
                    "quantity": 1,
                },
                {
                    "order": 4,
                    "type": "food",
                    "description": "LOYALTY DIV\nNP\nGreen Bag Pts",
                    "text": "LOYALTY DIV\tNP\t0.00\nDB\tGreen Bag Pts\t5",
                    "total": 0.0,
                    "quantity": 5,
                },
            ],
        }

        result = map_veryfi_document_to_receipt_result(
            payload,
            image_path="/tmp/receipt.jpg",
        )

        self.assertEqual(
            result.parsed_items,
            [
                {
                    "name": "LCSN FZ MEAL",
                    "estimated_price": "2.49",
                    "quantity": 1,
                }
            ],
        )


class ReceiptApiTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()
        self.user = User.objects.create_user(
            username="receipt-user",
            email="receipt@example.com",
            password="StrongPass123!",
            display_name="Receipt User",
        )
        self.household = Household.objects.create(
            name="Receipt Household",
            created_by=self.user,
        )
        HouseholdMembership.objects.create(
            user=self.user,
            household=self.household,
            role=HouseholdMembership.Role.OWNER,
            status=HouseholdMembership.Status.ACTIVE,
            can_upload_receipts=True,
            can_post_share=True,
            can_manage_members=True,
        )
        self.user.default_household = self.household
        self.user.save(update_fields=["default_household"])
        self.client.force_authenticate(self.user)

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)
        super().tearDown()

    def test_receipt_upload_requires_authenticated_user(self):
        self.client.force_authenticate(user=None)
        upload = SimpleUploadedFile(
            "receipt.jpg",
            b"fake-image-bytes",
            content_type="image/jpeg",
        )

        response = self.client.post(
            reverse("receipt-upload"),
            {"image": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_upload_receipt_requires_image(self):
        response = self.client.post(reverse("receipt-upload"), {}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data["detail"])

    @patch("receipts.views.verify_and_enrich_items")
    @patch("receipts.views.process_receipt_image")
    def test_upload_receipt_creates_draft_items(self, process_receipt_image_mock, verify_mock):
        process_receipt_image_mock.return_value = ReceiptProcessingResult(
            raw_text="TARGET\n2 BANANAS 1.99\nTOTAL 1.99",
            store_name="Target",
            detected_total="1.99",
            parsed_items=[
                {
                    "name": "BANANAS",
                    "estimated_price": "1.99",
                    "quantity": 2,
                }
            ],
        )
        verify_mock.return_value = [
            {
                "name": "BANANAS",
                "standardized_name": "Bananas",
                "category_tag": "produce",
                "expiration_days": 5,
                "estimated_price": "1.99",
                "quantity": 2,
            }
        ]
        upload = SimpleUploadedFile(
            "receipt.jpg",
            b"fake-image-bytes",
            content_type="image/jpeg",
        )

        response = self.client.post(
            reverse("receipt-upload"),
            {"image": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Receipt.objects.count(), 1)
        self.assertEqual(ParsedReceiptItem.objects.count(), 1)

        receipt = Receipt.objects.get()
        parsed_item = receipt.parsed_items.get()

        self.assertEqual(receipt.uploaded_by, self.user)
        self.assertEqual(receipt.household, self.household)
        self.assertEqual(receipt.raw_text, "TARGET\n2 BANANAS 1.99\nTOTAL 1.99")
        self.assertEqual(receipt.store_name, "Target")
        self.assertEqual(str(receipt.detected_total_amount), "1.99")
        self.assertEqual(parsed_item.name, "BANANAS")
        self.assertEqual(parsed_item.standardized_name, "Bananas")
        self.assertEqual(parsed_item.category_tag, "produce")
        self.assertEqual(parsed_item.expiration_days, 5)
        self.assertEqual(str(parsed_item.estimated_price), "1.99")
        self.assertEqual(parsed_item.quantity, 2)
        self.assertEqual(response.data["receipt_id"], receipt.id)
        self.assertEqual(response.data["store_name"], "Target")
        self.assertEqual(response.data["detected_total"], "1.99")
        self.assertEqual(response.data["parsed_item_total"], "1.99")
        self.assertEqual(len(response.data["parsed_items"]), 1)

    def test_receipt_detail_returns_nested_items(self):
        receipt = Receipt.objects.create(
            uploaded_by=self.user,
            household=self.household,
            image="receipts/test-receipt.jpg",
            store_name="",
            detected_total_amount="4.99",
            raw_text="SPINACH 4.99",
        )
        ParsedReceiptItem.objects.create(
            receipt=receipt,
            name="SPINACH",
            estimated_price="4.99",
            quantity=1,
        )

        response = self.client.get(reverse("receipt-detail", args=[receipt.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["receipt_id"], receipt.id)
        self.assertEqual(response.data["detected_total"], "4.99")
        self.assertEqual(response.data["parsed_item_total"], "4.99")
        self.assertEqual(response.data["parsed_items"][0]["name"], "SPINACH")

    def test_receipt_detail_backfills_store_name_for_existing_rows(self):
        receipt = Receipt.objects.create(
            uploaded_by=self.user,
            household=self.household,
            image="receipts/test-receipt.jpg",
            store_name="",
            detected_total_amount=None,
            raw_text="TARGET\nSPINACH 4.99\nTOTAL 4.99",
        )

        response = self.client.get(reverse("receipt-detail", args=[receipt.id]))

        receipt.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["store_name"], "Target")
        self.assertEqual(response.data["detected_total"], "4.99")
        self.assertEqual(receipt.store_name, "Target")
        self.assertEqual(str(receipt.detected_total_amount), "4.99")

    def test_confirm_receipt_creates_food_items(self):
        from core.models import FoodItem
        from datetime import date, timedelta
        
        receipt = Receipt.objects.create(
            uploaded_by=self.user,
            household=self.household,
            image="receipts/test-receipt.jpg",
            store_name="Target",
            detected_total_amount="4.99",
            raw_text="SPINACH 4.99",
        )
        item1 = ParsedReceiptItem.objects.create(
            receipt=receipt,
            name="SPINACH",
            standardized_name="Spinach",
            category_tag="produce",
            expiration_days=7,
            estimated_price="4.99",
            quantity=1,
            image_url="http://example.com/spinach.jpg",
            description="Fresh leafy greens",
        )
        
        response = self.client.post(
            reverse("receipt-confirm", args=[receipt.id]),
            {"items": [{
                "id": item1.id, 
                "selected": True,
                "name": item1.name,
                "standardized_name": item1.standardized_name,
                "quantity": item1.quantity,
                "estimated_price": item1.estimated_price,
                "expiration_days": item1.expiration_days,
                "image_url": item1.image_url,
                "description": item1.description
            }]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(FoodItem.objects.count(), 1)
        
        food = FoodItem.objects.first()
        self.assertEqual(food.name, "Spinach")
        self.assertEqual(float(food.estimated_price), 4.99)
        self.assertEqual(food.image_url, "http://example.com/spinach.jpg")
        self.assertEqual(food.description, "Fresh leafy greens")
        self.assertEqual(food.household, self.household)
        self.assertEqual(food.created_by, self.user)
        self.assertEqual(food.owner_name, self.user.full_display_name)
        expected_date = date.today() + timedelta(days=7)
        self.assertEqual(food.expiration_date, expected_date)
