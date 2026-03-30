"use client";

// [v0 import] Component: Hero
// Location: frontend/components/hero.tsx
// Connect to: GET /api/v1/catalog/books/?ordering=-created_at&page_size=5 — real covers for book stack
//             GET /api/v1/stats/public/ — real stats row
// Auth: public

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface BookListItem {
  id: number;
  cover_url: string;
  title: string;
}
interface PublicStats {
  total_books: number;
  total_users: number;
  available_copies: number;
}

const BOOK_LAYOUT = [
  { rotate: "-rotate-12", z: "z-0",  width: 96,  height: 140 },
  { rotate: "-rotate-6",  z: "z-10", width: 112, height: 150 },
  { rotate: "rotate-0",   z: "z-20", width: 128, height: 160 },
  { rotate: "rotate-6",   z: "z-10", width: 112, height: 150 },
  { rotate: "rotate-12",  z: "z-0",  width: 96,  height: 140 },
];

const GRADIENTS = [
  "from-blue-700 to-blue-500",
  "from-blue-600 to-blue-400",
  "from-blue-500 to-blue-300",
  "from-blue-600 to-blue-400",
  "from-blue-700 to-blue-500",
];

function BookStack({ covers }: { covers: string[] }) {
  return (
    <div className="relative flex items-center justify-center h-80 lg:h-96 select-none" aria-hidden="true">
      {/* Subtle radial glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-64 h-64 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      {/* Grid backdrop */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.55 0.22 264 / 0.4) 1px, transparent 1px), linear-gradient(90deg, oklch(0.55 0.22 264 / 0.4) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Book stack */}
      <div className="relative flex items-end justify-center gap-1">
        {BOOK_LAYOUT.map((book, i) => {
          const cover = covers[i];
          return (
            <div
              key={i}
              className={`relative ${book.rotate} ${book.z} transition-transform duration-300`}
              style={{ marginLeft: i === 0 ? 0 : "-1.5rem" }}
            >
              <div
                className="rounded-sm shadow-2xl overflow-hidden"
                style={{ width: book.width, height: book.height }}
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt=""
                    width={book.width}
                    height={book.height}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-b ${GRADIENTS[i]}`}>
                    <div className="h-full flex flex-col justify-between p-2 opacity-40">
                      <div className="h-0.5 bg-white/60 rounded" />
                      <div className="space-y-1">
                        <div className="h-0.5 bg-white/40 rounded" />
                        <div className="h-0.5 bg-white/40 rounded w-3/4" />
                      </div>
                    </div>
                    <div className="absolute top-0 left-0 w-1/4 h-full bg-white/5 rounded-l-sm" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating accent dots */}
      <div className="absolute top-8 right-12 w-2 h-2 rounded-full bg-blue-500/60" />
      <div className="absolute top-16 right-6 w-1 h-1 rounded-full bg-blue-400/50" />
      <div className="absolute bottom-10 left-10 w-1.5 h-1.5 rounded-full bg-blue-500/40" />
      <div className="absolute bottom-16 left-20 w-1 h-1 rounded-full bg-blue-400/30" />
    </div>
  );
}

export default function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [covers, setCovers] = useState<string[]>([]);
  const [stats, setStats] = useState<PublicStats | null>(null);

  // Fetch real book covers
  useEffect(() => {
    fetch(`${API}/catalog/books/?ordering=-created_at&page_size=5`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const results = (data.results ?? []) as BookListItem[];
        setCovers(results.map((b) => b.cover_url));
      })
      .catch(() => {/* keep placeholder gradients */});
  }, []);

  // Fetch public stats
  useEffect(() => {
    fetch(`${API}/stats/public/`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setStats(data as PublicStats); })
      .catch(() => {/* fall back to "—" */});
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/catalog?search=${encodeURIComponent(q)}`);
    } else {
      router.push("/catalog");
    }
  }

  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);

  return (
    <section className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center">
      {/* Background subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-blue-50 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: copy + search */}
          <div className="flex flex-col gap-6 lg:gap-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-600/30 bg-blue-600/10 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-blue-400 font-medium tracking-wide">
                {stats ? `${stats.total_books.toLocaleString()} titles available` : "Titles available"}
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight text-balance">
                Discover your next{" "}
                <span className="text-primary">great read.</span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
                Borrow books online, track your loans, and never miss a return date.
                Your library, anywhere you go.
              </p>
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 w-full lg:w-[90%]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-11 focus-visible:ring-primary focus-visible:border-primary w-full"
                  placeholder="Search by title, author or ISBN..."
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shrink-0">
                Search
              </Button>
            </form>

            {/* Stats row */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-semibold text-base">
                  {stats ? fmt(stats.total_books) : "—"}
                </span>
                <span>Books</span>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-semibold text-base">
                  {stats ? fmt(stats.total_users) : "—"}
                </span>
                <span>Members</span>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-semibold text-base">
                  {stats ? fmt(stats.available_copies) : "—"}
                </span>
                <span>Available copies</span>
              </div>
            </div>
          </div>

          {/* Right: decorative books */}
          <div className="hidden lg:flex items-center justify-center">
            <BookStack covers={covers} />
          </div>
        </div>
      </div>
    </section>
  );
}
