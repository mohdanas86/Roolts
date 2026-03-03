from services.vault import vault

def test_vault():
    print("Testing Vault Pollinations Key...")
    api_key = vault.unseal('pollinations')
    
    if api_key:
        print(f"SUCCESS! Found key: {api_key[:10]}...")
    else:
        print("FAILED: No key found in vault for 'pollinations'. Did you save it via settings?")

if __name__ == "__main__":
    test_vault()
