from services.multi_ai import PollinationsProvider

def test_api():
    print("Testing multi_ai Pollinations Provider with actual requests loop...")
    provider = PollinationsProvider()
    res = provider.generate("Explain how Python dictionary comprehensions work in 2 sentences.")
    print("Result:")
    print(res)

if __name__ == "__main__":
    test_api()
