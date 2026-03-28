// [v0 import] Component: CatalogPage
// Location: frontend/app/catalog/page.tsx
// Connect to: GET /api/v1/catalog/books/ — via CatalogGrid and CatalogFilters children
// Mock data: all book data is mocked inside CatalogGrid; filter state is local to CatalogFilters
// Auth: public
// TODO: lift filter state here and pass as props to CatalogGrid; add URL search params for shareable filter URLs

import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import CatalogFilters from "@/components/catalog-filters"
import CatalogGrid from "@/components/catalog-grid"

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
              <CatalogFilters />
            </aside>

            {/* Main grid area */}
            <div className="flex-1 min-w-0">
              <CatalogGrid />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
