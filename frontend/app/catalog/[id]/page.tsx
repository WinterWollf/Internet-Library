"use client"

// [v0 import] Component: BookDetailPage
// Location: frontend/app/catalog/[id]/page.tsx
// Connect to: GET /api/v1/catalog/books/{id}/ — book detail; POST /api/v1/loans/borrow/ — Borrow button; POST /api/v1/loans/return/ — Reserve button; GET /api/v1/reviews/ — reviews list; POST /api/v1/reviews/ — Write a review
// Mock data: BOOK, STAR_DISTRIBUTION, REVIEWS, RELATED_BOOKS are all hardcoded static objects; available state never changes; QR code is a placeholder icon
// Auth: public (detail/reviews); requires JWT token for Borrow, Reserve, Write a review
// TODO: accept and use route params.id to fetch real book data from API; extract BookCard into shared component reused from catalog-grid; wire Borrow/Reserve buttons to API; replace QR placeholder with real qr_code image from BookCopy; add loading and error states

import { useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  Star,
  Heart,
  ChevronRight,
  Info,
  QrCode,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RelatedBook {
  id: number
  title: string
  author: string
  rating: number
  available: boolean
  coverGradient: string
}

interface Review {
  id: number
  initials: string
  username: string
  date: string
  rating: number
  text: string
}

// ─── Static data ──────────────────────────────────────────────────────────────

const BOOK = {
  title: "The Midnight Library",
  author: "Matt Haig",
  rating: 4.2,
  reviewCount: 38,
  available: false,
  expectedReturn: "April 12, 2026",
  coverGradient: "from-blue-500 via-blue-400 to-blue-300",
  genre: "Fiction",
  language: "English",
  isbn: "978-0-525-55947-4",
  year: 2020,
  copies: 3,
  description:
    "Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived. To see how things would be if you had made other choices. Would you have done anything different, if you had the chance to undo your regrets? Nora Seed finds herself in that magical place, where she can try on the lives she never lived — and perhaps find the one where she truly belongs.",
}

const STAR_DISTRIBUTION = [
  { stars: 5, pct: 52 },
  { stars: 4, pct: 27 },
  { stars: 3, pct: 12 },
  { stars: 2, pct: 6 },
  { stars: 1, pct: 3 },
]

const REVIEWS: Review[] = [
  {
    id: 1,
    initials: "ER",
    username: "EllaRichards",
    date: "March 14, 2026",
    rating: 5,
    text: "One of the most moving books I have read in years. The premise is deceptively simple but the emotional depth it reaches is extraordinary. Matt Haig writes with such warmth and insight about regret and second chances.",
  },
  {
    id: 2,
    initials: "JM",
    username: "JohnM92",
    date: "February 28, 2026",
    rating: 4,
    text: "A beautiful and thought-provoking novel. Some sections felt slightly repetitive, but the core message about the value of life resonated deeply. Would recommend to anyone going through a difficult period.",
  },
  {
    id: 3,
    initials: "SP",
    username: "SarahP",
    date: "January 10, 2026",
    rating: 4,
    text: "Charming, poignant and surprisingly philosophical. The library metaphor is clever and well-executed. I appreciated the references to quantum physics woven naturally into the narrative.",
  },
]

const RELATED_BOOKS: RelatedBook[] = [
  { id: 2,  title: "Atomic Habits",          author: "James Clear",    rating: 5, available: true,  coverGradient: "from-slate-500 via-blue-500 to-blue-400" },
  { id: 9,  title: "The Hitchhiker's Guide", author: "Douglas Adams",  rating: 5, available: true,  coverGradient: "from-blue-600 via-blue-500 to-blue-400" },
  { id: 14, title: "Brave New World",         author: "Aldous Huxley", rating: 5, available: true,  coverGradient: "from-blue-500 via-slate-500 to-blue-600" },
  { id: 18, title: "1984",                    author: "George Orwell", rating: 5, available: false, coverGradient: "from-slate-600 via-blue-600 to-blue-500" },
]

// ─── Shared sub-components ────────────────────────────────────────────────────

function StarRating({
  rating,
  size = "sm",
  partial = false,
}: {
  rating: number
  size?: "sm" | "md" | "lg"
  partial?: boolean
}) {
  const sizeClass = size === "lg" ? "w-5 h-5" : size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = partial ? i < Math.floor(rating) : i < rating
        const half = partial && i === Math.floor(rating) && rating % 1 >= 0.5
        return (
          <Star
            key={i}
            className={`${sizeClass} ${
              filled || half
                ? "text-yellow-400 fill-yellow-400"
                : "text-slate-300"
            }`}
          />
        )
      })}
    </div>
  )
}

