from rest_framework import serializers

from apps.catalog.models import Book, BookCopy, Review


class BookCopySerializer(serializers.ModelSerializer):
    class Meta:
        model = BookCopy
        fields = ["id", "book", "copy_number", "condition", "is_available", "qr_code", "created_at"]
        read_only_fields = ["id", "created_at"]


class ReviewSerializer(serializers.ModelSerializer):
    reader_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "reader_name", "rating", "content", "is_approved", "created_at"]

    def get_reader_name(self, obj):
        name = f"{obj.reader.first_name} {obj.reader.last_name}".strip()
        return name or obj.reader.email


class BookListSerializer(serializers.ModelSerializer):
    available_copies_count = serializers.IntegerField(read_only=True, default=0)
    average_rating = serializers.FloatField(read_only=True, default=None, allow_null=True)

    class Meta:
        model = Book
        fields = [
            "id", "title", "author", "cover_url", "genres", "language",
            "year_published", "available_copies_count", "average_rating",
        ]


class BookDetailSerializer(serializers.ModelSerializer):
    copies = BookCopySerializer(many=True, read_only=True)
    reviews = serializers.SerializerMethodField()
    available_copies_count = serializers.IntegerField(read_only=True, default=0)
    average_rating = serializers.FloatField(read_only=True, default=None, allow_null=True)
    reviews_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Book
        fields = [
            "id", "ol_id", "isbn", "title", "author", "description",
            "cover_url", "genres", "language", "year_published",
            "copies", "reviews", "average_rating", "reviews_count",
            "available_copies_count", "created_at", "updated_at",
        ]

    def get_reviews(self, obj):
        approved = obj.reviews.filter(is_approved=True)
        return ReviewSerializer(approved, many=True).data


class BookAdminSerializer(serializers.ModelSerializer):
    copies_count = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id", "ol_id", "isbn", "title", "author", "description",
            "cover_url", "genres", "language", "year_published",
            "copies_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_copies_count(self, obj):
        return obj.copies.count()


class OpenLibrarySearchResultSerializer(serializers.Serializer):
    ol_id = serializers.CharField()
    title = serializers.CharField()
    author = serializers.CharField()
    isbn = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    year_published = serializers.IntegerField(allow_null=True, required=False)
    cover_url = serializers.CharField(allow_blank=True)
