// [v0 import] Component: FeaturedBooks
// Location: frontend/components/books/featured-books.tsx
// Connect to: GET /api/v1/catalog/books/ — replace hardcoded books array with API response; POST /api/v1/loans/borrow/ — Borrow button
// Mock data: all 4 books are hardcoded (title, author, rating, available, coverGradient); "View all books" button is a placeholder
// Auth: book listing is public; borrow requires JWT token
// TODO: fetch books from API on mount; add router.push("/catalog") to "View all books"; make Borrow button call POST /api/v1/loans/borrow/ with copy id; add "use client" when wiring up interactions
import { Star, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface Book {
  id: number;
  title: string;
  author: string;
  rating: number;
  available: boolean;
  coverGradient: string;
  iconColor: string;
}

const books: Book[] = [
  {
    id: 1,
    title: "The Midnight Library",
    author: "Matt Haig",
    rating: 5,
    available: true,
    coverGradient: "from-blue-500 via-blue-400 to-blue-300",
    iconColor: "text-white",
  },
  {
    id: 2,
    title: "Atomic Habits",
    author: "James Clear",
    rating: 5,
    available: true,
    coverGradient: "from-slate-500 via-blue-500 to-blue-400",
    iconColor: "text-white",
  },
  {
    id: 3,
    title: "Project Hail Mary",
    author: "Andy Weir",
    rating: 4,
    available: false,
    coverGradient: "from-slate-400 via-slate-500 to-blue-500",
    iconColor: "text-white",
  },
  {
    id: 4,
    title: "Tomorrow, and Tomorrow",
    author: "Gabrielle Zevin",
    rating: 4,
    available: true,
    coverGradient: "from-blue-600 via-blue-400 to-slate-400",
    iconColor: "text-white",
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

function BookCover({ gradient, iconColor }: { gradient: string; iconColor: string }) {
  return (
    <div
      className={`relative w-full aspect-[2/3] rounded-md bg-gradient-to-b ${gradient} overflow-hidden shadow-lg`}
    >
      {/* Texture lines */}
      <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-30">
        <div className="h-0.5 bg-white/60 rounded" />
        <div className="h-0.5 bg-white/40 rounded w-3/4" />
        <div className="space-y-1.5">
          <div className="h-0.5 bg-white/30 rounded" />
          <div className="h-0.5 bg-white/30 rounded w-2/3" />
        </div>
      </div>
      {/* Center icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="p-3 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
          <BookOpen className={`w-8 h-8 ${iconColor} opacity-70`} />
        </div>
      </div>
      {/* Shine */}
      <div className="absolute top-0 left-0 w-1/3 h-full bg-white/5" />
    </div>
  );
}

export default function FeaturedBooks() {
  return (
    <section id="catalog" className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Curated picks
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Featured Books
            </h2>
          </div>
          <Button
            variant="outline"
            className="self-start sm:self-auto border-slate-300 text-slate-700 hover:bg-slate-50 bg-white"
            asChild
          >
            <Link href="/catalog">View all books</Link>
          </Button>
        </div>

        {/* Book cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {books.map((book) => (
            <Card
              key={book.id}
              className={`bg-card border-border flex flex-col group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-200/60 hover:border-blue-200 ${
                !book.available ? "opacity-70" : ""
              }`}
            >
              <CardContent className="p-4 flex flex-col gap-4 flex-1">
                {/* Cover */}
                <BookCover gradient={book.coverGradient} iconColor={book.iconColor} />

                {/* Info */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 flex-1">
                      {book.title}
                    </h3>
                    <Badge
                      className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border-0 ${
                        book.available
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {book.available ? "Available" : "Borrowed"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{book.author}</p>
                  <StarRating rating={book.rating} />
                </div>
              </CardContent>

              <CardFooter className="p-4 pt-0">
                <Button
                  className={`w-full h-9 text-sm font-medium ${
                    book.available
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                  disabled={!book.available}
                >
                  {book.available ? "Borrow" : "Unavailable"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
