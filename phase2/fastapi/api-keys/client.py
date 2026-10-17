"""Three calls against the API key server. Start service.py first.

    python client.py
    python client.py http://127.0.0.1:8011
"""

import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8010"
DEMO_KEY = "demo-key-123"


def call(path: str, key: str | None) -> None:
    request = urllib.request.Request(BASE + path)
    if key is not None:
        request.add_header("X-API-Key", key)
    try:
        with urllib.request.urlopen(request) as response:
            status = response.status
            body = response.read().decode()
    except urllib.error.HTTPError as error:
        status = error.code
        body = error.read().decode()
    shown = "(none)" if key is None else key
    print(f"\n{path}  key={shown}")
    print(f"HTTP {status}")
    print(body)


def main() -> None:
    call("/v1/health", None)
    call("/v1/admin/stats", DEMO_KEY)
    call("/v1/admin/stats", "nope")


if __name__ == "__main__":
    main()
