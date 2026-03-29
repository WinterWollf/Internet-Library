// [v0 import] Component: CatalogPage
// Location: frontend/app/catalog/page.tsx
// Connect to: GET /api/v1/catalog/books/ — via CatalogGrid and CatalogFilters children
// Auth: public

import { Suspense } from "react"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import CatalogFilters from "@/components/catalog-filters"
import CatalogGrid from "@/components/catalog-grid"
import { Skeleton } from "@/components/ui/skeleton"

function FiltersSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col gap-6">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-9 w-full" />
      <div className="h-px bg-slate-100" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-9 w-full" />
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
          <Skeleton className="w-full aspect-[2/3] rounded-md" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
    </div>
  )
}

export default function CatalogPage() {
  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Page header */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
              Collection
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-2">
              Book Catalog
            </h1>
            <p className="text-slate-500 text-base">
              Browse our full collection and borrow your next read.
            </p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-row gap-8 items-start">
            {/* Sidebar */}
            <aside className="w-72 shrink-0">
              <Suspense fallback={<FiltersSkeleton />}>
                <CatalogFilters />
              </Suspense>
            </aside>

            {/* Main grid area */}
            <div className="flex-1 min-w-0">
              <Suspense fallback={<GridSkeleton />}>
                <CatalogGrid />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
