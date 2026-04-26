"""
Environmental impact calculator for shared food items.

The single entry point is ``calculate_impact(post)`` which returns an
``ImpactResult`` namedtuple with three metrics: water, CO₂, and electricity.

================
  METHODOLOGY
================

Overview
--------
Every time a food item is shared instead of discarded, the environmental cost
that went into producing, processing, and transporting that food is "rescued."
This module estimates those rescued resources using **per-category,
per-dollar multipliers** derived from published food-waste and life-cycle
analysis research.

Calculation pipeline
--------------------
1. **Resolve item name** — determined from the post's linked FoodItem, the
   manually entered ``item_name``, or the post ``title`` as a fallback.
2. **Classify category** — the item name is passed through
   ``core.services.matching.guess_category()`` which uses keyword matching
   against our grocery database to return one of: meat, dairy, produce,
   bakery, pantry, frozen, beverage, condiment, deli, or unknown.
3. **Apply multipliers** — the category's per-dollar multipliers are
   multiplied by the item's estimated retail price to yield final impact
   values:

       impact_metric = multiplier_per_dollar × estimated_price

Metric definitions
------------------
• **Water (gallons)** — Estimated freshwater consumed across the item's full
  supply chain (irrigation, animal hydration, processing, cleaning). Based on
  Water Footprint Network data and USDA-ERS water-use intensity reports.

• **CO₂ (kg)** — Greenhouse-gas emissions (CO₂-equivalent) from production,
  processing, refrigeration, and transport. Sourced from Poore & Nemecek
  (2018, Science) life-cycle meta-analysis and USDA food-loss data.

• **Electricity (kWh)** — Energy consumed in refrigeration, processing, and
  last-mile logistics. Based on USDA Cold Chain energy audits and EPA
  estimates for food-system electricity intensity.

Per-category multiplier rationale  (per $1 of food value)
---------------------------------------------------------
+------------+-------------+----------+------+-------------------------------------------+
| Category   | Water (gal) | CO₂ (kg) | kWh  | Rationale                                 |
+------------+-------------+----------+------+-------------------------------------------+
| meat       | 200         | 3.5      | 0.50 | Highest footprint: feed crops, methane,    |
|            |             |          |      | refrigeration across the cold chain.       |
| dairy      | 50          | 1.2      | 0.30 | Significant water for pasture/feed; heavy  |
|            |             |          |      | refrigeration requirements.                |
| produce    | 30          | 0.3      | 0.15 | Lower emissions but high irrigation water; |
|            |             |          |      | minimal cold-chain energy.                 |
| bakery     | 35          | 0.6      | 0.20 | Grain irrigation + baking energy; moderate |
|            |             |          |      | shelf-stable transport.                    |
| pantry     | 40          | 0.8      | 0.20 | Processed/packaged goods with moderate     |
|            |             |          |      | processing energy.                         |
| frozen     | 60          | 1.0      | 0.40 | Continuous freezer energy drives kWh up;   |
|            |             |          |      | varies by protein content.                 |
| beverage   | 45          | 0.5      | 0.10 | Water-intensive ingredients (coffee, juice) |
|            |             |          |      | but low cold-chain needs.                  |
| condiment  | 25          | 0.4      | 0.10 | Small quantities, shelf-stable, low energy.|
| deli       | 80          | 1.5      | 0.30 | Prepared/processed meats — similar to meat |
|            |             |          |      | but slightly less feed overhead.           |
| default    | 50          | 0.8      | 0.20 | Weighted average across all categories for |
|            |             |          |      | items that cannot be classified.           |
+------------+-------------+----------+------+-------------------------------------------+

Key references
--------------
• Poore, J. & Nemecek, T. (2018). "Reducing food's environmental impacts
  through producers and consumers." Science, 360(6392), 987–992.
• Water Footprint Network — Product water footprint database.
• USDA Economic Research Service — Food expenditure & food-loss data series.
• EPA — "From Farm to Kitchen: The Environmental Impacts of U.S. Food Waste."

Limitations
-----------
• Multipliers are **national US averages** and do not account for regional,
  seasonal, or brand-level variation.
• The price-based proxy assumes a roughly linear relationship between retail
  price and embedded resources — a simplification that breaks down at the
  extremes (e.g., luxury vs. discount brands).
• Category classification relies on keyword matching and may misclassify
  ambiguous items (e.g., "protein bar" → pantry vs. dairy).
"""

from collections import namedtuple
from decimal import Decimal

from core.services.matching import guess_category

ImpactResult = namedtuple("ImpactResult", ["water_gallons", "co2_kg", "kwh"])

# Per-dollar multipliers: (water_gallons, co2_kg, kwh)
CATEGORY_MULTIPLIERS: dict[str, tuple[float, float, float]] = {
    "meat":      (200, 3.5, 0.50),
    "dairy":     (50,  1.2, 0.30),
    "produce":   (30,  0.3, 0.15),
    "bakery":    (35,  0.6, 0.20),
    "pantry":    (40,  0.8, 0.20),
    "frozen":    (60,  1.0, 0.40),
    "beverage":  (45,  0.5, 0.10),
    "condiment": (25,  0.4, 0.10),
    "deli":      (80,  1.5, 0.30),
}

DEFAULT_MULTIPLIERS = (50, 0.8, 0.20)


def calculate_impact(post) -> ImpactResult:
    """Return the estimated environmental impact of sharing *post*.

    Resolution order for the item name:
      1. ``post.food_item.name`` (if the FK is populated)
      2. ``post.item_name``
      3. ``post.title``

    The price comes from ``post.resolved_estimated_price``.
    """
    # Resolve item name
    if getattr(post, "food_item_id", None) and post.food_item:
        name = post.food_item.name
    elif getattr(post, "item_name", None):
        name = post.item_name
    else:
        name = post.title

    category = guess_category(name)
    water_m, co2_m, kwh_m = CATEGORY_MULTIPLIERS.get(category, DEFAULT_MULTIPLIERS)

    price = float(post.resolved_estimated_price or 0)

    return ImpactResult(
        water_gallons=Decimal(str(round(water_m * price, 2))),
        co2_kg=Decimal(str(round(co2_m * price, 2))),
        kwh=Decimal(str(round(kwh_m * price, 2))),
    )
