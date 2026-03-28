from apps.users.models import User


def register_user(data: dict) -> User:
    """Validate and create a new reader account."""
    email = data["email"].lower()
    user = User(
        email=email,
        username=email,  # username mirrors email; not exposed in UI
        first_name=data["first_name"],
        last_name=data["last_name"],
        gender=data.get("gender", ""),
        role=User.Role.READER,
    )
    user.set_password(data["password"])
    user.save()
    return user


def authenticate_user(email: str, password: str) -> User:
    """Return user if credentials are valid, otherwise raise ValueError."""
    try:
        user = User.objects.get(email=email.lower())
    except User.DoesNotExist:
        raise ValueError("Invalid email or password.")
    if not user.check_password(password):
        raise ValueError("Invalid email or password.")
    if not user.is_active:
        raise ValueError("This account is inactive.")
    return user


def block_user(user_id: int, reason: str, admin=None) -> User:
    """Block a user account with an admin-provided reason."""
    user = User.objects.get(pk=user_id)
    user.is_blocked = True
    user.blocked_reason = reason
    user.save(update_fields=["is_blocked", "blocked_reason"])

    # Notify the blocked user (lazy import to avoid circular dependency)
    try:
        from apps.notifications.tasks import send_notification_email
        send_notification_email.delay(
            user_id,
            "account_blocked",
            {"reason": reason, "overdue_books": []},
        )
    except Exception:  # noqa: BLE001 — never block the service on notification failure
        pass

    return user


def unblock_user(user_id: int, admin: User) -> User:
    """Remove a block from a user account."""
    user = User.objects.get(pk=user_id)
    user.is_blocked = False
    user.blocked_reason = ""
    user.save(update_fields=["is_blocked", "blocked_reason"])
    return user


def enable_mfa(user: User) -> None:
    user.mfa_enabled = True
    user.save(update_fields=["mfa_enabled"])


def disable_mfa(user: User) -> None:
    user.mfa_enabled = False
    user.save(update_fields=["mfa_enabled"])