function BookCover({
  gradient,
  size = "normal",
}: {
  gradient: string
  size?: "normal" | "large"
}) {
  const iconSize = size === "large" ? "w-12 h-12" : "w-7 h-7"
  const padding = size === "large" ? "p-4" : "p-3"
  return (
    <div
      className={`relative w-full aspect-[2/3] rounded-xl bg-gradient-to-b ${gradient} overflow-hidden shadow-lg`}
    >
      <div className="absolute inset-0 flex flex-col justify-between p-4 opacity-25">
        <div className="h-0.5 bg-white rounded" />
        <div className="h-0.5 bg-white rounded w-3/4" />
        <div className="space-y-1.5">
          <div className="h-0.5 bg-white rounded" />
          <div className="h-0.5 bg-white rounded w-2/3" />
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`${padding} rounded-full bg-white/10 backdrop-blur-sm border border-white/20`}>
          <BookOpen className={`${iconSize} text-white opacity-80`} />
        </div>
      </div>
      <div className="absolute top-0 left-0 w-1/3 h-full bg-white/5" />
    </div>
  )
}

// ─── Page sections ────────────────────────────────────────────────────────────

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="py-4 border-b border-slate-100 bg-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ol className="flex items-center gap-1.5 text-sm text-slate-500 flex-wrap">
          <li>
            <Link href="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </li>
          <li>
            <Link href="/catalog" className="hover:text-blue-600 transition-colors">
              Catalog
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </li>
          <li className="text-slate-900 font-medium truncate max-w-xs" aria-current="page">
            {title}
          </li>
        </ol>
      </div>
    </nav>
  )
}

