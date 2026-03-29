"use client"

// [v0 import] Component: CatalogFilters
// Location: frontend/components/catalog-filters.tsx
// Connect to: GET /api/v1/catalog/books/?search=&genre=&available=&language= — filter params passed via URL to CatalogGrid
// Auth: public

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
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

const LANGUAGES = ["English", "Polish", "German", "French"]

export default function CatalogFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const [genre, setGenre] = useState(searchParams.get("genre") ?? "")
  const [availability, setAvailability] = useState<"all" | "available">(
    searchParams.get("available") === "true" ? "available" : "all"
  )
  const [language, setLanguage] = useState(searchParams.get("language") ?? "")

  // Sync local state when URL changes (e.g., browser back button)
  useEffect(() => {
    setSearch(searchParams.get("search") ?? "")
    setGenre(searchParams.get("genre") ?? "")
    setAvailability(searchParams.get("available") === "true" ? "available" : "all")
    setLanguage(searchParams.get("language") ?? "")
  }, [searchParams])

  function applyFilters() {
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    if (genre) params.set("genre", genre)
    if (availability === "available") params.set("available", "true")
    if (language) params.set("language", language)
    router.push(`/catalog?${params.toString()}`)
  }

  function clearFilters() {
    setSearch("")
    setGenre("")
    setAvailability("all")
    setLanguage("")
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
        {language && (
          <button
            onClick={() => setLanguage("")}
            className="text-xs text-slate-400 hover:text-slate-600 text-left"
          >
            Clear language
          </button>
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
