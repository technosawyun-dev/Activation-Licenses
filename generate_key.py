"""Run this once to generate the ENCRYPTION_KEY value for your .env file."""
from cryptography.fernet import Fernet
print("ENCRYPTION_KEY=" + Fernet.generate_key().decode())
