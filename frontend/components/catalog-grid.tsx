"use client"

// [v0 import] Component: CatalogGrid
// Location: frontend/components/catalog-grid.tsx
// Connect to: GET /api/v1/catalog/books/ — book listing with pagination and sorting
// Mock data: ALL_BOOKS array is hardcoded; TOTAL=124 is hardcoded; sort has no effect on data; Borrow button has no API call
// Auth: public (listing); requires JWT token for Borrow action
// TODO: replace ALL_BOOKS with fetch to GET /api/v1/catalog/books/?page=&ordering=; wire Borrow button to POST /api/v1/loans/borrow/; accept filter props from parent; handle loading/error states

import { useState } from "react"
import { Star, BookOpen, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Book {
  id: number
  title: string
  author: string
  rating: number
  available: boolean
  coverGradient: string
}

const ALL_BOOKS: Book[] = [
  { id: 1,  title: "The Midnight Library",         author: "Matt Haig",          rating: 5, available: true,  coverGradient: "from-blue-500 via-blue-400 to-blue-300" },
  { id: 2,  title: "Atomic Habits",                author: "James Clear",         rating: 5, available: true,  coverGradient: "from-slate-500 via-blue-500 to-blue-400" },
  { id: 3,  title: "Project Hail Mary",            author: "Andy Weir",           rating: 4, available: false, coverGradient: "from-slate-400 via-slate-500 to-blue-500" },
  { id: 4,  title: "Tomorrow, and Tomorrow",       author: "Gabrielle Zevin",     rating: 4, available: true,  coverGradient: "from-blue-600 via-blue-400 to-slate-400" },
  { id: 5,  title: "Sapiens",                      author: "Yuval Noah Harari",   rating: 5, available: true,  coverGradient: "from-blue-400 via-blue-300 to-slate-300" },
  { id: 6,  title: "Dune",                         author: "Frank Herbert",       rating: 5, available: false, coverGradient: "from-amber-400 via-blue-400 to-blue-500" },
  { id: 7,  title: "The Alchemist",                author: "Paulo Coelho",        rating: 4, available: true,  coverGradient: "from-blue-500 via-slate-400 to-slate-500" },
  { id: 8,  title: "Educated",                     author: "Tara Westover",       rating: 5, available: true,  coverGradient: "from-slate-400 via-blue-400 to-blue-300" },
  { id: 9,  title: "The Hitchhiker's Guide",       author: "Douglas Adams",       rating: 5, available: true,  coverGradient: "from-blue-600 via-blue-500 to-blue-400" },
  { id: 10, title: "A Brief History of Time",      author: "Stephen Hawking",     rating: 4, available: false, coverGradient: "from-slate-500 via-slate-400 to-blue-400" },
  { id: 11, title: "The Great Gatsby",             author: "F. Scott Fitzgerald", rating: 4, available: true,  coverGradient: "from-blue-400 via-blue-500 to-slate-500" },
  { id: 12, title: "Thinking, Fast and Slow",      author: "Daniel Kahneman",     rating: 5, available: true,  coverGradient: "from-blue-300 via-blue-400 to-blue-500" },
  { id: 13, title: "The Power of Now",             author: "Eckhart Tolle",       rating: 4, available: false, coverGradient: "from-slate-300 via-blue-300 to-blue-400" },
  { id: 14, title: "Brave New World",              author: "Aldous Huxley",       rating: 5, available: true,  coverGradient: "from-blue-500 via-slate-500 to-blue-600" },
  { id: 15, title: "Quiet",                        author: "Susan Cain",          rating: 4, available: true,  coverGradient: "from-slate-400 via-blue-300 to-blue-400" },
  { id: 16, title: "The Road",                     author: "Cormac McCarthy",     rating: 5, available: false, coverGradient: "from-slate-500 via-slate-600 to-blue-500" },
  { id: 17, title: "Man's Search for Meaning",     author: "Viktor Frankl",       rating: 5, available: true,  coverGradient: "from-blue-600 via-blue-400 to-blue-300" },
  { id: 18, title: "1984",                         author: "George Orwell",       rating: 5, available: true,  coverGradient: "from-slate-600 via-blue-600 to-blue-500" },
]

const TOTAL = 124
const PAGE_SIZE = 9
const TOTAL_PAGES = Math.ceil(ALL_BOOKS.length / PAGE_SIZE)

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < rating ? "text-yellow-400 fill-yellow-400" : "text-slate-300"
          }`}
        />
      ))}
    </div>
  )
}

function BookCover({ gradient }: { gradient: string }) {
  return (
    <div
      className={`relative w-full aspect-[2/3] rounded-md bg-gradient-to-b ${gradient} overflow-hidden shadow-md`}
    >
      {/* Texture lines */}
      <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-30">
        <div className="h-0.5 bg-white/70 rounded" />
        <div className="h-0.5 bg-white/50 rounded w-3/4" />
        <div className="space-y-1.5">
          <div className="h-0.5 bg-white/40 rounded" />
          <div className="h-0.5 bg-white/40 rounded w-2/3" />
        </div>
      </div>
      {/* Center icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
          <BookOpen className="w-7 h-7 text-white opacity-80" />
        </div>
      </div>
      {/* Shine */}
      <div className="absolute top-0 left-0 w-1/3 h-full bg-white/5" />
    </div>
  )
}

function BookCard({ book }: { book: Book }) {
  return (
    <Card
      className={`bg-white border-slate-200 flex flex-col group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-200/60 hover:border-blue-200 ${
        !book.available ? "opacity-70" : ""
      }`}
    >
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <BookCover gradient={book.coverGradient} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 flex-1">
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
          <p className="text-xs text-slate-500">{book.author}</p>
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
  )
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
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <nav
      className="flex items-center justify-center gap-1 mt-10"
      aria-label="Catalog pagination"
    >
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
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
              p === page
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p}
          </button>
        ))}
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

export default function CatalogGrid() {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState("newest")

  const startIdx = (page - 1) * PAGE_SIZE
  const visibleBooks = ALL_BOOKS.slice(startIdx, startIdx + PAGE_SIZE)

  return (
    <div>
      {/* Sort bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-slate-500">
          Showing{" "}
          <span className="font-semibold text-slate-800">{TOTAL} books</span>{" "}
          found
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 shrink-0">Sort by:</span>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-44 h-9 bg-white border-slate-200 text-slate-700 text-sm focus:ring-primary/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="popular">Most popular</SelectItem>
              <SelectItem value="title-az">Title A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {visibleBooks.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={TOTAL_PAGES}
        onPageChange={(p) => {
          setPage(p)
          window.scrollTo({ top: 0, behavior: "smooth" })
        }}
      />
    </div>
  )
}
