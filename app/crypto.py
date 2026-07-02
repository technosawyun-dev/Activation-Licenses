import base64
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding, PublicFormat, PrivateFormat, NoEncryption,
)
from cryptography.fernet import Fernet
from .config import settings


def generate_key_pair() -> tuple[str, str]:
    """Generate a new Ed25519 key pair. Returns (public_b64, private_b64)."""
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    private_b64 = base64.b64encode(
        private_key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
    ).decode()
    public_b64 = base64.b64encode(
        public_key.public_bytes(Encoding.Raw, PublicFormat.Raw)
    ).decode()
    return public_b64, private_b64


def derive_public_key(private_b64: str) -> str:
    """Derive the public key from a raw base64 private key."""
    private_bytes = base64.b64decode(private_b64)
    private_key = Ed25519PrivateKey.from_private_bytes(private_bytes)
    public_bytes = private_key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    return base64.b64encode(public_bytes).decode()


def sign_certificate(private_b64: str, canonical: str) -> str:
    """Sign the canonical license string; return base64 signature."""
    private_bytes = base64.b64decode(private_b64)
    private_key = Ed25519PrivateKey.from_private_bytes(private_bytes)
    signature = private_key.sign(canonical.encode())
    return base64.b64encode(signature).decode()


def make_canonical(license_number: str, customer_name: str, computer_id: str,
                   activation_date: str, license_type: str) -> str:
    return f"{license_number}|{customer_name}|{computer_id}|{activation_date}|{license_type}"


def encrypt_private_key(private_b64: str) -> str:
    f = Fernet(settings.ENCRYPTION_KEY.encode())
    return f.encrypt(private_b64.encode()).decode()


def decrypt_private_key(encrypted: str) -> str:
    f = Fernet(settings.ENCRYPTION_KEY.encode())
    return f.decrypt(encrypted.encode()).decode()
