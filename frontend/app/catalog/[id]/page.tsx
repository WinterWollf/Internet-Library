"use client"

// Location: frontend/app/catalog/[id]/page.tsx
// Connect to:
//   GET  /api/v1/catalog/books/{id}/       — book detail + copies + embedded reviews
//   POST /api/v1/loans/borrow/             — borrow (copy_id)
//   GET  /api/v1/reservations/             — check existing reservation
//   POST /api/v1/reservations/             — reserve (book_id)
//   GET  /api/v1/catalog/reviews/?book=id — refresh reviews after submit
//   POST /api/v1/catalog/reviews/          — submit review
//   GET  /api/v1/catalog/books/?genre=&   — related books
// Auth: public (detail/reviews), JWT required for borrow/reserve/review

import { useEffect, useState } from "react"
import { useParams, useRouter, notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import {
  BookOpen, Star, Heart, ChevronRight, Info, Loader2, QrCode, Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { useAuth } from "@/lib/auth-context"
import { apiGet, apiPost } from "@/lib/api"
import type { BookDetail, BookListItem, BookReview, PaginatedResponse } from "@/lib/types"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

// ─── Cover helpers ────────────────────────────────────────────────────────────

const GRADIENTS = [
  "from-blue-500 via-blue-400 to-blue-300",
  "from-slate-500 via-blue-500 to-blue-400",
  "from-slate-400 via-slate-500 to-blue-500",
  "from-blue-600 via-blue-400 to-slate-400",
  "from-blue-400 via-blue-300 to-slate-300",
  "from-amber-400 via-blue-400 to-blue-500",
]

function GradientCover({ id, large = false }: { id: number; large?: boolean }) {
  const g = GRADIENTS[id % GRADIENTS.length]
  const iconSize = large ? "w-12 h-12" : "w-7 h-7"
  const pad = large ? "p-4" : "p-3"
  return (
    <div className={`relative w-full aspect-[2/3] rounded-xl bg-gradient-to-b ${g} overflow-hidden shadow-lg`}>
      <div className="absolute inset-0 flex flex-col justify-between p-4 opacity-25">
        <div className="h-0.5 bg-white rounded" />
        <div className="h-0.5 bg-white rounded w-3/4" />
        <div className="space-y-1.5">
          <div className="h-0.5 bg-white rounded" />
          <div className="h-0.5 bg-white rounded w-2/3" />
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`${pad} rounded-full bg-white/10 backdrop-blur-sm border border-white/20`}>
          <BookOpen className={`${iconSize} text-white opacity-80`} />
        </div>
      </div>
      <div className="absolute top-0 left-0 w-1/3 h-full bg-white/5" />
    </div>
  )
}

function CoverImage({ book, large = false }: { book: BookDetail; large?: boolean }) {
  const [imgError, setImgError] = useState(false)
  if (book.cover_url && !imgError) {
    return (
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden shadow-lg">
        <Image
          src={book.cover_url}
          alt={book.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 288px"
          onError={() => setImgError(true)}
          priority
        />
      </div>
    )
  }
  return <GradientCover id={book.id} large={large} />
}

// ─── Star rating ──────────────────────────────────────────────────────────────

function StarRating({
  rating,
  size = "sm",
  partial = false,
}: {
  rating: number | null
  size?: "sm" | "md" | "lg"
  partial?: boolean
}) {
  const r = rating ?? 0
  const sizeClass = size === "lg" ? "w-5 h-5" : size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"
  return (
    <div className="flex items-center gap-0.5" aria-label={`${r} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = partial ? i < Math.floor(r) : i < r
        const half = partial && i === Math.floor(r) && r % 1 >= 0.5
        return (
          <Star
            key={i}
            className={`${sizeClass} ${
              filled || half ? "text-yellow-400 fill-yellow-400" : "text-slate-300"
            }`}
          />
        )
      })}
    </div>
  )
}

// ─── Interactive star picker (for review form) ────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          aria-label={`${s} star${s > 1 ? "s" : ""}`}
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              s <= (hover || value)
                ? "text-yellow-400 fill-yellow-400"
                : "text-slate-300"
            }`}
          />
        </button>
      ))}
    </div>
  )
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav aria-label="Breadcrumb" className="py-4 border-b border-slate-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ol className="flex items-center gap-1.5 text-sm text-slate-500 flex-wrap">
          <li><Link href="/" className="hover:text-blue-600 transition-colors">Home</Link></li>
          <li aria-hidden><ChevronRight className="w-3.5 h-3.5 text-slate-400" /></li>
          <li><Link href="/catalog" className="hover:text-blue-600 transition-colors">Catalog</Link></li>
          <li aria-hidden><ChevronRight className="w-3.5 h-3.5 text-slate-400" /></li>
          <li className="text-slate-900 font-medium truncate max-w-xs" aria-current="page">{title}</li>
        </ol>
      </div>
    </nav>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BookDetailSkeleton() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <div className="py-4 border-b border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <main className="flex-1 py-12 lg:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-10">
            <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
              <Skeleton className="w-full aspect-[2/3] rounded-xl" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="flex-1 flex flex-col gap-6">
              <div className="space-y-3">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-3">
                <Skeleton className="h-11 w-40 rounded-lg" />
                <Skeleton className="h-11 w-40 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

