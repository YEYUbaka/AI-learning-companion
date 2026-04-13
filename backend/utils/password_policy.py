import re


MIN_PASSWORD_LENGTH = 6
MAX_PASSWORD_LENGTH = 50
STRONG_PASSWORD_MIN_LENGTH = 8

LOWERCASE_RE = re.compile(r"[a-z]")
UPPERCASE_RE = re.compile(r"[A-Z]")
DIGIT_RE = re.compile(r"\d")
SPECIAL_RE = re.compile(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]")
WHITESPACE_RE = re.compile(r"\s")


def validate_password(password: str) -> None:
    if not password:
        raise ValueError("密码不能为空")
    if len(password) < MIN_PASSWORD_LENGTH or len(password) > MAX_PASSWORD_LENGTH:
        raise ValueError(f"密码长度必须在 {MIN_PASSWORD_LENGTH} 到 {MAX_PASSWORD_LENGTH} 位之间")
    if WHITESPACE_RE.search(password):
        raise ValueError("密码不能包含空格")


def password_character_types(password: str) -> int:
    return sum(
        [
            bool(LOWERCASE_RE.search(password)),
            bool(UPPERCASE_RE.search(password)),
            bool(DIGIT_RE.search(password)),
            bool(SPECIAL_RE.search(password)),
        ]
    )


def get_password_strength(password: str) -> str:
    if not password:
        return "empty"
    if WHITESPACE_RE.search(password):
        return "weak"
    if len(password) < MIN_PASSWORD_LENGTH:
        return "weak"

    char_types = password_character_types(password)
    if len(password) >= STRONG_PASSWORD_MIN_LENGTH and char_types == 4:
        return "strong"
    if len(password) >= STRONG_PASSWORD_MIN_LENGTH and char_types >= 2:
        return "medium"
    return "weak"


def is_strong_password(password: str) -> bool:
    return get_password_strength(password) == "strong"
