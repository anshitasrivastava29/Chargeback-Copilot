import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings


class TokenDecryptionError(ValueError):
    """Raised when a stored PayPal token cannot be decrypted."""


def _fernet(settings: Settings) -> Fernet:
    configured = settings.paypal_token_encryption_key.strip()
    if configured:
        try:
            return Fernet(configured.encode("utf-8"))
        except ValueError as exc:
            raise RuntimeError(
                "PAYPAL_TOKEN_ENCRYPTION_KEY must be a Fernet key. Generate one "
                "with: python -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\""
            ) from exc

    digest = hashlib.sha256(
        f"{settings.jwt_secret}:paypal-oauth-tokens".encode()
    ).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_token(value: str, settings: Settings) -> str:
    return _fernet(settings).encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_token(value: str, settings: Settings) -> str:
    try:
        return _fernet(settings).decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise TokenDecryptionError(
            "The stored PayPal authorization can no longer be decrypted. "
            "Reconnect the PayPal account."
        ) from exc
