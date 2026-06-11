"""JP — the AI ops assistant.

Runs a Claude tool-use loop over the signed-in user's own data. Every tool
queries through ``owner=user``, so the model can only ever see the requesting
user's products, stock and orders — the same isolation the REST API enforces.
"""
import json

import anthropic
from django.conf import settings
from django.db.models import Q

from apps.inventory.models import StockLot
from apps.products.models import Product

from .analytics import product_financials, products_breakdown, user_financials

MAX_TOOL_TURNS = 6

SYSTEM_PROMPT = (
    "You are JP, an AI operations assistant inside an inventory management app "
    "for Food & Beverage CPG brands. You help the signed-in user understand "
    "their products, stock, purchasing, sales and profitability.\n\n"
    "Use the tools to fetch live data before answering anything numeric — never "
    "guess figures. All data is already scoped to the current user. Answer "
    "directly and concisely; do not narrate your reasoning or describe which "
    "tools you are calling. Show money with a $ and two decimals. Margin is "
    "profit divided by cost of goods sold, expressed as a percentage. If the "
    "data doesn't contain the answer, say so briefly."
)

TOOLS = [
    {
        "name": "get_dashboard",
        "description": "Account-wide totals (revenue, COGS, profit, margin, "
        "amount purchased, inventory on hand) plus a per-product breakdown.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "list_products",
        "description": "List the user's products with their unit and quantity "
        "on hand. Use to find low or out-of-stock items.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "find_product",
        "description": "Look up a single product by name or SKU and return its "
        "financials and stock lots.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Product name or SKU"}
            },
            "required": ["query"],
        },
    },
]


def _tool_executors(user):
    def get_dashboard(_):
        products = list(Product.objects.filter(owner=user))
        breakdown = products_breakdown(products)
        return {
            "totals": user_financials(user),
            "products": [
                {"name": p.name, "sku": p.sku, "unit": p.unit, **breakdown[p.id]}
                for p in products
            ],
        }

    def list_products(_):
        products = list(Product.objects.filter(owner=user))
        breakdown = products_breakdown(products)
        return [
            {
                "name": p.name,
                "sku": p.sku,
                "unit": p.unit,
                "quantity_on_hand": breakdown[p.id]["quantity_on_hand"],
            }
            for p in products
        ]

    def find_product(inp):
        query = (inp.get("query") or "").strip()
        product = (
            Product.objects.filter(owner=user)
            .filter(Q(sku__iexact=query) | Q(name__icontains=query))
            .first()
        )
        if product is None:
            return {"found": False, "query": query}
        return {
            "found": True,
            "name": product.name,
            "sku": product.sku,
            "unit": product.unit,
            "financials": product_financials(product),
            "lots": list(
                StockLot.objects.filter(product=product).values(
                    "lot_code", "unit_cost", "quantity_remaining", "received_date"
                )
            ),
        }

    return {
        "get_dashboard": get_dashboard,
        "list_products": list_products,
        "find_product": find_product,
    }


def run_assistant(user, message: str, history: list) -> str:
    """Answer a question for ``user`` via a Claude tool-use loop."""
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    executors = _tool_executors(user)
    messages = list(history) + [{"role": "user", "content": message}]

    for _ in range(MAX_TOOL_TURNS):
        response = client.messages.create(
            model=settings.ASSISTANT_MODEL,
            max_tokens=2048,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason != "tool_use":
            return "".join(
                b.text for b in response.content if b.type == "text"
            ).strip()

        messages.append({"role": "assistant", "content": response.content})
        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            executor = executors.get(block.name)
            try:
                output = executor(block.input) if executor else {"error": "unknown tool"}
                content = json.dumps(output, default=str)
            except Exception as exc:  # surface tool failures to the model
                content = json.dumps({"error": str(exc)})
            results.append(
                {"type": "tool_result", "tool_use_id": block.id, "content": content}
            )
        messages.append({"role": "user", "content": results})

    return "Sorry, I couldn't work that out — try rephrasing the question."
