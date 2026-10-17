"""Call every JWT route. Start service.py first.

    python client.py
    python client.py http://127.0.0.1:8021
"""

import json
import sys
import urllib.error
import urllib.request
from time import sleep

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8020"


def call(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[int, str]:
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(BASE + path, data=data, method=method)
    if body is not None:
        request.add_header("Content-Type", "application/json")
    if token is not None:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request) as response:
            status = response.status
            text = response.read().decode()
    except urllib.error.HTTPError as error:
        status = error.code
        text = error.read().decode()
    who = "(none)" if token is None else "token"
    print(f"\n{method} {path}  {who}")
    print(f"HTTP {status}")
    print(text)
    return status, text


def login(username: str, password: str) -> str | None:
    status, text = call("POST", "/v1/auth/login", {"username": username, "password": password})
    if status != 200:
        return None
    return json.loads(text)["access_token"]


def main() -> None:
    # call("POST", "/v1/auth/login", {"username": "alice", "password": "nope"})
    # call("POST", "/v1/auth/login", {"username": "carol", "password": "alice-pass"})
    # call("POST", "/v1/auth/login", {})

    alice = login("alice", "alice-pass")
    print(alice)
    # bob = login("bob", "bob-pass")
    # print(bob)
    # admin = login("admin", "admin-pass")
    # print(admin)


    # call("GET", "/v1/me", token=alice)
    # sleep(30)
    # call("GET", "/v1/me", token=alice)

    # call("GET", "/v1/admin/stats", token=alice)
    # call("GET", "/v1/admin/stats", token=admin)

    # call("GET", "/v1/loans/12", token=alice)
    # call("GET", "/v1/loans/12", token=bob)
    # call("GET", "/v1/loans/12", token=admin)
    # call("GET", "/v1/loans/99", token=bob)


if __name__ == "__main__":
    main()