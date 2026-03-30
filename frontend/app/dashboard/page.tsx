"use client"

// Location: frontend/app/dashboard/page.tsx
// Connect to:
//   GET  /api/v1/loans/active/       — active + overdue loans
//   GET  /api/v1/loans/history/      — returned loans (paginated)
//   GET  /api/v1/penalties/          — reader penalties
//   GET  /api/v1/reservations/       — reader reservations
//   GET  /api/v1/stats/me/           — reader stats
//   POST /api/v1/loans/extend/       — extend loan
//   POST /api/v1/loans/return/       — return book
//   POST /api/v1/penalties/{id}/pay/ — pay penalty
//   DELETE /api/v1/reservations/{id}/— cancel reservation
// Auth: requires JWT token (reader role)

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import {
  BookOpen, BookMarked, Clock, AlertCircle, ChevronDown, Info, Loader2, RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { useAuth } from "@/lib/auth-context"
import { apiGet, apiPost, apiDelete } from "@/lib/api"
import type {
  ReaderStats, LoanItem, PenaltyItem, ReservationItem, PaginatedResponse,
} from "@/lib/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

const GRADIENTS = [
  "from-blue-500 via-blue-400 to-blue-300",
  "from-slate-500 via-blue-500 to-blue-400",
  "from-slate-400 via-slate-500 to-blue-500",
  "from-blue-600 via-blue-400 to-slate-400",
  "from-blue-400 via-blue-300 to-slate-300",
  "from-amber-400 via-blue-400 to-blue-500",
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const REASON_LABELS: Record<string, string> = {
  overdue: "Overdue return",
  damage: "Damage",
  loss: "Loss",
}

function MiniCover({ id, coverUrl, title }: { id: number; coverUrl: string; title: string }) {
  const [imgError, setImgError] = useState(false)
  const g = GRADIENTS[id % GRADIENTS.length]
  if (coverUrl && !imgError) {
    return (
      <div className="relative shrink-0 w-10 h-[60px] rounded-md overflow-hidden shadow-sm">
        <Image
          src={coverUrl}
          alt={title}
          fill
          className="object-cover"
          sizes="40px"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }
  return (
    <div className={`relative shrink-0 w-10 h-[60px] rounded-md bg-gradient-to-b ${g} overflow-hidden shadow-sm`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <BookOpen className="w-4 h-4 text-white opacity-80" />
      </div>
      <div className="absolute top-0 left-0 w-1/3 h-full bg-white/10" />
    </div>
  )
}

function DaysChip({ days }: { days: number }) {
  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
        {Math.abs(days)}d overdue
      </span>
    )
  if (days === 0)
    return (
      <span className="inline-flex text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
        Due today
      </span>
    )
  if (days <= 3)
    return (
      <span className="inline-flex text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
        {days}d left
      </span>
    )
  return (
    <span className="inline-flex text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      {days}d left
    </span>
  )
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ── Stats Row ─────────────────────────────────────────────────────────────────

function StatsRow({ stats, loading }: { stats: ReaderStats | null; loading: boolean }) {
  const hasUnpaid = stats && parseFloat(stats.unpaid_penalties_total) > 0

  const cards = [
    {
      icon: BookMarked,
      value: loading ? "—" : String(stats?.active_loans_count ?? 0),
      label: "Active loans",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      highlight: false,
    },
    {
      icon: BookOpen,
      value: loading ? "—" : String(stats?.total_books_read ?? 0),
      label: "Books read",
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
      highlight: false,
    },
    {
      icon: Clock,
      value: loading ? "—" : String(stats?.pending_reservations_count ?? 0),
      label: "Pending reservations",
      iconBg: "bg-yellow-50",
      iconColor: "text-yellow-600",
      highlight: false,
    },
    {
      icon: AlertCircle,
      value: loading ? "—" : `€${parseFloat(stats?.unpaid_penalties_total ?? "0").toFixed(2)}`,
      label: "Outstanding penalties",
      iconBg: hasUnpaid ? "bg-red-50" : "bg-slate-50",
      iconColor: hasUnpaid ? "text-red-600" : "text-slate-400",
      highlight: !!hasUnpaid,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ icon: Icon, value, label, iconBg, iconColor, highlight }) => (
        <Card
          key={label}
          className={`border-slate-200 rounded-xl shadow-sm ${highlight ? "bg-red-50 border-red-100" : "bg-white"}`}
        >
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`shrink-0 w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2} />
            </div>
            <div>
              {loading
                ? <Skeleton className="h-5 w-12 mb-1" />
                : <p className={`text-xl font-bold leading-none ${highlight ? "text-red-700" : "text-slate-900"}`}>{value}</p>
              }
              <p className="text-xs text-slate-500 mt-1 leading-tight">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Active Loans ──────────────────────────────────────────────────────────────

function ActiveLoansSection({
  loans,
  loading,
  onExtend,
  onReturn,
  extending,
  returning,
}: {
  loans: LoanItem[]
  loading: boolean
  onExtend: (id: number) => Promise<void>
  onReturn: (id: number) => Promise<void>
  extending: number | null
  returning: number | null
}) {
  return (
    <section aria-labelledby="active-loans-heading">
      <h2 id="active-loans-heading" className="text-lg font-semibold text-slate-900 mb-4">
        Active Loans
      </h2>

      {loading && <SectionSkeleton rows={3} />}

      {!loading && loans.length === 0 && (
        <div className="p-8 text-center rounded-xl border border-dashed border-slate-200">
          <BookMarked className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">You have no active loans.</p>
          <Link href="/catalog" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
            Browse the catalog to borrow a book
          </Link>
        </div>
      )}

      {!loading && loans.length > 0 && (
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3 w-full">Book</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Borrowed</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Due date</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-5 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans.map((loan) => {
                  const canExtend = loan.prolongation_count < 2 && !loan.is_overdue
                  const extendTitle = loan.prolongation_count >= 2
                    ? "Maximum extensions reached"
                    : loan.is_overdue
                      ? "Cannot extend overdue loan"
                      : undefined
                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <MiniCover
                            id={loan.copy.book.id}
                            coverUrl={loan.copy.book.cover_url}
                            title={loan.copy.book.title}
                          />
                          <div>
                            <p className="font-medium text-slate-900 leading-snug">{loan.copy.book.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{loan.copy.book.author}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{formatDate(loan.borrowed_at)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600">{formatDate(loan.due_date)}</span>
                          {loan.is_overdue && (
                            <Badge className="bg-red-100 text-red-600 border-0 text-xs px-2 py-0.5 rounded-full">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {loan.days_remaining !== null && <DaysChip days={loan.days_remaining} />}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 bg-white disabled:opacity-40"
                            onClick={() => void onExtend(loan.id)}
                            disabled={!canExtend || extending === loan.id}
                            title={extendTitle}
                          >
                            {extending === loan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Extend"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-slate-200 text-slate-500 hover:bg-slate-50 bg-white"
                            onClick={() => void onReturn(loan.id)}
                            disabled={returning === loan.id}
                          >
                            {returning === loan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Return"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-slate-100">
            {loans.map((loan) => {
              const canExtend = loan.prolongation_count < 2 && !loan.is_overdue
              return (
                <div key={loan.id} className="p-4 flex gap-3">
                  <MiniCover
                    id={loan.copy.book.id}
                    coverUrl={loan.copy.book.cover_url}
                    title={loan.copy.book.title}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm leading-snug truncate">{loan.copy.book.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{loan.copy.book.author}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-slate-500">Due: {formatDate(loan.due_date)}</span>
                      {loan.is_overdue && (
                        <Badge className="bg-red-100 text-red-600 border-0 text-xs px-2 py-0.5 rounded-full">Overdue</Badge>
                      )}
                      {loan.days_remaining !== null && <DaysChip days={loan.days_remaining} />}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 bg-white disabled:opacity-40"
                        onClick={() => void onExtend(loan.id)}
                        disabled={!canExtend || extending === loan.id}
                      >
                        {extending === loan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Extend"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-slate-200 text-slate-500 hover:bg-slate-50 bg-white"
                        onClick={() => void onReturn(loan.id)}
                        disabled={returning === loan.id}
                      >
                        {returning === loan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Return"}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </section>
  )
}

// ── Reservations ──────────────────────────────────────────────────────────────

function ReservationsSection({
  reservations,
  loading,
  onCancel,
  cancelling,
}: {
  reservations: ReservationItem[]
  loading: boolean
  onCancel: (id: number) => Promise<void>
  cancelling: number | null
}) {
  const active = reservations.filter(r => r.status === "pending" || r.status === "fulfilled")

  return (
    <section aria-labelledby="reservations-heading">
      <h2 id="reservations-heading" className="text-lg font-semibold text-slate-900 mb-4">
        My Reservations
      </h2>

      {loading && <SectionSkeleton rows={2} />}

      {!loading && active.length === 0 && (
        <div className="p-8 text-center rounded-xl border border-dashed border-slate-200">
          <Clock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">You have no active reservations.</p>
        </div>
      )}

      {!loading && active.length > 0 && (
        <div className="flex flex-col gap-3">
          {active.map((res) => (
            <Card key={res.id} className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <MiniCover id={res.book.id} coverUrl={res.book.cover_url} title={res.book.title} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm leading-snug">{res.book.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{res.book.author}</p>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="text-xs text-slate-500">Reserved: {formatDate(res.reserved_at)}</span>
                    <span className="text-xs text-slate-500">Expires: {formatDate(res.expires_at)}</span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <Badge
                    className={`text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${
                      res.status === "fulfilled" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {res.status === "fulfilled" ? "Ready to borrow" : "Pending"}
                  </Badge>
                  {res.status === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-slate-200 text-slate-500 hover:bg-slate-50 bg-white"
                      onClick={() => void onCancel(res.id)}
                      disabled={cancelling === res.id}
                    >
                      {cancelling === res.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancel"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Penalties ─────────────────────────────────────────────────────────────────

function PenaltiesSection({
  penalties,
  loading,
  onPay,
  paying,
}: {
  penalties: PenaltyItem[]
  loading: boolean
  onPay: (id: number) => Promise<void>
  paying: number | null
}) {
  const unpaid = penalties.filter(p => !p.is_settled)
  const totalUnpaid = unpaid.reduce((sum, p) => sum + parseFloat(p.amount), 0)

  return (
    <section aria-labelledby="penalties-heading">
      <h2 id="penalties-heading" className="text-lg font-semibold text-slate-900 mb-4">
        Penalties
      </h2>

      {loading && <SectionSkeleton rows={2} />}

      {!loading && penalties.length === 0 && (
        <div className="p-8 text-center rounded-xl border border-dashed border-slate-200">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">You have no outstanding penalties.</p>
        </div>
      )}

      {!loading && penalties.length > 0 && (
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3 w-full">Book</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Reason</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Amount</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {penalties.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 font-medium text-slate-900">{p.loan.book_title}</td>
                    <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{REASON_LABELS[p.reason] ?? p.reason}</td>
                    <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">€{parseFloat(p.amount).toFixed(2)}</td>
                    <td className="px-4 py-4">
                      <Badge
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${
                          p.is_settled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}
                      >
                        {p.is_settled ? "Paid" : "Unpaid"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {!p.is_settled && (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-primary text-white hover:bg-primary/90"
                          onClick={() => void onPay(p.id)}
                          disabled={paying === p.id}
                        >
                          {paying === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Pay now"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-slate-100">
            {penalties.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{p.loan.book_title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{REASON_LABELS[p.reason] ?? p.reason} · {formatDate(p.created_at)}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-semibold text-sm text-slate-900">€{parseFloat(p.amount).toFixed(2)}</span>
                    <Badge className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 ${p.is_settled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {p.is_settled ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>
                </div>
                {!p.is_settled && (
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-primary text-white hover:bg-primary/90 shrink-0"
                    onClick={() => void onPay(p.id)}
                    disabled={paying === p.id}
                  >
                    {paying === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Pay now"}
                  </Button>
                )}
              </div>
            ))}
          </div>

          {unpaid.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex justify-end">
              <p className="text-sm text-slate-700">
                Total outstanding:{" "}
                <span className="font-bold text-slate-900">€{totalUnpaid.toFixed(2)}</span>
              </p>
            </div>
          )}
        </Card>
      )}
    </section>
  )
}

// ── Loan History ──────────────────────────────────────────────────────────────

const HISTORY_PAGE_SIZE = 5

function LoanHistorySection({
  history,
  loading,
  hasMore,
  onLoadMore,
  loadingMore,
}: {
  history: LoanItem[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => Promise<void>
  loadingMore: boolean
}) {
  return (
    <section aria-labelledby="loan-history-heading">
      <h2 id="loan-history-heading" className="text-lg font-semibold text-slate-900 mb-4">
        Loan History
      </h2>

      {loading && <SectionSkeleton rows={4} />}

      {!loading && history.length === 0 && (
        <div className="p-8 text-center rounded-xl border border-dashed border-slate-200">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">You have not borrowed any books yet.</p>
        </div>
      )}

      {!loading && history.length > 0 && (
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3 w-full">Book</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Author</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Borrowed</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Returned</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 font-medium text-slate-900">{entry.copy.book.title}</td>
                    <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{entry.copy.book.author}</td>
                    <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{formatDate(entry.borrowed_at)}</td>
                    <td className="px-4 py-4 text-slate-600 whitespace-nowrap">
                      {entry.returned_at ? formatDate(entry.returned_at) : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <Badge className="bg-slate-100 text-slate-600 border-0 text-xs px-2.5 py-0.5 rounded-full">
                        Returned
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-slate-100">
            {history.map((entry) => (
              <div key={entry.id} className="p-4">
                <p className="font-medium text-slate-900 text-sm">{entry.copy.book.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{entry.copy.book.author}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-xs text-slate-500">
                    {formatDate(entry.borrowed_at)} → {entry.returned_at ? formatDate(entry.returned_at) : "—"}
                  </span>
                  <Badge className="bg-slate-100 text-slate-600 border-0 text-xs px-2 py-0.5 rounded-full">Returned</Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 px-5 py-3 flex justify-center">
            {hasMore ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-slate-200 text-slate-500 hover:bg-slate-50 bg-white gap-1.5"
                onClick={() => void onLoadMore()}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <ChevronDown className="w-3.5 h-3.5" />}
                Load more
              </Button>
            ) : (
              <p className="text-xs text-slate-400">All entries shown</p>
            )}
          </div>
        </Card>
      )}
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  const [stats, setStats] = useState<ReaderStats | null>(null)
  const [activeLoans, setActiveLoans] = useState<LoanItem[]>([])
  const [history, setHistory] = useState<LoanItem[]>([])
  const [historyNextUrl, setHistoryNextUrl] = useState<string | null>(null)
  const [penalties, setPenalties] = useState<PenaltyItem[]>([])
  const [reservations, setReservations] = useState<ReservationItem[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Action loading states
  const [extending, setExtending] = useState<number | null>(null)
  const [returning, setReturning] = useState<number | null>(null)
  const [paying, setPaying] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [loansRes, historyRes, penaltiesRes, reservationsRes, statsRes] = await Promise.all([
        apiGet<LoanItem[]>("/loans/active/"),
        apiGet<PaginatedResponse<LoanItem>>(`/loans/history/?page_size=${HISTORY_PAGE_SIZE}`),
        apiGet<PaginatedResponse<PenaltyItem>>("/penalties/"),
        apiGet<PaginatedResponse<ReservationItem>>("/reservations/"),
        apiGet<ReaderStats>("/stats/me/"),
      ])
      setActiveLoans(Array.isArray(loansRes) ? loansRes : [])
      setHistory(historyRes.results)
      setHistoryNextUrl(historyRes.next)
      setPenalties(penaltiesRes.results)
      setReservations(reservationsRes.results)
      setStats(statsRes)
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const s = await apiGet<ReaderStats>("/stats/me/")
      setStats(s)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace("/login?redirect=/dashboard")
      return
    }
    void fetchAll()
  }, [authLoading, isAuthenticated, router, fetchAll])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleExtend(loanId: number) {
    setExtending(loanId)
    try {
      const updated = await apiPost<LoanItem>("/loans/extend/", { loan_id: loanId })
      setActiveLoans(prev => prev.map(l => l.id === loanId ? updated : l))
      toast.success("Loan extended by 30 days")
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to extend loan")
    } finally {
      setExtending(null)
    }
  }

  async function handleReturn(loanId: number) {
    setReturning(loanId)
    try {
      await apiPost("/loans/return/", { loan_id: loanId })
      toast.success("Book returned successfully")
      await fetchAll()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to return book")
    } finally {
      setReturning(null)
    }
  }

  async function handlePay(penaltyId: number) {
    setPaying(penaltyId)
    try {
      const updated = await apiPost<PenaltyItem>(`/penalties/${penaltyId}/pay/`, {})
      setPenalties(prev => prev.map(p => p.id === penaltyId ? updated : p))
      toast.success("Penalty paid")
      void fetchStats()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to pay penalty")
    } finally {
      setPaying(null)
    }
  }

  async function handleCancel(reservationId: number) {
    setCancelling(reservationId)
    try {
      await apiDelete(`/reservations/${reservationId}/`)
      setReservations(prev => prev.filter(r => r.id !== reservationId))
      toast.success("Reservation cancelled")
      void fetchStats()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to cancel reservation")
    } finally {
      setCancelling(null)
    }
  }

  async function handleLoadMore() {
    if (!historyNextUrl) return
    setLoadingMore(true)
    try {
      const data = await apiGet<PaginatedResponse<LoanItem>>(historyNextUrl.replace(/^.*\/api\/v1/, ""))
      setHistory(prev => [...prev, ...data.results])
      setHistoryNextUrl(data.next)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to load more")
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Redirect / loading guard ───────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex flex-col gap-8">
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <SectionSkeleton rows={3} />
        </main>
        <Footer />
      </div>
    )
  }

  const overdueLoan = activeLoans.find(l => l.is_overdue)

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-3xl font-bold text-slate-900 text-balance">
              Welcome back,{" "}
              <span className="text-primary">{user?.first_name || user?.email?.split("@")[0] || "Reader"}</span>
            </h1>
            <p className="mt-1.5 text-slate-500 text-base">
              {"Here's an overview of your library activity."}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-10">

          {/* Global error */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-5 flex items-center gap-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 bg-white gap-1.5"
                onClick={() => void fetchAll()}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            </div>
          )}

          {/* Stats */}
          <StatsRow stats={stats} loading={loading} />

          {/* Active Loans */}
          <ActiveLoansSection
            loans={activeLoans}
            loading={loading}
            onExtend={handleExtend}
            onReturn={handleReturn}
            extending={extending}
            returning={returning}
          />

          {/* Overdue info box */}
          {!loading && overdueLoan && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 flex gap-4">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1">
                <p className="text-sm text-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-900">{overdueLoan.copy.book.title}</span> is overdue.
                  A penalty of <span className="font-semibold">€0.50 per day</span> is being applied.
                  Please return the book as soon as possible.
                </p>
              </div>
            </div>
          )}

          {/* Reservations */}
          <ReservationsSection
            reservations={reservations}
            loading={loading}
            onCancel={handleCancel}
            cancelling={cancelling}
          />

          {/* Penalties */}
          <PenaltiesSection
            penalties={penalties}
            loading={loading}
            onPay={handlePay}
            paying={paying}
          />

          {/* Loan History */}
          <LoanHistorySection
            history={history}
            loading={loading}
            hasMore={historyNextUrl !== null}
            onLoadMore={handleLoadMore}
            loadingMore={loadingMore}
          />
        </div>
      </main>

      <Footer />
    </div>
  )
}
