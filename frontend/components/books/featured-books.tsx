// [v0 import] Component: FeaturedBooks
// Location: frontend/components/books/featured-books.tsx
// Connect to: GET /api/v1/catalog/books/ — fetches 4 newest books server-side
// Auth: public (server component — no JWT needed)

import { Star, BookOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { BookListItem, PaginatedResponse } from "@/lib/types";

const INTERNAL_API =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000/api/v1";

const COVER_GRADIENTS = [
  "from-blue-500 via-blue-400 to-blue-300",
  "from-slate-500 via-blue-500 to-blue-400",
  "from-slate-400 via-slate-500 to-blue-500",
  "from-blue-600 via-blue-400 to-slate-400",
];

async function fetchFeaturedBooks(): Promise<BookListItem[]> {
  try {
    const res = await fetch(`${INTERNAL_API}/catalog/books/`, {
      next: { revalidate: 300 }, // ISR: revalidate every 5 minutes
    });
    if (!res.ok) return [];
    const data = (await res.json()) as PaginatedResponse<BookListItem>;
    return data.results.slice(0, 4);
  } catch {
    return [];
  }
}

function StarRating({ rating }: { rating: number | null }) {
  const r = Math.round(rating ?? 0);
  return (
    <div className="flex items-center gap-0.5" aria-label={`${r} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < r ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

function BookCover({ book, index }: { book: BookListItem; index: number }) {
  const gradient = COVER_GRADIENTS[index % COVER_GRADIENTS.length];

  if (book.cover_url) {
    return (
      <div className="relative w-full aspect-[2/3] rounded-md overflow-hidden shadow-lg">
        <Image
          src={book.cover_url}
          alt={book.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full aspect-[2/3] rounded-md bg-gradient-to-b ${gradient} overflow-hidden shadow-lg`}
    >
      <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-30">
        <div className="h-0.5 bg-white/60 rounded" />
        <div className="h-0.5 bg-white/40 rounded w-3/4" />
        <div className="space-y-1.5">
          <div className="h-0.5 bg-white/30 rounded" />
          <div className="h-0.5 bg-white/30 rounded w-2/3" />
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="p-3 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
          <BookOpen className="w-8 h-8 text-white opacity-70" />
        </div>
      </div>
      <div className="absolute top-0 left-0 w-1/3 h-full bg-white/5" />
    </div>
  );
}

export default async function FeaturedBooks() {
  const books = await fetchFeaturedBooks();

  if (books.length === 0) return null;

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
          {books.map((book, i) => {
            const available = book.available_copies_count > 0;
            return (
              <Card
                key={book.id}
                className={`bg-card border-border flex flex-col group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-200/60 hover:border-blue-200 ${
                  !available ? "opacity-70" : ""
                }`}
              >
                <CardContent className="p-4 flex flex-col gap-4 flex-1">
                  <Link href={`/catalog/${book.id}`} className="block">
                    <BookCover book={book} index={i} />
                  </Link>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/catalog/${book.id}`} className="flex-1">
                        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 hover:text-primary transition-colors">
                          {book.title}
                        </h3>
                      </Link>
                      <Badge
                        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border-0 ${
                          available
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {available ? "Available" : "Borrowed"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{book.author}</p>
                    <StarRating rating={book.average_rating} />
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-0">
                  <Button
                    className={`w-full h-9 text-sm font-medium ${
                      available
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                    disabled={!available}
                    asChild={available}
                  >
                    {available ? (
                      <Link href={`/catalog/${book.id}`}>Borrow</Link>
                    ) : (
                      <span>Unavailable</span>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
