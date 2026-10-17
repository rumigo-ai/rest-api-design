"""Rate limit and CORS. Start service.py first. Restart it for a clean window.

    python client.py
    python client.py http://127.0.0.1:8031
"""

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8030"

SHOW = (
    "ratelimit-policy",
    "ratelimit",
    "retry-after",
    "access-control-allow-origin",
    "access-control-allow-methods",
    "access-control-allow-headers",
)


def call(method: str, path: str, body: dict | None = None, headers: dict | None = None) -> int:
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(BASE + path, data=data, method=method)
    if body is not None:
        request.add_header("Content-Type", "application/json")
    for name, value in (headers or {}).items():
        request.add_header(name, value)
    try:
        with urllib.request.urlopen(request) as response:
            status = response.status
            text = response.read().decode()
            response_headers = response.headers
    except urllib.error.HTTPError as error:
        status = error.code
        text = error.read().decode()
        response_headers = error.headers
    print(f"\n{method} {path}")
    print(f"HTTP {status}")
    for name in SHOW:
        value = response_headers.get(name)
        if value is not None:
            print(f"{name}: {value}")
    if text:
        print(text)
    return status


def main() -> None:
    print("--- one book call: the 60-per-minute headers ---")
    call("GET", "/v1/books")

    print("\n--- six logins: five 401s, then 429 ---")
    for attempt in range(1, 7):
        print(f"\nlogin attempt {attempt}")
        call(
            "POST",
            "/v1/auth/login",
            {"username": "alice", "password": "alice-pass"},
        )

    print("\n--- books still answer: login has its own bucket ---")
    call("GET", "/v1/books")

    print("\n--- preflight from the allowed origin ---")
    call(
        "GET",
        "/v1/books",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    print("\n--- another origin is not echoed ---")
    call("GET", "/v1/books", headers={"Origin": "https://evil.example"})

    # for attempt2 in range(1, 61):
    #     call("GET", "/v1/books",
    #     headers={
    #         "Origin": "http://localhost:3000",
    #         "Access-Control-Request-Method": "POST",
    #         "Access-Control-Request-Headers": "authorization,content-type",
    #     },)


if __name__ == "__main__":
    main()
