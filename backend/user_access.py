from __future__ import annotations

from typing import Literal

PortalModuleKey = Literal["xingce", "xingce_suite", "xingce_bank_drill", "shenlun"]

PORTAL_MODULE_KEYS: tuple[PortalModuleKey, ...] = (
    "xingce",
    "xingce_suite",
    "xingce_bank_drill",
    "shenlun",
)

DEFAULT_NEW_USER_MODULES: tuple[PortalModuleKey, ...] = ("xingce_suite",)

SUPER_ADMIN_USERNAME = "wesly"
USER_ROLE_USER = "user"
USER_ROLE_SUPER_ADMIN = "super_admin"

MODULE_LABELS: dict[str, str] = {
    "xingce": "行测",
    "xingce_suite": "套卷练习",
    "xingce_bank_drill": "套卷模块练",
    "shenlun": "申论",
}


def normalize_username(username: str) -> str:
    return username.strip()


def is_super_admin_username(username: str) -> bool:
    return normalize_username(username).lower() == SUPER_ADMIN_USERNAME


def is_valid_module_key(key: str) -> bool:
    return key in PORTAL_MODULE_KEYS
