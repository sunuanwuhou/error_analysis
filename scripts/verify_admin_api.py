#!/usr/bin/env python3
from __future__ import annotations

import json
import urllib.error
import urllib.request
from http.cookiejar import CookieJar

import os

BASE = os.getenv("XINGCE_BASE_URL", "http://127.0.0.1:8088")


def main() -> None:
    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    login_body = json.dumps({"username": "wesly", "password": "admin123456"}).encode()
    opener.open(
        urllib.request.Request(
            f"{BASE}/api/auth/login",
            data=login_body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
    )
    me = json.loads(opener.open(f"{BASE}/api/me").read())
    print("me:", json.dumps(me, ensure_ascii=False, indent=2))
    admin = opener.open(f"{BASE}/api/admin/users")
    print("admin status:", admin.status)
    data = json.loads(admin.read())
    print("users count:", len(data.get("users", [])))


if __name__ == "__main__":
    main()