function MainBookSection({ available }: { available: boolean }) {
  const metadata = [
    { label: "Genre",            value: BOOK.genre },
    { label: "Language",         value: BOOK.language },
    { label: "ISBN",             value: BOOK.isbn },
    { label: "Year published",   value: String(BOOK.year) },
    { label: "Copies available", value: `${BOOK.copies} total` },
  ]

  return (
    <section className="py-12 lg:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">

          {/* Left — cover + badges */}
          <div className="flex flex-col items-center lg:items-start gap-5 w-full lg:w-72 shrink-0">
            <BookCover gradient={BOOK.coverGradient} size="large" />

            <Badge
              className={`text-sm font-medium px-3 py-1 rounded-full border-0 ${
                available
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {available ? "Available" : "Borrowed"}
            </Badge>

            {/* QR code placeholder */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-20 h-20 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                <QrCode className="w-10 h-10 text-slate-400" />
              </div>
              <p className="text-xs text-slate-400">QR Code</p>
            </div>
          </div>

          {/* Right — info */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            {/* Title + author + rating */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
                {BOOK.title}
              </h1>
              <p className="text-lg text-slate-600 font-medium">{BOOK.author}</p>
              <div className="flex items-center gap-2">
                <StarRating rating={BOOK.rating} size="md" partial />
                <span className="text-sm text-slate-500">
                  {BOOK.rating} · {BOOK.reviewCount} reviews
                </span>
              </div>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 p-5 bg-slate-50 rounded-xl border border-slate-100">
              {metadata.map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {label}
                  </dt>
                  <dd className="text-sm font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </div>

            {/* Description */}
            <p className="text-slate-600 leading-relaxed text-base">
              {BOOK.description}
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className={`h-11 px-8 text-base font-semibold ${
                  available
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
                disabled={!available}
              >
                Borrow this book
              </Button>
              <Button
                variant="outline"
                className="h-11 px-8 text-base font-semibold border-slate-300 text-slate-700 hover:bg-slate-50 bg-white"
              >
                <Heart className="w-4 h-4 mr-2 text-slate-500" />
                Add to wishlist
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LoanInfoBox({ expectedReturn }: { expectedReturn: string }) {
  return (
    <section className="bg-slate-50 border-y border-slate-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-0.5 p-2 rounded-lg bg-blue-50 border border-blue-100 shrink-0">
              <Info className="w-4 h-4 text-blue-600" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">
                All copies are currently borrowed.
              </p>
              <p className="text-sm text-slate-600">
                Expected return:{" "}
                <span className="font-medium text-slate-800">{expectedReturn}</span>
                . You can reserve this book and we will notify you when it becomes available.
              </p>
            </div>
          </div>
          <Button className="bg-blue-600 text-white hover:bg-blue-700 h-9 px-5 shrink-0 font-medium">
            Reserve
          </Button>
        </div>
      </div>
    </section>
  )
}

function ReviewsSection() {
  return (
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
                {BOOK.rating}
              </span>
              <StarRating rating={BOOK.rating} size="md" partial />
              <p className="text-sm text-slate-500">{BOOK.reviewCount} reviews</p>
            </div>

            {/* Bar chart */}
            <div className="flex flex-col gap-2 w-full">
              {STAR_DISTRIBUTION.map(({ stars, pct }) => (
                <div key={stars} className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-3 text-right shrink-0">{stars}</span>
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
                  <Progress
                    value={pct}
                    className="h-2 flex-1 bg-slate-100 [&>div]:bg-blue-500"
                  />
                  <span className="w-7 text-right shrink-0">{pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Review cards + button */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {REVIEWS.map((review) => (
              <div
                key={review.id}
                className="p-5 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0"
                    aria-hidden
                  >
                    <span className="text-xs font-bold text-white">{review.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-1">
                      <span className="text-sm font-semibold text-slate-800">
                        {review.username}
                      </span>
                      <span className="text-xs text-slate-400">{review.date}</span>
                    </div>
                    <StarRating rating={review.rating} size="sm" />
                    <p className="text-sm text-slate-600 leading-relaxed">{review.text}</p>
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="self-start mt-2 border-blue-600 text-blue-600 hover:bg-blue-50 bg-white font-semibold"
            >
              Write a review
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function RelatedBooksSection() {
  return (
    <section className="py-16 lg:py-20 bg-slate-50 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-10">
          You might also like
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {RELATED_BOOKS.map((book) => (
            <Card
              key={book.id}
              className={`bg-white border-slate-200 flex flex-col group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-200/60 hover:border-blue-200 ${
                !book.available ? "opacity-70" : ""
              }`}
            >
              <CardContent className="p-4 flex flex-col gap-3 flex-1">
                <div
                  className={`relative w-full aspect-[2/3] rounded-md bg-gradient-to-b ${book.coverGradient} overflow-hidden shadow-md`}
                >
                  <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-25">
                    <div className="h-0.5 bg-white rounded" />
                    <div className="h-0.5 bg-white rounded w-3/4" />
                    <div className="space-y-1.5">
                      <div className="h-0.5 bg-white rounded" />
                      <div className="h-0.5 bg-white rounded w-2/3" />
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                      <BookOpen className="w-7 h-7 text-white opacity-80" />
                    </div>
                  </div>
                  <div className="absolute top-0 left-0 w-1/3 h-full bg-white/5" />
                </div>
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
                  <div className="flex items-center gap-0.5" aria-label={`${book.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < book.rating
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-slate-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button
                  className={`w-full h-9 text-sm font-medium ${
                    book.available
                      ? "bg-blue-600 text-white hover:bg-blue-700"
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
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookDetailPage() {
  const [available] = useState(BOOK.available)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <Breadcrumb title={BOOK.title} />
      <main className="flex-1">
        <MainBookSection available={available} />
        {!available && <LoanInfoBox expectedReturn={BOOK.expectedReturn} />}
        <ReviewsSection />
        <RelatedBooksSection />
      </main>
      <Footer />
    </div>
  )
}
