"""Bulk CSV import for the four core entities.

Deterministic parsing/validation/writes (reused from the existing serializers and
services), with the AI used only to map unfamiliar column headers to our schema
when heuristic matching falls short. One Claude call per import, never per row;
degrades to heuristic matching when no API key is set.
"""
import csv
import io
import json
import re
from collections import OrderedDict
from datetime import datetime, time
from types import SimpleNamespace

import anthropic
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import serializers as drf_serializers

from apps.inventory.serializers import StockLotSerializer
from apps.products.models import Product
from apps.products.serializers import ProductSerializer
from apps.purchasing.serializers import PurchaseOrderSerializer
from apps.sales.serializers import SalesOrderSerializer

UNIT_SYNONYMS = {
    "kg": "KG", "kilogram": "KG", "kilograms": "KG", "kilo": "KG", "kilos": "KG",
    "g": "G", "gram": "G", "grams": "G", "gr": "G",
    "l": "L", "liter": "L", "litre": "L", "liters": "L", "litres": "L",
    "ml": "ML", "milliliter": "ML", "millilitre": "ML",
    "unit": "UNIT", "units": "UNIT", "each": "UNIT", "ea": "UNIT",
    "pcs": "UNIT", "piece": "UNIT", "pieces": "UNIT",
}


def normalize_unit(value: str) -> str:
    return UNIT_SYNONYMS.get(value.strip().lower(), value.strip().upper())


def _ctx(user):
    return {"request": SimpleNamespace(user=user)}


def _parse_datetime(value: str):
    if not value:
        return None
    dt = parse_datetime(value)
    if dt is None:
        d = parse_date(value)
        if d:
            dt = datetime.combine(d, time.min)
    if dt and timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt


# ---------------------------------------------------------------------------
# Per-entity commit functions: take mapped rows, create objects, return
# (created_count, errors). Transaction + dry-run handling lives in run_import.
# ---------------------------------------------------------------------------
def _commit_products(user, rows):
    created, errors = 0, []
    for line, row in enumerate(rows, start=2):
        serializer = ProductSerializer(data=row, context=_ctx(user))
        if serializer.is_valid():
            serializer.save(owner=user)
            created += 1
        else:
            errors.append({"row": line, "errors": serializer.errors})
    return created, errors


def _resolve_product(user, sku):
    return Product.objects.filter(owner=user, sku__iexact=(sku or "").strip()).first()


def _commit_stock(user, rows):
    created, errors = 0, []
    for line, row in enumerate(rows, start=2):
        product = _resolve_product(user, row.get("product_sku"))
        if product is None:
            errors.append({"row": line, "errors": {"product_sku": ["No product with that SKU."]}})
            continue
        data = {
            "product": product.id,
            "quantity_received": row.get("quantity_received"),
            "unit_cost": row.get("unit_cost") or "0",
        }
        received = _parse_datetime(row.get("received_date", ""))
        if received:
            data["received_date"] = received
        serializer = StockLotSerializer(data=data, context=_ctx(user))
        if serializer.is_valid():
            serializer.save(owner=user)
            created += 1
        else:
            errors.append({"row": line, "errors": serializer.errors})
    return created, errors


def _group_by_reference(rows):
    groups = OrderedDict()
    for line, row in enumerate(rows, start=2):
        ref = row.get("reference") or f"__row{line}"
        groups.setdefault(ref, []).append((line, row))
    return groups


def _commit_orders(user, rows, *, party_field, price_field, serializer_cls):
    created, errors = 0, []
    for ref, group in _group_by_reference(rows).items():
        header = group[0][1]
        items, group_errors = [], []
        for line, row in group:
            product = _resolve_product(user, row.get("product_sku"))
            if product is None:
                group_errors.append({"row": line, "errors": {"product_sku": ["No product with that SKU."]}})
                continue
            items.append({
                "product": product.id,
                "quantity": row.get("quantity"),
                price_field: row.get(price_field) or "0",
            })
        if group_errors:
            errors.extend(group_errors)
            continue
        data = {
            "reference": header.get("reference", ""),
            party_field: header.get(party_field, ""),
            "order_date": header.get("order_date") or None,
            "items": items,
        }
        serializer = serializer_cls(data=data, context=_ctx(user))
        if not serializer.is_valid():
            errors.append({"reference": ref, "errors": serializer.errors})
            continue
        try:
            serializer.save(owner=user)
            created += 1
        except drf_serializers.ValidationError as exc:
            errors.append({"reference": ref, "errors": exc.detail})
    return created, errors


def _commit_purchase_orders(user, rows):
    return _commit_orders(
        user, rows, party_field="supplier", price_field="unit_cost",
        serializer_cls=PurchaseOrderSerializer,
    )


def _commit_sales_orders(user, rows):
    return _commit_orders(
        user, rows, party_field="customer", price_field="unit_price",
        serializer_cls=SalesOrderSerializer,
    )


