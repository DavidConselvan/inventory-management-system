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

from .analytics import (
    product_financials,
    products_breakdown,
    revenue_timeseries,
    user_financials,
)

MAX_TOOL_TURNS = 6

SYSTEM_PROMPT = (
    "You are JP, an AI operations assistant inside an inventory management app "
    "for Food & Beverage CPG brands. You help the signed-in user understand "
    "their products, stock, purchasing, sales and profitability.\n\n"
    "Use the tools to fetch live data before answering anything numeric — never "
    "guess figures. All data is already scoped to the current user. Answer "
    "directly and concisely; do not narrate your reasoning or describe which "
    "tools you are calling. Never open with phrases like 'I'll check' or 'Let me "
    "look' — give the answer immediately. Show money with a $ and two decimals. Margin is "
    "profit divided by cost of goods sold, expressed as a percentage. If the "
    "data doesn't contain the answer, say so briefly.\n\n"
    "Always turn every product you name in prose into a Markdown link to its "
    "page, using the id from tool results, e.g. [Cold Brew Concentrate](/products/12). "
    "Do the same for orders: /sales-orders/<id> and /purchase-orders/<id>. Link "
    "product names in prose even when they also appear in a metric tile.\n\n"
    "When you report headline figures, begin the reply with a fenced code block "
    "tagged `jp-metrics` whose lines are `Label: value` pairs — the UI renders "
    "these as metric tiles. Put the opening ```jp-metrics and the closing ``` "
    "each on their own line, with a blank line after the block, then explain in "
    "prose. Use it for 2-4 key numbers. Example:\n\n"
    "```jp-metrics\nRevenue: $44,440.00\nProfit: $40,210.00\nMargin: 950.6%\n```\n\n"
    "Matcha Powder is your strongest line…"
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
        "name": "get_trends",
        "description": "Monthly time series of revenue, COGS, profit and margin "
        "(% ) from the user's sales history. Use for any 'over time', "
        "'month over month', 'trend' or 'growth' question.",
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
                {"id": p.id, "name": p.name, "sku": p.sku, "unit": p.unit, **breakdown[p.id]}
                for p in products
            ],
        }

    def list_products(_):
        products = list(Product.objects.filter(owner=user))
        breakdown = products_breakdown(products)
        return [
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "unit": p.unit,
                "quantity_on_hand": breakdown[p.id]["quantity_on_hand"],
            }
            for p in products
        ]

    def get_trends(_):
        return revenue_timeseries(user)

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
            "id": product.id,
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
        "get_trends": get_trends,
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


FOLLOWUP_TOOL = {
    "name": "suggest_followups",
    "description": "Return 2-3 short, specific follow-up questions the user might "
    "naturally ask next, each under eight words.",
    "input_schema": {
        "type": "object",
        "properties": {
            "questions": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["questions"],
    },
}


def _suggest_followups(client, question: str, answer: str):
    """One small forced-tool call → JSON follow-up questions. Best-effort."""
    response = client.messages.create(
        model=settings.ASSISTANT_MODEL,
        max_tokens=256,
        system="Suggest brief, specific next questions for an inventory analytics assistant.",
        tools=[FOLLOWUP_TOOL],
        tool_choice={"type": "tool", "name": "suggest_followups"},
        messages=[
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
            {"role": "user", "content": "Suggest 2-3 follow-up questions I might ask next."},
        ],
    )
    for block in response.content:
        if block.type == "tool_use" and block.name == "suggest_followups":
            questions = [str(q) for q in block.input.get("questions", []) if q][:3]
            if questions:
                yield {"type": "followups", "items": questions}
            return


def stream_assistant(user, message: str, history: list):
    """Same tool-use loop as ``run_assistant`` but yields events as they arrive:

    ``{"type": "text", "text": delta}`` for streamed answer tokens, then a final
    ``{"type": "followups", "items": [...]}``. Designed to back a Server-Sent
    Events endpoint so the UI can render JP's reply as it is written.
    """
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    executors = _tool_executors(user)
    messages = list(history) + [{"role": "user", "content": message}]
    answer_parts = []

    for _ in range(MAX_TOOL_TURNS):
        with client.messages.stream(
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
        ) as stream:
            for delta in stream.text_stream:
                answer_parts.append(delta)
                yield {"type": "text", "text": delta}
            final = stream.get_final_message()

        if final.stop_reason != "tool_use":
            break

        messages.append({"role": "assistant", "content": final.content})
        results = []
        for block in final.content:
            if block.type != "tool_use":
                continue
            executor = executors.get(block.name)
            try:
                output = executor(block.input) if executor else {"error": "unknown tool"}
                content = json.dumps(output, default=str)
            except Exception as exc:
                content = json.dumps({"error": str(exc)})
            results.append(
                {"type": "tool_result", "tool_use_id": block.id, "content": content}
            )
        messages.append({"role": "user", "content": results})

    answer = "".join(answer_parts).strip()
    if answer:
        try:
            yield from _suggest_followups(client, message, answer)
        except Exception:
            pass  # follow-ups are a nicety; never fail the response over them