// ─── Related book card ────────────────────────────────────────────────────────

function RelatedBookCard({ book }: { book: BookListItem }) {
  const available = book.available_copies_count > 0
  return (
    <Card className={`bg-white border-slate-200 flex flex-col group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-200/60 hover:border-blue-200 ${!available ? "opacity-70" : ""}`}>
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <Link href={`/catalog/${book.id}`} className="block">
          <div className="relative w-full aspect-[2/3] rounded-md overflow-hidden shadow-md">
            {book.cover_url ? (
              <Image src={book.cover_url} alt={book.title} fill className="object-cover" sizes="25vw" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-b ${GRADIENTS[book.id % GRADIENTS.length]} flex items-center justify-center`}>
                <BookOpen className="w-7 h-7 text-white opacity-80" />
              </div>
            )}
          </div>
        </Link>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/catalog/${book.id}`}>
              <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-primary transition-colors">{book.title}</h3>
            </Link>
            <Badge className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border-0 ${available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
              {available ? "Available" : "Borrowed"}
            </Badge>
          </div>
          <p className="text-xs text-slate-500">{book.author}</p>
          <StarRating rating={book.average_rating} size="sm" />
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          className={`w-full h-9 text-sm font-medium ${available ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
          disabled={!available}
          asChild={available}
        >
          {available ? <Link href={`/catalog/${book.id}`}>Borrow</Link> : <span>Unavailable</span>}
        </Button>
      </CardFooter>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookDetailPage() {
  const rawParams = useParams()
  const bookId = Number(rawParams.id)
  const router = useRouter()
  const { user, isAuthenticated, isAdmin } = useAuth()

  const [book, setBook] = useState<BookDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [relatedBooks, setRelatedBooks] = useState<BookListItem[]>([])
  const [reservationId, setReservationId] = useState<number | null>(null)
  const [reservationDone, setReservationDone] = useState(false)

  const [borrowing, setBorrowing] = useState(false)
  const [reserving, setReserving] = useState(false)

  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewContent, setReviewContent] = useState("")
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviews, setReviews] = useState<BookReview[]>([])

  // Admin: add copies form
  const [copyCount, setCopyCount] = useState(1)
  const [copyCondition, setCopyCondition] = useState<"new" | "good" | "worn">("good")
  const [addingCopies, setAddingCopies] = useState(false)

  // ── Fetch book detail ──────────────────────────────────────────────────────

  async function fetchBook() {
    try {
      const data = await apiGet<BookDetail>(`/catalog/books/${bookId}/`)
      setBook(data)
      setReviews(data.reviews)
    } catch (err: unknown) {
      const status = (err as { status?: number }).status
      if (status === 404) notFound()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!bookId) return
    void fetchBook()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])

  // ── Fetch related books once we know the genre ────────────────────────────

  useEffect(() => {
    if (!book?.genres?.length) return
    const genre = book.genres[0]
    fetch(`${API}/catalog/books/?genre=${encodeURIComponent(genre)}&page_size=20`)
      .then(r => r.ok ? r.json() as Promise<PaginatedResponse<BookListItem>> : Promise.reject())
      .then(data => setRelatedBooks(data.results.filter(b => b.id !== bookId).slice(0, 4)))
      .catch(() => { /* no-op */ })
  }, [book, bookId])

  // ── Fetch user's reservations to pre-populate reservation state ───────────

  useEffect(() => {
    if (!isAuthenticated || !book) return
    apiGet<PaginatedResponse<{ id: number; book: { id: number }; status: string }>>("/reservations/")
      .then(data => {
        const match = data.results.find(r => r.book.id === book.id && r.status === "pending")
        if (match) setReservationId(match.id)
      })
      .catch(() => { /* no-op */ })
  }, [isAuthenticated, book])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleBorrow() {
    if (!book) return
    const copy = book.copies.find(c => c.is_available)
    if (!copy) return
    setBorrowing(true)
    try {
      await apiPost("/loans/borrow/", { copy_id: copy.id })
      toast.success("Book borrowed successfully!")
      router.push("/loans")
    } catch (err: unknown) {
      const msg = (err as Error).message
      toast.error(msg ?? "Failed to borrow book")
    } finally {
      setBorrowing(false)
    }
  }

  async function handleReserve() {
    if (!book) return
    setReserving(true)
    try {
      const res = await apiPost<{ id: number }>("/reservations/", { book_id: book.id })
      setReservationId(res.id)
      setReservationDone(true)
      toast.success("Book reserved! We'll notify you when it's available.")
    } catch (err: unknown) {
      const msg = (err as Error).message
      toast.error(msg ?? "Failed to reserve book")
    } finally {
      setReserving(false)
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault()
    if (reviewRating === 0) { toast.error("Please select a rating"); return }
    if (!reviewContent.trim()) { toast.error("Please write your review"); return }
    setSubmittingReview(true)
    try {
      await apiPost<BookReview>("/catalog/reviews/", {
        book: bookId,
        rating: reviewRating,
        content: reviewContent.trim(),
      })
      toast.success("Review submitted! It will appear after approval.")
      setShowReviewForm(false)
      setReviewRating(0)
      setReviewContent("")
      // Refresh book to get updated counts
      const updated = await apiGet<BookDetail>(`/catalog/books/${bookId}/`)
      setBook(updated)
      setReviews(updated.reviews)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === "ALREADY_REVIEWED") {
        toast.error("You have already reviewed this book")
      } else {
        toast.error((err as Error).message ?? "Failed to submit review")
      }
    } finally {
      setSubmittingReview(false)
    }
  }

  async function handleAddCopies(e: React.FormEvent) {
    e.preventDefault()
    if (!book) return
    setAddingCopies(true)
    const maxCopyNumber = book.copies.length > 0
      ? Math.max(...book.copies.map(c => c.copy_number))
      : 0
    try {
      for (let i = 1; i <= copyCount; i++) {
        await apiPost("/admin/catalog/copies/", {
          book: book.id,
          copy_number: maxCopyNumber + i,
          condition: copyCondition,
          is_available: true,
        })
      }
      toast.success(`${copyCount} ${copyCount === 1 ? "copy" : "copies"} added successfully`)
      setCopyCount(1)
      const updated = await apiGet<BookDetail>(`/catalog/books/${bookId}/`)
      setBook(updated)
      setReviews(updated.reviews)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to add copies")
    } finally {
      setAddingCopies(false)
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  if (loading || !book) return <BookDetailSkeleton />

  const available = book.available_copies_count > 0
  const firstAvailableCopy = book.copies.find(c => c.is_available)
  const hasReviewed = reviews.some(r => r.reader === user?.id)
  const hasActiveReservation = reservationId !== null || reservationDone

  const avg = book.average_rating ?? 0
  const starDist = [5, 4, 3, 2, 1].map(s => {
    const count = reviews.filter(r => r.rating === s).length
    const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0
    return { stars: s, pct }
  })

  const metadata = [
    book.genres.length ? { label: "Genre", value: book.genres.slice(0, 2).join(", ") } : null,
    book.language ? { label: "Language", value: book.language } : null,
    book.isbn ? { label: "ISBN", value: book.isbn } : null,
    book.year_published ? { label: "Year published", value: String(book.year_published) } : null,
    { label: "Copies available", value: `${book.available_copies_count} / ${book.copies.length}` },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <Breadcrumb title={book.title} />

      <main className="flex-1">
        {/* ── Main book section ─────────────────────────────────────────── */}
        <section className="py-12 lg:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">

              {/* Left — cover + availability + QR */}
              <div className="flex flex-col items-center lg:items-start gap-5 w-full lg:w-72 shrink-0">
                <CoverImage book={book} large />

                <Badge className={`text-sm font-medium px-3 py-1 rounded-full border-0 ${available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {available ? "Available" : "Borrowed"}
                </Badge>

                {/* QR code */}
                {firstAvailableCopy && (
                  <div className="flex flex-col items-center gap-1.5">
                    {firstAvailableCopy.qr_code ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={firstAvailableCopy.qr_code}
                        alt="QR code for this copy"
                        className="w-20 h-20 rounded-lg border border-slate-200 shadow-sm"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-20 h-20 rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center gap-1">
                          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                        </div>
                        <p className="text-xs text-slate-400 text-center">QR generating…</p>
                      </div>
                    )}
                    {firstAvailableCopy.qr_code && (
                      <p className="text-xs text-slate-400">Copy #{firstAvailableCopy.copy_number}</p>
                    )}
                  </div>
                )}

                {!firstAvailableCopy && (
                  <div className="w-20 h-20 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <QrCode className="w-10 h-10 text-slate-300" />
                  </div>
                )}
              </div>

              {/* Right — details */}
              <div className="flex-1 min-w-0 flex flex-col gap-6">
                <div className="space-y-2">
                  <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
                    {book.title}
                  </h1>
                  <p className="text-lg text-slate-600 font-medium">{book.author}</p>
                  <div className="flex items-center gap-2">
                    <StarRating rating={avg} size="md" partial />
                    <span className="text-sm text-slate-500">
                      {avg > 0 ? avg.toFixed(1) : "No ratings"} · {book.reviews_count} review{book.reviews_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 p-5 bg-slate-50 rounded-xl border border-slate-100">
                  {metadata.map(({ label, value }) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                      <dd className="text-sm font-medium text-slate-800">{value}</dd>
                    </div>
                  ))}
                </div>

                {book.description && (
                  <p className="text-slate-600 leading-relaxed text-base">{book.description}</p>
                )}

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {isAuthenticated && available && (
                    <Button
                      className="h-11 px-8 text-base font-semibold bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => void handleBorrow()}
                      disabled={borrowing}
                    >
                      {borrowing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Borrow this book
                    </Button>
                  )}
                  {!isAuthenticated && available && (
                    <Button className="h-11 px-8 text-base font-semibold bg-blue-600 text-white hover:bg-blue-700" asChild>
                      <Link href={`/login?redirect=/catalog/${bookId}`}>Login to borrow</Link>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="h-11 px-8 text-base font-semibold border-slate-300 text-slate-700 hover:bg-slate-50 bg-white"
                    onClick={() => toast.info("Wishlist coming soon")}
                  >
                    <Heart className="w-4 h-4 mr-2 text-slate-500" />
                    Add to wishlist
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Admin management panel ────────────────────────────────────── */}
        {isAdmin() && (
          <section className="border-t border-amber-200 bg-amber-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Admin panel</span>
              </div>

              {/* Stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-0.5 p-3 bg-white rounded-lg border border-amber-100 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total copies</span>
                  <span className="text-2xl font-bold text-slate-900">{book.copies.length}</span>
                </div>
                <div className="flex flex-col gap-0.5 p-3 bg-white rounded-lg border border-amber-100 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Available</span>
                  <span className="text-2xl font-bold text-green-600">{book.available_copies_count}</span>
                </div>
                <div className="flex flex-col gap-0.5 p-3 bg-white rounded-lg border border-amber-100 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">On loan</span>
                  <span className="text-2xl font-bold text-blue-600">{book.copies.length - book.available_copies_count}</span>
                </div>
                <div className="flex flex-col gap-0.5 p-3 bg-white rounded-lg border border-amber-100 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reserved</span>
                  <span className="text-2xl font-bold text-orange-500">{book.reserved_count}</span>
                </div>
              </div>

              {/* Add copies form */}
              <form onSubmit={(e) => void handleAddCopies(e)} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add copies</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={copyCount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCopyCount(Math.min(20, Math.max(1, Number(e.target.value))))}
                    className="w-20 h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Condition</label>
                  <Select value={copyCondition} onValueChange={(v) => setCopyCondition(v as "new" | "good" | "worn")}>
                    <SelectTrigger className="w-32 h-9 bg-white border-slate-200 text-sm text-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="worn">Worn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  className="h-9 px-4 bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm"
                  disabled={addingCopies}
                >
                  {addingCopies
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <Plus className="w-4 h-4 mr-2" />}
                  Add copies
                </Button>
              </form>
            </div>
          </section>
        )}

        {/* ── Loan info / reserve box ───────────────────────────────────── */}
        {!available && (
          <section className="bg-slate-50 border-y border-slate-100 py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 p-2 rounded-lg bg-blue-50 border border-blue-100 shrink-0">
                    <Info className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900">All copies are currently borrowed.</p>
                    {hasActiveReservation ? (
                      <p className="text-sm text-green-600 font-medium">You have reserved this book. We'll notify you when it's available.</p>
                    ) : (
                      <p className="text-sm text-slate-600">
                        Reserve this book and we'll notify you when a copy becomes available.
                      </p>
                    )}
                  </div>
                </div>
                {isAuthenticated && !hasActiveReservation && (
                  <Button
                    className="bg-blue-600 text-white hover:bg-blue-700 h-9 px-5 shrink-0 font-medium"
                    onClick={() => void handleReserve()}
                    disabled={reserving}
                  >
                    {reserving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Reserve
                  </Button>
                )}
                {!isAuthenticated && !hasActiveReservation && (
                  <Button className="bg-blue-600 text-white hover:bg-blue-700 h-9 px-5 shrink-0 font-medium" asChild>
                    <Link href={`/login?redirect=/catalog/${bookId}`}>Login to reserve</Link>
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Reviews section ───────────────────────────────────────────── */}
        <section className="py-16 lg:py-20 bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-10">
              Reader Reviews
            </h2>

            <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">
              {/* Rating summary */}
              <div className="flex flex-col gap-5 lg:w-64 shrink-0">
                <div className="flex flex-col items-start gap-2">
                  <span className="text-6xl font-extrabold text-slate-900 leading-none">
                    {avg > 0 ? avg.toFixed(1) : "—"}
                  </span>
                  <StarRating rating={avg} size="md" partial />
                  <p className="text-sm text-slate-500">{book.reviews_count} review{book.reviews_count !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {starDist.map(({ stars, pct }) => (
                    <div key={stars} className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="w-3 text-right shrink-0">{stars}</span>
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
                      <Progress value={pct} className="h-2 flex-1 bg-slate-100 [&>div]:bg-blue-500" />
                      <span className="w-7 text-right shrink-0">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Review list + form */}
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                {reviews.length === 0 && (
                  <p className="text-sm text-slate-400 py-4">No reviews yet. Be the first to write one!</p>
                )}
                {reviews.map((review) => {
                  const initials = review.reader_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
                  const date = new Date(review.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  return (
                    <div key={review.id} className="p-5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-white">{initials || "?"}</span>
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-1">
                            <span className="text-sm font-semibold text-slate-800">{review.reader_name}</span>
                            <span className="text-xs text-slate-400">{date}</span>
                          </div>
                          <StarRating rating={review.rating} size="sm" />
                          <p className="text-sm text-slate-600 leading-relaxed">{review.content}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Write review */}
                {isAuthenticated && !hasReviewed && !showReviewForm && (
                  <Button
                    variant="outline"
                    className="self-start mt-2 border-blue-600 text-blue-600 hover:bg-blue-50 bg-white font-semibold"
                    onClick={() => setShowReviewForm(true)}
                  >
                    Write a review
                  </Button>
                )}

                {isAuthenticated && hasReviewed && (
                  <p className="text-sm text-slate-500 mt-2 italic">You have already reviewed this book.</p>
                )}

                {!isAuthenticated && (
                  <Link href={`/login?redirect=/catalog/${bookId}`} className="self-start mt-2">
                    <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50 bg-white font-semibold">
                      Login to write a review
                    </Button>
                  </Link>
                )}

                {/* Review form */}
                {showReviewForm && (
                  <form onSubmit={(e) => void handleSubmitReview(e)} className="mt-2 p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-slate-900">Your review</h3>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Rating</label>
                      <StarPicker value={reviewRating} onChange={setReviewRating} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Review</label>
                      <Textarea
                        value={reviewContent}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReviewContent(e.target.value)}
                        placeholder="Share your thoughts about this book…"
                        className="resize-none min-h-[100px] bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:ring-primary/40"
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700" disabled={submittingReview}>
                        {submittingReview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Submit review
                      </Button>
                      <Button type="button" variant="outline" className="border-slate-300 text-slate-600 bg-white" onClick={() => setShowReviewForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Related books ─────────────────────────────────────────────── */}
        {relatedBooks.length > 0 && (
          <section className="py-16 lg:py-20 bg-slate-50 border-t border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-10">
                You might also like
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {relatedBooks.map(b => <RelatedBookCard key={b.id} book={b} />)}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
