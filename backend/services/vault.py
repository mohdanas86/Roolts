"""
Roolts Encrypted Key Vault
===========================
Uses Fernet symmetric encryption to store API keys on disk.
Only the system with the .vault_key file can decrypt them.
"""

import os
import json
import base64
from typing import Optional
from pathlib import Path
from cryptography.fernet import Fernet

# Paths
VAULT_DIR = Path(__file__).resolve().parent.parent / 'config'
VAULT_FILE = VAULT_DIR / 'sealed_secrets.bin'
KEY_FILE = Path(__file__).resolve().parent.parent / '.vault_key'


def _ensure_vault_dir():
    """Create the config directory if it doesn't exist."""
    VAULT_DIR.mkdir(parents=True, exist_ok=True)


def _get_or_create_key() -> bytes:
    """
    Load the master encryption key from disk.
    If it doesn't exist, generate a new one and save it.
    """
    if KEY_FILE.exists():
        return KEY_FILE.read_bytes().strip()
    
    key = Fernet.generate_key()
    KEY_FILE.write_bytes(key)
    print(f"[Vault] Generated new master key at {KEY_FILE}")
    return key


def _get_fernet() -> Fernet:
    """Get a Fernet instance with the master key."""
    return Fernet(_get_or_create_key())


def _load_vault() -> dict:
    """Load and decrypt the entire vault from disk."""
    if not VAULT_FILE.exists():
        print(f"[Vault] No vault file at {VAULT_FILE}")
        return {}
    
    if not KEY_FILE.exists():
        print(f"[Vault] No key file at {KEY_FILE}")
        return {}
    
    try:
        f = _get_fernet()
        encrypted_data = VAULT_FILE.read_bytes()
        decrypted_data = f.decrypt(encrypted_data)
        data = json.loads(decrypted_data.decode('utf-8'))
        print(f"[Vault] Loaded {len(data)} key(s) from vault")
        return data
    except Exception as e:
        print(f"[Vault] Warning: Could not decrypt vault: {e}")
        return {}


def _save_vault(data: dict):
    """Encrypt and save the entire vault to disk."""
    _ensure_vault_dir()
    f = _get_fernet()
    json_bytes = json.dumps(data, indent=2).encode('utf-8')
    encrypted = f.encrypt(json_bytes)
    VAULT_FILE.write_bytes(encrypted)


class VaultService:
    """
    Encrypted key vault for storing API secrets.
    
    Usage:
        vault = VaultService()
        vault.seal('gemini', 'AIza...')
        key = vault.unseal('gemini')  # -> 'AIza...'
    """
    
    def __init__(self):
        self._cache = None
    
    def _get_data(self) -> dict:
        """Always load fresh from disk to avoid stale cache issues."""
        return _load_vault()
    
    def seal(self, key_name: str, key_value: str):
        """Encrypt and store a secret."""
        data = self._get_data()
        data[key_name] = key_value
        _save_vault(data)
        self._cache = data
        print(f"[Vault] Sealed key: {key_name}")
    
    def unseal(self, key_name: str) -> Optional[str]:
        """Decrypt and retrieve a secret."""
        data = self._get_data()
        return data.get(key_name)
    
    def remove(self, key_name: str):
        """Remove a secret from the vault."""
        data = self._get_data()
        if key_name in data:
            del data[key_name]
            _save_vault(data)
            self._cache = data
            print(f"[Vault] Removed key: {key_name}")
    
    def list_sealed(self) -> list:
        """List the names of all sealed keys (not the values)."""
        return list(self._get_data().keys())
    
    def get_all_keys(self) -> dict:
        """Return all decrypted keys as a dict."""
        return dict(self._get_data())
    
    def has_any_keys(self) -> bool:
        """Check if the vault has any keys at all."""
        return len(self._get_data()) > 0


# Singleton instance
vault = VaultService()
