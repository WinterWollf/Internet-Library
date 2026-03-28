from rest_framework import serializers

from apps.notifications.models import Notification


class _UserMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()


class NotificationSerializer(serializers.ModelSerializer):
    user = _UserMiniSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id", "user", "type", "loan", "sent_at",
            "channel", "is_sent", "error_message",
        ]
