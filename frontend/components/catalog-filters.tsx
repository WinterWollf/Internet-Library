"use client"

// [v0 import] Component: CatalogFilters
// Location: frontend/components/catalog-filters.tsx
// Connect to: GET /api/v1/catalog/books/?search=&genre=&available=&min_rating= — filter params passed via URL to CatalogGrid
// Auth: public

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const GENRES = [
  "Fiction",
  "Non-fiction",
  "Science",
  "History",
  "Biography",
  "Fantasy",
  "Other",
]

export default function CatalogFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const [genre, setGenre] = useState(searchParams.get("genre") ?? "")
  const [availability, setAvailability] = useState<"all" | "available">(
    searchParams.get("available") === "true" ? "available" : "all"
  )
  const [minRating, setMinRating] = useState<number>(
    Number(searchParams.get("min_rating") ?? 0)
  )

  // Sync local state when URL changes (e.g., browser back button)
  useEffect(() => {
    setSearch(searchParams.get("search") ?? "")
    setGenre(searchParams.get("genre") ?? "")
    setAvailability(searchParams.get("available") === "true" ? "available" : "all")
    setMinRating(Number(searchParams.get("min_rating") ?? 0))
  }, [searchParams])

  function applyFilters() {
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    if (genre) params.set("genre", genre)
    if (availability === "available") params.set("available", "true")
    if (minRating > 0) params.set("min_rating", String(minRating))
    router.push(`/catalog?${params.toString()}`)
  }

  function clearFilters() {
    setSearch("")
    setGenre("")
    setAvailability("all")
    setMinRating(0)
    router.push("/catalog")
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col gap-6 sticky top-20">
      {/* Search */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Search
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilters() }}
            placeholder="Search by title or author..."
            className="pl-9 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:ring-primary/40 h-9 text-sm"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100" />

      {/* Genre */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Genre
        </Label>
        <Select value={genre} onValueChange={setGenre}>
          <SelectTrigger className="bg-slate-50 border-slate-200 text-slate-700 h-9 text-sm focus:ring-primary/40">
            <SelectValue placeholder="All genres" />
          </SelectTrigger>
          <SelectContent>
            {GENRES.map((g) => (
              <SelectItem key={g} value={g} className="text-sm">
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {genre && (
          <button
            onClick={() => setGenre("")}
            className="text-xs text-slate-400 hover:text-slate-600 text-left"
          >
            Clear genre
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100" />

      {/* Availability toggle */}
      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Availability
        </Label>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {(["all", "available"] as const).map((val) => (
            <button
              key={val}
              onClick={() => setAvailability(val)}
              className={`flex-1 py-1.5 text-center capitalize transition-colors ${
                availability === val
                  ? "bg-primary text-white font-medium"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {val === "all" ? "All" : "Available only"}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100" />

      {/* Minimum rating */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Minimum rating
        </Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setMinRating(minRating === star ? 0 : star)}
              aria-label={`${star} star${star !== 1 ? "s" : ""} minimum`}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={`w-5 h-5 transition-colors ${
                  star <= minRating
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-300 hover:text-amber-300"
                }`}
              />
            </button>
          ))}
          {minRating > 0 && (
            <button
              onClick={() => setMinRating(0)}
              className="ml-1 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>
        {minRating > 0 && (
          <p className="text-xs text-slate-500">{minRating}+ stars</p>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100" />

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button
          onClick={applyFilters}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
        >
          Apply filters
        </Button>
        <button
          onClick={clearFilters}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors text-center"
        >
          Clear filters
        </button>
      </div>
    </div>
  )
}
