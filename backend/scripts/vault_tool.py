#!/usr/bin/env python3
"""
Roolts Vault CLI Tool
======================
Manage encrypted API keys for the Roolts platform.

Usage:
    python vault_tool.py add <provider> <api_key>
    python vault_tool.py remove <provider>
    python vault_tool.py list
    python vault_tool.py test

Providers: gemini, claude, deepseek, qwen, huggingface

Examples:
    python vault_tool.py add gemini AIzaSy...
    python vault_tool.py add deepseek sk-...
    python vault_tool.py list
"""

import sys
import os

# Add parent directory to path so we can import vault
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.vault import VaultService

VALID_PROVIDERS = ['gemini', 'claude', 'deepseek', 'qwen', 'huggingface']


def print_banner():
    print()
    print("  ╔═══════════════════════════════════════╗")
    print("  ║     🔐 Roolts Key Vault Manager       ║")
    print("  ╚═══════════════════════════════════════╝")
    print()


def cmd_add(provider: str, api_key: str):
    if provider not in VALID_PROVIDERS:
        print(f"  ❌ Unknown provider '{provider}'.")
        print(f"     Valid: {', '.join(VALID_PROVIDERS)}")
        return
    
    vault = VaultService()
    vault.seal(provider, api_key)
    
    masked = api_key[:6] + '...' + api_key[-4:] if len(api_key) > 10 else '****'
    print(f"  ✅ Sealed '{provider}' key: {masked}")
    print(f"     This key is now encrypted and ready for all users.")


def cmd_remove(provider: str):
    vault = VaultService()
    if provider not in vault.list_sealed():
        print(f"  ⚠️  Provider '{provider}' is not in the vault.")
        return
    
    vault.remove(provider)
    print(f"  ✅ Removed '{provider}' key from the vault.")


def cmd_list():
    vault = VaultService()
    keys = vault.list_sealed()
    
    if not keys:
        print("  📭 Vault is empty. No API keys stored.")
        print()
        print("  To add a key:")
        print("    python vault_tool.py add gemini YOUR_API_KEY")
        return
    
    print(f"  📦 Vault contains {len(keys)} key(s):")
    print()
    for name in keys:
        value = vault.unseal(name)
        masked = value[:6] + '...' + value[-4:] if value and len(value) > 10 else '****'
        status = '✅' if name in VALID_PROVIDERS else '⚠️'
        print(f"    {status} {name:15s} → {masked}")


def cmd_test():
    vault = VaultService()
    keys = vault.list_sealed()
    
    if not keys:
        print("  ❌ No keys to test. Add some first.")
        return
    
    print("  🧪 Testing vault encryption round-trip...")
    
    test_vault = VaultService()
    for name in keys:
        value = test_vault.unseal(name)
        if value:
            print(f"    ✅ {name}: decrypted successfully ({len(value)} chars)")
        else:
            print(f"    ❌ {name}: decryption FAILED")
    
    print()
    print("  All good! The vault is working correctly.")


def main():
    print_banner()
    
    if len(sys.argv) < 2:
        print("  Usage:")
        print("    python vault_tool.py add <provider> <api_key>")
        print("    python vault_tool.py remove <provider>")
        print("    python vault_tool.py list")
        print("    python vault_tool.py test")
        print()
        print(f"  Valid providers: {', '.join(VALID_PROVIDERS)}")
        return
    
    command = sys.argv[1].lower()
    
    if command == 'add':
        if len(sys.argv) < 4:
            print("  Usage: python vault_tool.py add <provider> <api_key>")
            return
        cmd_add(sys.argv[2].lower(), sys.argv[3])
    
    elif command == 'remove':
        if len(sys.argv) < 3:
            print("  Usage: python vault_tool.py remove <provider>")
            return
        cmd_remove(sys.argv[2].lower())
    
    elif command == 'list':
        cmd_list()
    
    elif command == 'test':
        cmd_test()
    
    else:
        print(f"  ❌ Unknown command '{command}'.")
        print("     Use: add, remove, list, test")

    print()


if __name__ == '__main__':
    main()
