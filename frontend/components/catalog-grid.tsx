"use client"

// [v0 import] Component: CatalogGrid
// Location: frontend/components/catalog-grid.tsx
// Connect to: GET /api/v1/catalog/books/ — real book listing with pagination and filtering via URL params
// Auth: public (listing); requires JWT token for Borrow action (handled on detail page)

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Star, BookOpen, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BookListItem, PaginatedResponse } from "@/lib/types"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

// ── Cover image ───────────────────────────────────────────────────────────────

const COVER_GRADIENTS = [
  "from-blue-500 via-blue-400 to-blue-300",
  "from-slate-500 via-blue-500 to-blue-400",
  "from-slate-400 via-slate-500 to-blue-500",
  "from-blue-600 via-blue-400 to-slate-400",
  "from-blue-400 via-blue-300 to-slate-300",
  "from-amber-400 via-blue-400 to-blue-500",
]

function BookCover({ book }: { book: BookListItem }) {
  const [imgError, setImgError] = useState(false)
  const gradient = COVER_GRADIENTS[book.id % COVER_GRADIENTS.length]

  if (book.cover_url && !imgError) {
    return (
      <div className="relative w-full aspect-[2/3] rounded-md overflow-hidden shadow-md">
        <Image
          src={book.cover_url}
          alt={book.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 20vw"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div
      className={`relative w-full aspect-[2/3] rounded-md bg-gradient-to-b ${gradient} overflow-hidden shadow-md`}
    >
      <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-30">
        <div className="h-0.5 bg-white/70 rounded" />
        <div className="h-0.5 bg-white/50 rounded w-3/4" />
        <div className="space-y-1.5">
          <div className="h-0.5 bg-white/40 rounded" />
          <div className="h-0.5 bg-white/40 rounded w-2/3" />
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
          <BookOpen className="w-7 h-7 text-white opacity-80" />
        </div>
      </div>
      <div className="absolute top-0 left-0 w-1/3 h-full bg-white/5" />
    </div>
  )
}

// ── Rating ────────────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number | null }) {
  const r = Math.round(rating ?? 0)
  return (
    <div className="flex items-center gap-0.5" aria-label={`${r} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < r ? "text-yellow-400 fill-yellow-400" : "text-slate-300"
          }`}
        />
      ))}
    </div>
  )
}

// ── Book card ─────────────────────────────────────────────────────────────────

function BookCard({ book }: { book: BookListItem }) {
  const available = book.available_copies_count > 0
  return (
    <Card
      className={`bg-white border-slate-200 flex flex-col group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-200/60 hover:border-blue-200 ${
        !available ? "opacity-70" : ""
      }`}
    >
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <Link href={`/catalog/${book.id}`} className="block">
          <BookCover book={book} />
        </Link>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/catalog/${book.id}`} className="flex-1">
              <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-primary transition-colors">
                {book.title}
              </h3>
            </Link>
            <Badge
              className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border-0 ${
                available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
              }`}
            >
              {available ? "Available" : "Borrowed"}
            </Badge>
          </div>
          <p className="text-xs text-slate-500">{book.author}</p>
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
  )
}

// ── Skeleton cards ────────────────────────────────────────────────────────────

function BookCardSkeleton() {
  return (
    <Card className="bg-white border-slate-200 flex flex-col">
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <Skeleton className="w-full aspect-[2/3] rounded-md" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Skeleton className="w-full h-9 rounded-md" />
      </CardFooter>
    </Card>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

function getPageNumbers(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "…")[] = [1]
  if (page > 3) pages.push("…")
  for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) {
    pages.push(p)
  }
  if (page < total - 2) pages.push("…")
  pages.push(total)
  return pages
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  const pages = getPageNumbers(page, totalPages)

  return (
    <nav className="flex items-center justify-center gap-1 mt-10" aria-label="Catalog pagination">
      <Button
        variant="outline"
        size="sm"
        className="h-9 px-3 border-slate-200 text-slate-600 hover:bg-slate-50 bg-white disabled:opacity-40"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Previous
      </Button>

      <div className="flex items-center gap-1 mx-1">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-slate-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                p === page ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          )
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-9 px-3 border-slate-200 text-slate-600 hover:bg-slate-50 bg-white disabled:opacity-40"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </nav>
  )
}

// ── Main grid component ───────────────────────────────────────────────────────

export default function CatalogGrid() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [books, setBooks] = useState<BookListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState("newest")

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const PAGE_SIZE = 20

  useEffect(() => {
    const params = new URLSearchParams()
    const search = searchParams.get("search")
    const genre = searchParams.get("genre")
    const available = searchParams.get("available")
    const minRating = searchParams.get("min_rating")

    if (search) params.set("search", search)
    if (genre) params.set("genre", genre)
    if (available) params.set("available", available)
    if (minRating) params.set("min_rating", minRating)
    params.set("page", page.toString())

    setLoading(true)
    setError(null)

    fetch(`${API}/catalog/books/?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load books")
        return res.json() as Promise<PaginatedResponse<BookListItem>>
      })
      .then((data) => {
        setBooks(data.results)
        setTotal(data.count)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [searchParams, page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", p.toString())
    router.push(`/catalog?${params.toString()}`)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div>
      {/* Sort/count bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="text-sm text-slate-500">
          {loading ? (
            <Skeleton className="h-4 w-36" />
          ) : error ? (
            <span className="text-red-500">Error loading books</span>
          ) : (
            <>
              Showing{" "}
              <span className="font-semibold text-slate-800">{total} book{total !== 1 ? "s" : ""}</span>{" "}
              found
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 shrink-0">Sort by:</span>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-44 h-9 bg-white border-slate-200 text-slate-700 text-sm focus:ring-primary/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="title-az">Title A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Grid */}
      {!error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <BookCardSkeleton key={i} />)
            : books.length === 0
              ? (
                <div className="col-span-full text-center py-16 text-slate-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No books found for the selected filters.</p>
                </div>
              )
              : books.map((book) => <BookCard key={book.id} book={book} />)
          }
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && (
        <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
      )}
    </div>
  )
}
