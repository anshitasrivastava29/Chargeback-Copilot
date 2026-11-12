"""Local mock of the PayPal sandbox REST APIs (Disputes, Payments, Orders).

Lets you exercise the Chargeback Copilot PayPal sync end to end without real
developer-dashboard credentials:

    python scripts/mock_paypal_sandbox.py            # listens on 127.0.0.1:9000

Then start the API with:

    PAYPAL_CLIENT_ID=mock PAYPAL_CLIENT_SECRET=mock \
    PAYPAL_API_BASE=http://127.0.0.1:9000 uvicorn app.main:app --port 8000

and use "Sync sandbox data" on the /paypal page. No real PayPal traffic.
"""

import json
from datetime import UTC, datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer

NOW = datetime.now(UTC)


def iso(days_offset: float = 0) -> str:
    return (NOW + timedelta(days=days_offset)).strftime("%Y-%m-%dT%H:%M:%SZ")


DISPUTES = [
    {
        "dispute_id": "PP-D-9001001",
        "create_time": iso(-2),
        "update_time": iso(-2),
        "reason": "ITEM_NOT_RECEIVED",
        "status": "OPEN",
        "dispute_state": "OPEN",
        "dispute_life_cycle_stage": "CHARGEBACK",
        "dispute_channel": "EXTERNAL",
        "disputed_amount": {"value": "249.00", "currency_code": "USD"},
        "seller_transaction_id": "8AB12935KJ7731042",
        "extensions": {"response_required_by": iso(2)},
    },
    {
        "dispute_id": "PP-D-9001002",
        "create_time": iso(-9),
        "update_time": iso(-1),
        "reason": "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
        "status": "RESOLVED",
        "dispute_state": "RESOLVED_SELLER_FAVOR",
        "dispute_life_cycle_stage": "CHARGEBACK",
        "disputed_amount": {"value": "89.99", "currency_code": "USD"},
        "seller_transaction_id": "7RQ19304TN5582019",
    },
]

DETAIL_EXTRAS = {
    "PP-D-9001001": {
        "evidences": [],
        "messages": [],
        "extensions": {"response_required_by": iso(2)},
    },
}

CAPTURES = {
    "8AB12935KJ7731042": {
        "id": "8AB12935KJ7731042",
        "status": "COMPLETED",
        "amount": {"value": "249.00", "currency_code": "USD"},
        "custom_id": "AC-10482",
        "create_time": iso(-9),
    },
}

REFUNDS = {}

ORDER = {
    "id": "ORDER-DEMO-1",
    "status": "COMPLETED",
    "payer": {
        "name": {"given_name": "Jordan", "surname": "Ellis"},
        "email_address": "jordan.ellis@example.com",
    },
    "purchase_units": [
        {
            "items": [
                {
                    "name": "Aero Wireless Headphones",
                    "sku": "AC-HP-201",
                    "quantity": "1",
                    "unit_amount": {"value": "249.00"},
                }
            ],
            "shipping": {
                "name": {"full_name": "Jordan Ellis"},
                "address": {
                    "address_line_1": "482 Willow Lane",
                    "admin_area_2": "Portland",
                    "admin_area_1": "OR",
                    "postal_code": "97205",
                    "country_code": "US",
                },
            },
        }
    ],
}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if self.path == "/v1/oauth2/token":
            self._send(
                200,
                {
                    "access_token": "mock-app-token",
                    "token_type": "Bearer",
                    "expires_in": 3600,
                    "scope": "openid https://uri.paypal.com/services/disputes/read-seller",
                },
            )
            return
        self._send(404, {"name": "INVALID_RESOURCE_ID"})

    def do_GET(self) -> None:
        path = self.path.split("?")[0]

        if path == "/v1/customer/disputes":
            self._send(200, {"items": DISPUTES, "links": []})
            return

        if path.startswith("/v1/customer/disputes/"):
            dispute_id = path[len("/v1/customer/disputes/"):]
            for dispute in DISPUTES:
                if dispute["dispute_id"] == dispute_id:
                    payload = {**dispute, **DETAIL_EXTRAS.get(dispute_id, {})}
                    self._send(200, payload)
                    return
            self._send(404, {"name": "INVALID_RESOURCE_ID"})
            return

        if path.startswith("/v2/payments/captures/"):
            capture_id = path[len("/v2/payments/captures/"):]
            capture = CAPTURES.get(capture_id)
            if capture:
                self._send(200, capture)
            else:
                self._send(404, {"name": "INVALID_RESOURCE_ID"})
            return

        if path.startswith("/v2/payments/refunds/"):
            refund_id = path[len("/v2/payments/refunds/"):]
            refund = REFUNDS.get(refund_id)
            if refund:
                self._send(200, refund)
            else:
                self._send(404, {"name": "INVALID_RESOURCE_ID"})
            return

        if path.startswith("/v2/checkout/orders/"):
            self._send(200, {**ORDER, "id": path[len("/v2/checkout/orders/"):]} )
            return

        self._send(404, {"name": "INVALID_RESOURCE_ID"})

    def log_message(self, format: str, *args) -> None:
        print(f"[mock-paypal] {format % args}")


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 9000), Handler)
    print("Mock PayPal sandbox listening on http://127.0.0.1:9000 (Ctrl+C to stop)")
    server.serve_forever()
