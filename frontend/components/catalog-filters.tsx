"use client"

// [v0 import] Component: CatalogFilters
// Location: frontend/components/catalog-filters.tsx
// Connect to: GET /api/v1/catalog/books/?search=&genre=&available=&language= — filter params passed to parent/grid
// Mock data: GENRES and LANGUAGES arrays are hardcoded; availability toggle has no API integration
// Auth: public
// TODO: lift filter state to CatalogPage and pass as props/query params to CatalogGrid; wire Apply button to trigger fetch; add URL search params sync

import { useState } from "react"
import { Search, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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

const LANGUAGES = ["English", "Polish", "German", "French"]

export default function CatalogFilters() {
  const [search, setSearch] = useState("")
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [availability, setAvailability] = useState<"all" | "available">("all")
  const [language, setLanguage] = useState("")
  const [minRating, setMinRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    )
  }

  function clearFilters() {
    setSearch("")
    setSelectedGenres([])
    setAvailability("all")
    setLanguage("")
    setMinRating(0)
    setHoverRating(0)
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
            placeholder="Search by title or author..."
            className="pl-9 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:ring-primary/40 h-9 text-sm"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100" />

      {/* Genre */}
      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Genre
        </Label>
        <div className="flex flex-col gap-2.5">
          {GENRES.map((genre) => (
            <div key={genre} className="flex items-center gap-2.5">
              <Checkbox
                id={`genre-${genre}`}
                checked={selectedGenres.includes(genre)}
                onCheckedChange={() => toggleGenre(genre)}
                className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <label
                htmlFor={`genre-${genre}`}
                className="text-sm text-slate-700 cursor-pointer select-none leading-none"
              >
                {genre}
              </label>
            </div>
          ))}
        </div>
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

      {/* Language */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Language
        </Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="bg-slate-50 border-slate-200 text-slate-700 h-9 text-sm focus:ring-primary/40">
            <SelectValue placeholder="All languages" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang} value={lang} className="text-sm">
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100" />

      {/* Rating */}
      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Minimum Rating
        </Label>
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="Minimum star rating filter"
          onMouseLeave={() => setHoverRating(0)}
        >
          {Array.from({ length: 5 }).map((_, i) => {
            const starVal = i + 1
            const filled = starVal <= (hoverRating || minRating)
            return (
              <button
                key={i}
                aria-label={`${starVal} star minimum`}
                onClick={() => setMinRating(starVal === minRating ? 0 : starVal)}
                onMouseEnter={() => setHoverRating(starVal)}
                className="p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                <Star
                  className={`w-6 h-6 transition-colors ${
                    filled
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-slate-300 fill-transparent"
                  }`}
                />
              </button>
            )
          })}
          {minRating > 0 && (
            <span className="text-xs text-slate-500 ml-1">& up</span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100" />

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
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