ENTITY_SPECS = {
    "products": {
        "fields": [
            {"name": "name", "desc": "Product name", "required": True},
            {"name": "sku", "desc": "Stock keeping unit / code", "required": True},
            {"name": "description", "desc": "Description", "required": False},
            {"name": "unit", "desc": "Unit of measure (kg, g, L, mL, unit)", "required": True},
        ],
        "commit": _commit_products,
    },
    "stock": {
        "fields": [
            {"name": "product_sku", "desc": "SKU of an existing product", "required": True},
            {"name": "quantity_received", "desc": "Quantity received", "required": True},
            {"name": "unit_cost", "desc": "Cost per unit", "required": True},
            {"name": "received_date", "desc": "Date received (YYYY-MM-DD)", "required": False},
        ],
        "commit": _commit_stock,
    },
    "purchase-orders": {
        "fields": [
            {"name": "reference", "desc": "Order reference; rows sharing it form one order", "required": False},
            {"name": "supplier", "desc": "Supplier name", "required": False},
            {"name": "order_date", "desc": "Order date (YYYY-MM-DD)", "required": True},
            {"name": "product_sku", "desc": "SKU of an existing product", "required": True},
            {"name": "quantity", "desc": "Quantity purchased", "required": True},
            {"name": "unit_cost", "desc": "Cost per unit", "required": True},
        ],
        "commit": _commit_purchase_orders,
    },
    "sales-orders": {
        "fields": [
            {"name": "reference", "desc": "Order reference; rows sharing it form one order", "required": False},
            {"name": "customer", "desc": "Customer name", "required": False},
            {"name": "order_date", "desc": "Order date (YYYY-MM-DD)", "required": True},
            {"name": "product_sku", "desc": "SKU of an existing product", "required": True},
            {"name": "quantity", "desc": "Quantity sold", "required": True},
            {"name": "unit_price", "desc": "Selling price per unit", "required": True},
        ],
        "commit": _commit_sales_orders,
    },
}


def template_headers(entity: str) -> list:
    return [f["name"] for f in ENTITY_SPECS[entity]["fields"]]


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _ai_map(headers, samples, spec, partial):
    """Ask Claude to map remaining columns. Returns {field: header}."""
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    fields = spec["fields"]
    tool = {
        "name": "map_columns",
        "description": "Map each target field to the spreadsheet column header that best matches it.",
        "input_schema": {
            "type": "object",
            "properties": {
                f["name"]: {
                    "type": "string",
                    "description": f"{f['desc']} — the matching CSV header, or empty string if none.",
                }
                for f in fields
            },
        },
    }
    prompt = (
        "Map these target fields to the CSV columns.\n"
        f"Target fields: {json.dumps([{f['name']: f['desc']} for f in fields])}\n"
        f"CSV headers: {json.dumps(headers)}\n"
        f"Sample rows: {json.dumps(samples)}\n"
        "Return the best-matching header for each field, or empty string if none fits."
    )
    try:
        resp = client.messages.create(
            model=settings.ASSISTANT_MODEL,
            max_tokens=512,
            tools=[tool],
            tool_choice={"type": "tool", "name": "map_columns"},
            messages=[{"role": "user", "content": prompt}],
        )
        for block in resp.content:
            if block.type == "tool_use" and block.name == "map_columns":
                return {k: v for k, v in block.input.items() if v}
    except Exception:
        pass
    return {}


def resolve_mapping(headers, samples, spec):
    """Map canonical fields -> source header (or None). Heuristic first; AI only
    fills required gaps when a key is configured."""
    fields = [f["name"] for f in spec["fields"]]
    by_norm = {_norm(h): h for h in headers}
    mapping = {}
    for field in fields:
        nf = _norm(field)
        if nf in by_norm:
            mapping[field] = by_norm[nf]
            continue
        mapping[field] = next(
            (h for nh, h in by_norm.items() if nf and (nf in nh or nh in nf)), None
        )

    missing = [f["name"] for f in spec["fields"] if f["required"] and not mapping.get(f["name"])]
    if missing and settings.ANTHROPIC_API_KEY:
        for field, header in _ai_map(headers, samples, spec, mapping).items():
            if not mapping.get(field) and header in headers:
                mapping[field] = header
    return mapping


class _Rollback(Exception):
    pass


def run_import(user, entity: str, file, dry_run: bool = True) -> dict:
    spec = ENTITY_SPECS[entity]
    text = file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    headers = [h.strip() for h in (reader.fieldnames or [])]
    raw_rows = [
        {(k or "").strip(): (v or "").strip() for k, v in row.items()} for row in reader
    ]

    mapping = resolve_mapping(headers, raw_rows[:3], spec)
    mapped = []
    for row in raw_rows:
        m = {field: row.get(src, "") for field, src in mapping.items() if src}
        if m.get("unit"):
            m["unit"] = normalize_unit(m["unit"])
        mapped.append(m)

    created, errors = 0, []
    try:
        with transaction.atomic():
            created, errors = spec["commit"](user, mapped)
            if dry_run or errors:
                raise _Rollback()  # never persist on a preview or a failed commit
    except _Rollback:
        pass

    return {
        "entity": entity,
        "mapping": mapping,
        "row_count": len(mapped),
        "errors": errors,
        "created": 0 if (dry_run or errors) else created,
        "would_create": created if dry_run and not errors else None,
        "preview": mapped[:25] if dry_run else None,
    }
