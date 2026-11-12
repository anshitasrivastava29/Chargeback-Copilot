"""Create a sandbox capture and dispute through the PayPal REST APIs.

India-region PayPal sandbox accounts are blocked from the "Send payment" UI
("Your account is not supported for this action"), which makes the usual
buyer-pays-then-disputes walkthrough impossible. This script produces the same
result through the APIs:

1. Client-credentials token for the sandbox app (from backend/.env).
2. Create and immediately capture an order from the buyer to the business
   account, using a PayPal-Auth-Assertion header to assert the buyer (the
   sandbox substitute for the buyer approving the payment).
3. Open an "item not received" dispute on that capture via the sandbox-only
   POST /v1/customer/disputes endpoint.

Run from the backend folder:

    python scripts/create_sandbox_dispute.py
    python scripts/create_sandbox_dispute.py --buyer <buyer@personal.example.com> \
        --seller <seller@business.example.com> --amount 75.00

Secrets are read from the app settings and never printed.
"""

import argparse
import base64
import hashlib
import hmac
import json
import sys
import uuid
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings

settings = get_settings()


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def auth_assertion(payer_email: str) -> str:
    """PayPal-Auth-Assertion JWT signed with the app secret (HS256)."""
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(
        json.dumps({"iss": settings.paypal_client_id, "email": payer_email}).encode()
    )
    signing_input = f"{header}.{payload}".encode()
    signature = _b64url(
        hmac.new(
            settings.paypal_client_secret.encode(), signing_input, hashlib.sha256
        ).digest()
    )
    return f"{header}.{payload}.{signature}"


def app_token(client: httpx.Client) -> str:
    response = client.post(
        "/v1/oauth2/token",
        data={"grant_type": "client_credentials"},
        auth=(settings.paypal_client_id, settings.paypal_client_secret),
    )
    if response.status_code != 200:
        raise SystemExit(
            f"Could not get an access token (HTTP {response.status_code}). "
            "Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET in backend/.env."
        )
    return response.json()["access_token"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--buyer",
        default="sb-fckui53749529@personal.example.com",
        help="Sandbox personal (buyer) account email",
    )
    parser.add_argument(
        "--seller",
        default="sb-zlpk653823085@business.example.com",
        help="Sandbox business (merchant) account email",
    )
    parser.add_argument("--amount", default="75.00", help="Capture amount (USD)")
    args = parser.parse_args()

    base = settings.paypal_api_base_url
    headers = {"PayPal-Request-Id": str(uuid.uuid4())}

    # trust_env=False: a malformed local proxy environment variable can crash
    # httpx during mount parsing; PayPal calls never route through a proxy.
    with httpx.Client(
        base_url=base, timeout=settings.paypal_timeout_seconds, trust_env=False
    ) as client:
        token = app_token(client)
        auth = {"Authorization": f"Bearer {token}"}

        order_response = client.post(
            "/v2/checkout/orders",
            headers=auth,
            json={
                "intent": "CAPTURE",
                "purchase_units": [
                    {
                        "reference_id": "CC-SANDBOX-DEMO",
                        "description": "Sandbox order for Chargeback Copilot dispute demo",
                        "custom_id": "CC-SANDBOX-DEMO",
                        "amount": {
                            "currency_code": "USD",
                            "value": args.amount,
                        },
                        "payee": {"email_address": args.seller},
                    }
                ],
            },
        )
        if order_response.status_code != 201:
            raise SystemExit(
                f"Order creation failed (HTTP {order_response.status_code}): "
                f"{order_response.text[:400]}"
            )
        order_id = order_response.json()["id"]
        print(f"order created:   {order_id}")

        capture_response = client.post(
            f"/v2/checkout/orders/{order_id}/capture",
            headers={
                **auth,
                "PayPal-Auth-Assertion": auth_assertion(args.buyer),
                **headers,
            },
            json={},
        )
        if capture_response.status_code != 201:
            raise SystemExit(
                f"Capture failed (HTTP {capture_response.status_code}): "
                f"{capture_response.text[:400]}"
            )
        capture = capture_response.json()["purchase_units"][0]["payments"]["captures"][0]
        capture_id = capture["id"]
        print(f"capture id:      {capture_id} ({capture['amount']['value']} "
              f"{capture['amount']['currency_code']}, {capture['status']})")

        dispute_response = client.post(
            "/v1/customer/disputes",
            headers={
                **auth,
                "PayPal-Auth-Assertion": auth_assertion(args.buyer),
                "PayPal-Request-Id": str(uuid.uuid4()),
            },
            json={
                "dispute_channel": "INTERNAL",
                "reason_type": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
                "disputed_transactions": [
                    {"seller_transaction_id": capture_id}
                ],
            },
        )
        if dispute_response.status_code not in (200, 201):
            raise SystemExit(
                f"Dispute creation failed (HTTP {dispute_response.status_code}): "
                f"{dispute_response.text[:400]}"
            )
        dispute = dispute_response.json()
        print(f"dispute id:      {dispute['dispute_id']}")

    print()
    print("Next: start the API, open PayPal account → Sync sandbox data, and the")
    print("dispute should appear at the top of the Disputes inbox.")


if __name__ == "__main__":
    main()
