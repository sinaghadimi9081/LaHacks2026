import json
import re
from datetime import timedelta
from decimal import Decimal

import requests
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import FoodItem
from .serializers import FoodItemSerializer


class FoodItemListCreateView(generics.ListCreateAPIView):
    serializer_class = FoodItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        household = self.request.user.default_household
        if household is None:
            return FoodItem.objects.none()
        return FoodItem.objects.filter(household=household).order_by('-created_at')

    def perform_create(self, serializer):
        household = self.request.user.default_household
        serializer.save(
            household=household,
            created_by=self.request.user,
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({'items': serializer.data}, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FoodItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FoodItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        household = self.request.user.default_household
        if household is None:
            return FoodItem.objects.none()
        return FoodItem.objects.filter(household=household)

    def perform_update(self, serializer):
        item = self.get_object()
        if item.household_id != (self.request.user.default_household_id):
            raise PermissionDenied('You can only update items in your active household.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.household_id != (self.request.user.default_household_id):
            raise PermissionDenied('You can only delete items in your active household.')
        instance.delete()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _safe_decimal(value):
    if value in (None, ""):
        return Decimal("0.00")
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0.00")


def _ollama_is_healthy(base_url: str) -> bool:
    try:
        response = requests.get(f"{base_url}/api/tags", timeout=2)
        return response.status_code == 200
    except Exception:
        return False


def _parse_json_array_from_text(raw_text: str):
    if not raw_text:
        return None
    json_match = re.search(r"\[.*\]", raw_text, re.DOTALL)
    if not json_match:
        return None
    try:
        result = json.loads(json_match.group())
    except Exception:
        return None
    return result if isinstance(result, list) else None


def _fallback_inventory_tips(inventory_rows):
    tips = []
    expiring = [row for row in inventory_rows if row.get("days_left") is not None and row["days_left"] <= 2]
    if expiring:
        names = ", ".join([row["name"] for row in expiring[:4]])
        tips.append(
            {
                "emoji": "⏳",
                "title": "Cook or share expiring items first",
                "description": f"Prioritize: {names}. Try a quick stir-fry, soup, or a share post today.",
            }
        )

    high_value = sorted(inventory_rows, key=lambda row: float(row.get("estimated_price") or 0), reverse=True)
    if high_value and float(high_value[0].get("estimated_price") or 0) > 0:
        tips.append(
            {
                "emoji": "💸",
                "title": "Protect your highest-value items",
                "description": f'Set a plan for "{high_value[0]["name"]}" this week to avoid losing the most money to waste.',
            }
        )

    tips.append(
        {
            "emoji": "🧊",
            "title": "Freeze backups early",
            "description": "If you won’t use something soon, freeze portions now (bread, cooked grains, sauces) to extend shelf life.",
        }
    )
    tips.append(
        {
            "emoji": "📝",
            "title": "Do a 5-minute pantry check",
            "description": "Twice a week, scan your inventory for the next 3 items to use; add them to meals before shopping.",
        }
    )

    return tips[:5]


def _ollama_inventory_tips(inventory_rows):
    import os

    base_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
    model = os.getenv("OLLAMA_MODEL", "gemma2")

    if not _ollama_is_healthy(base_url):
        return None

    compact = [
        {
            "name": row.get("name", ""),
            "quantity": row.get("quantity", 1),
            "category_tag": row.get("category_tag", ""),
            "expiration_date": row.get("expiration_date", None),
            "estimated_price": row.get("estimated_price", "0.00"),
            "days_left": row.get("days_left", None),
        }
        for row in inventory_rows
    ]

    prompt = (
        "You are a food-waste reduction coach for a household pantry app.\n"
        "Given a JSON array of inventory items, return a JSON array of 5 tips.\n"
        "Each tip object MUST have: emoji, title, description.\n"
        "Rules:\n"
        "- Be practical and specific to the inventory.\n"
        "- Prioritize items with low days_left.\n"
        "- Keep each description to 1-2 sentences.\n"
        "Return ONLY valid JSON array, no markdown, no explanation.\n\n"
        f"Inventory: {json.dumps(compact)}"
    )

    try:
        response = requests.post(
            f"{base_url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 512},
            },
            timeout=30,
        )
        if response.status_code != 200:
            return None
        raw = response.json().get("response", "")
        parsed = _parse_json_array_from_text(raw)
        if not parsed:
            return None

        tips = []
        for tip in parsed:
            if not isinstance(tip, dict):
                continue
            emoji = str(tip.get("emoji") or "").strip()
            title = str(tip.get("title") or "").strip()
            description = str(tip.get("description") or "").strip()
            if not title or not description:
                continue
            tips.append(
                {
                    "emoji": emoji or "✅",
                    "title": title[:80],
                    "description": description[:220],
                }
            )
        return tips[:5] if tips else None
    except Exception:
        return None


class ImpactSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from core.models import ImpactLog
        from households.models import HouseholdMembership
        from users.models import User

        user = request.user
        totals = ImpactLog.objects.filter(user=user).aggregate(total_dollars=Sum("dollars_saved"))
        total_dollars = _safe_decimal(totals.get("total_dollars"))
        items_rescued = ImpactLog.objects.filter(user=user, action="share_post_claimed").count()

        now = timezone.now()
        week_start = now - timedelta(days=7)
        week_totals = ImpactLog.objects.filter(user=user, created_at__gte=week_start).aggregate(
            week_dollars=Sum("dollars_saved")
        )
        weekly_dollars = _safe_decimal(week_totals.get("week_dollars"))

        leaderboard = []
        if user.default_household_id:
            member_ids = list(
                HouseholdMembership.objects.filter(
                    household_id=user.default_household_id,
                    status=HouseholdMembership.Status.ACTIVE,
                ).values_list("user_id", flat=True)
            )
            if member_ids:
                agg = (
                    ImpactLog.objects.filter(user_id__in=member_ids)
                    .values("user_id")
                    .annotate(
                        dollars_saved=Sum("dollars_saved"),
                        items_rescued=Count("id", filter=Q(action="share_post_claimed")),
                    )
                )
                metrics_by_user = {row["user_id"]: row for row in agg}
                members = User.objects.filter(id__in=member_ids).order_by("id")
                for member in members:
                    row = metrics_by_user.get(member.id, {})
                    leaderboard.append(
                        {
                            "user_id": member.id,
                            "name": member.full_display_name,
                            "dollars_saved": str(_safe_decimal(row.get("dollars_saved"))),
                            "items_rescued": int(row.get("items_rescued") or 0),
                        }
                    )
                leaderboard.sort(key=lambda r: (Decimal(r["dollars_saved"]), r["items_rescued"]), reverse=True)

        return Response(
            {
                "personal": {
                    "dollars_saved": str(total_dollars),
                    "items_rescued": items_rescued,
                    "co2_saved_kg": str(_safe_decimal(getattr(user, "total_co2_saved_kg", 0))),
                    "items_shared": int(getattr(user, "total_posts_shared", 0) or 0),
                },
                "weekly": {
                    "label": "Money saved (last 7 days)",
                    "current": str(weekly_dollars),
                    "goal": "25.00",
                },
                "household_leaderboard": leaderboard,
            },
            status=status.HTTP_200_OK,
        )


class ImpactTipsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        household = getattr(request.user, "default_household", None)
        if household is None:
            return Response({"detail": "Select a household first."}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.now().date()
        items = (
            FoodItem.objects.filter(household=household)
            .order_by("expiration_date", "-created_at")
            .values(
                "name",
                "quantity",
                "category_tag",
                "expiration_date",
                "estimated_price",
            )[:40]
        )

        inventory_rows = []
        for row in items:
            expiration_date = row.get("expiration_date")
            days_left = None
            if expiration_date:
                try:
                    days_left = (expiration_date - today).days
                except Exception:
                    days_left = None
            inventory_rows.append(
                {
                    "name": row.get("name") or "",
                    "quantity": int(row.get("quantity") or 1),
                    "category_tag": (row.get("category_tag") or "").strip(),
                    "expiration_date": str(expiration_date) if expiration_date else None,
                    "estimated_price": str(_safe_decimal(row.get("estimated_price"))),
                    "days_left": days_left,
                }
            )

        ollama_tips = _ollama_inventory_tips(inventory_rows)
        tips = ollama_tips or _fallback_inventory_tips(inventory_rows)
        source = "ollama" if ollama_tips else "fallback"

        return Response({"tips": tips, "source": source}, status=status.HTTP_200_OK)
