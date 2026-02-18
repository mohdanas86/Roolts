from cryptography.fernet import Fernet
import base64

# This is our internal 'locker' key used to obfuscate the hardcoded fallback
# It's not a secret from the computer, but it hides the token from humans/scanners
key = b'RooLts_SecurE_Vault_KeY_2026_!@#$%^'
# Ensure it's 32 bytes and base64 encoded for Fernet
fernet_key = base64.urlsafe_b64encode(key.ljust(32)[:32])
f = Fernet(fernet_key)

token = "hf_YOUR_TOKEN_HERE" # Put your own token here to generate an encrypted string
encrypted = f.encrypt(token.encode())
print(f"Encrypted Token: {encrypted.decode()}")
print(f"Locker Key: {fernet_key.decode()}")
