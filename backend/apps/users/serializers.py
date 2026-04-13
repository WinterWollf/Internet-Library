from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers

from apps.users.models import User


class RegisterSerializer(serializers.Serializer):
    """Validates new-account registration data. Enforces unique email and matching passwords."""

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    # Django's built-in validators enforce minimum length, common-password, and numeric-only checks.
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)
    gender = serializers.ChoiceField(
        choices=User.Gender.choices, required=False, default=""
    )

    def validate_email(self, value):
        # Normalize to lowercase to prevent duplicate accounts differing only by case.
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate(self, data):
        """Cross-field check: password and confirm_password must be identical."""
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        return data


class LoginSerializer(serializers.Serializer):
    """Validates login credentials. No DB lookups — authentication is done in the service layer."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserProfileSerializer(serializers.ModelSerializer):
    """Read/write serializer for the authenticated user's own profile. email, role, and mfa_enabled are read-only."""
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "gender",
            "role",
            "mfa_enabled",
            "avatar_url",
            "email_reminders",
            "email_overdue",
            "email_reservation",
            "email_account_alerts",
        ]
        read_only_fields = ["id", "email", "role", "mfa_enabled", "avatar_url"]

    def get_avatar_url(self, obj):
        # Returns a static avatar path based on role then gender; no user-uploaded images.
        if obj.role == User.Role.ADMIN:
            return "/static/avatars/admin.png"
        if obj.gender == User.Gender.FEMALE:
            return "/static/avatars/female.png"
        if obj.gender == User.Gender.MALE:
            return "/static/avatars/male.png"
        return "/static/avatars/default.png"


class UserAdminSerializer(serializers.ModelSerializer):
    """Full admin-level read-only view of a user including block status and login timestamps."""

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role",
            "is_blocked",
            "blocked_reason",
            "mfa_enabled",
            "gender",
            "is_active",
            "date_joined",
            "last_login",
        ]
        read_only_fields = ["id", "date_joined", "last_login"]


class ChangePasswordSerializer(serializers.Serializer):
    """Validates a password-change request. Requires `request` in serializer context for current-password check."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(
        write_only=True, validators=[validate_password]
    )
    confirm_new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        # Requires `request` in serializer context so we can check the authenticated user.
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, data):
        """Cross-field check: new_password and confirm_new_password must be identical."""
        if data["new_password"] != data["confirm_new_password"]:
            raise serializers.ValidationError(
                {"confirm_new_password": "Passwords do not match."}
            )
        return data
