"use client";

// [v0 import] Component: Hero
// Location: frontend/components/hero.tsx
// Connect to: GET /api/v1/catalog/books/?search= — search bar form submission
// Mock data: badge "10,000+ titles available", stats row (10k+ Books, 2.4k Members, 98% Satisfaction) are hardcoded
// Auth: public
// TODO: wire search bar to router.push("/catalog?search=<query>"); replace hardcoded stats with GET /api/v1/admin/stats/
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function BookStack() {
  const books = [
    { rotate: "-rotate-12", color: "from-blue-700 to-blue-500", z: "z-0", width: "w-24" },
    { rotate: "-rotate-6", color: "from-blue-600 to-blue-400", z: "z-10", width: "w-28" },
    { rotate: "rotate-0", color: "from-blue-500 to-blue-300", z: "z-20", width: "w-32" },
    { rotate: "rotate-6", color: "from-blue-600 to-blue-400", z: "z-10", width: "w-28" },
    { rotate: "rotate-12", color: "from-blue-700 to-blue-500", z: "z-0", width: "w-24" },
  ];

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
        {books.map((book, i) => (
          <div
            key={i}
            className={`relative ${book.rotate} ${book.z} transition-transform duration-300`}
            style={{ marginLeft: i === 0 ? 0 : "-1.5rem" }}
          >
            <div
              className={`${book.width} bg-gradient-to-b ${book.color} rounded-sm shadow-2xl`}
              style={{ height: `${140 + (i === 2 ? 20 : i === 1 || i === 3 ? 10 : 0)}px` }}
            >
              {/* Book spine lines */}
              <div className="h-full flex flex-col justify-between p-2 opacity-40">
                <div className="h-0.5 bg-white/60 rounded" />
                <div className="space-y-1">
                  <div className="h-0.5 bg-white/40 rounded" />
                  <div className="h-0.5 bg-white/40 rounded w-3/4" />
                </div>
              </div>
              {/* Shine */}
              <div className="absolute top-0 left-0 w-1/4 h-full bg-white/5 rounded-l-sm" />
            </div>
          </div>
        ))}
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
              <span className="text-xs text-blue-400 font-medium tracking-wide">10,000+ titles available</span>
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
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-[90%]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-11 focus-visible:ring-primary focus-visible:border-primary w-full"
                  placeholder="Search by title, author or ISBN..."
                  type="search"
                />
              </div>
              <Button className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shrink-0">
                Search
              </Button>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-semibold text-base">10k+</span>
                <span>Books</span>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-semibold text-base">2.4k</span>
                <span>Members</span>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-semibold text-base">98%</span>
                <span>Satisfaction</span>
              </div>
            </div>
          </div>

          {/* Right: decorative books */}
          <div className="hidden lg:flex items-center justify-center">
            <BookStack />
          </div>
        </div>
      </div>
    </section>
  );
}
