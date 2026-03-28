"use client"

// [v0 import] Component: DashboardPage
// Location: frontend/app/dashboard/page.tsx
// Connect to: GET /api/v1/loans/active — ActiveLoansSection; GET /api/v1/loans/history — LoanHistorySection; GET /api/v1/penalties/ — PenaltiesSection; POST /api/v1/loans/extend — Extend button; POST /api/v1/loans/return — Return button; POST /api/v1/penalties/pay — Pay now button
// Mock data: ACTIVE_LOANS, RESERVATIONS, PENALTIES, HISTORY are all hardcoded; username "Alex" is hardcoded; stat card values are hardcoded; overdue info box is always visible
// Auth: requires JWT token (reader role)
// TODO: fetch all sections from API using reader's JWT; replace hardcoded username with auth context; derive stat card values from fetched data; show overdue info box conditionally; wire Extend/Return/Pay/Cancel/Reserve buttons to API; add loading skeletons

import { useState } from "react"
import {
  BookOpen,
  BookMarked,
  Clock,
  AlertCircle,
  Star,
  ChevronDown,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ActiveLoan {
  id: number
  title: string
  author: string
  coverGradient: string
  borrowDate: string
  dueDate: string
  daysRemaining: number
}

interface Reservation {
  id: number
  title: string
  author: string
  coverGradient: string
  reservedDate: string
  expiryDate: string
  ready: boolean
}

interface Penalty {
  id: number
  title: string
  reason: string
  amount: number
  date: string
  paid: boolean
}

interface HistoryEntry {
  id: number
  title: string
  author: string
  borrowDate: string
  returnDate: string
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const ACTIVE_LOANS: ActiveLoan[] = [
  {
    id: 1,
    title: "The Midnight Library",
    author: "Matt Haig",
    coverGradient: "from-blue-500 via-blue-400 to-blue-300",
    borrowDate: "14 Mar 2026",
    dueDate: "4 Apr 2026",
    daysRemaining: 7,
  },
  {
    id: 2,
    title: "Atomic Habits",
    author: "James Clear",
    coverGradient: "from-slate-500 via-blue-500 to-blue-400",
    borrowDate: "20 Mar 2026",
    dueDate: "29 Mar 2026",
    daysRemaining: 1,
  },
  {
    id: 3,
    title: "Project Hail Mary",
    author: "Andy Weir",
    coverGradient: "from-slate-400 via-slate-500 to-blue-500",
    borrowDate: "1 Mar 2026",
    dueDate: "22 Mar 2026",
    daysRemaining: -6,
  },
]

const RESERVATIONS: Reservation[] = [
  {
    id: 1,
    title: "Dune",
    author: "Frank Herbert",
    coverGradient: "from-amber-400 via-blue-400 to-blue-500",
    reservedDate: "20 Mar 2026",
    expiryDate: "10 Apr 2026",
    ready: false,
  },
  {
    id: 2,
    title: "Sapiens",
    author: "Yuval Noah Harari",
    coverGradient: "from-blue-400 via-blue-300 to-slate-300",
    reservedDate: "25 Mar 2026",
    expiryDate: "15 Apr 2026",
    ready: true,
  },
]

const PENALTIES: Penalty[] = [
  {
    id: 1,
    title: "Project Hail Mary",
    reason: "Overdue return",
    amount: 2.5,
    date: "22 Mar 2026",
    paid: false,
  },
  {
    id: 2,
    title: "Brave New World",
    reason: "Overdue return",
    amount: 1.0,
    date: "8 Jan 2026",
    paid: true,
  },
]

const HISTORY: HistoryEntry[] = [
  { id: 1, title: "Sapiens",                 author: "Yuval Noah Harari", borrowDate: "1 Jan 2026",  returnDate: "18 Jan 2026" },
  { id: 2, title: "Educated",                author: "Tara Westover",     borrowDate: "10 Feb 2026", returnDate: "27 Feb 2026" },
  { id: 3, title: "Brave New World",         author: "Aldous Huxley",     borrowDate: "5 Dec 2025",  returnDate: "22 Dec 2025" },
  { id: 4, title: "Thinking, Fast and Slow", author: "Daniel Kahneman",   borrowDate: "1 Nov 2025",  returnDate: "20 Nov 2025" },
]

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function MiniCover({ gradient }: { gradient: string }) {
  return (
    <div
      className={`relative shrink-0 w-10 h-[60px] rounded-md bg-gradient-to-b ${gradient} overflow-hidden shadow-sm`}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <BookOpen className="w-4 h-4 text-white opacity-80" />
      </div>
      <div className="absolute top-0 left-0 w-1/3 h-full bg-white/10" />
    </div>
  )
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < rating ? "text-yellow-400 fill-yellow-400" : "text-slate-300"}`}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat Cards
// ---------------------------------------------------------------------------
const STATS = [
  { icon: BookMarked,  value: "2",     label: "Active loans",          iconBg: "bg-blue-50",   iconColor: "text-blue-600" },
  { icon: BookOpen,    value: "14",    label: "Books read",            iconBg: "bg-green-50",  iconColor: "text-green-600" },
  { icon: Clock,       value: "1",     label: "Pending reservation",   iconBg: "bg-yellow-50", iconColor: "text-yellow-600" },
  { icon: AlertCircle, value: "€2.50", label: "Outstanding penalties", iconBg: "bg-red-50",    iconColor: "text-red-600" },
]

function StatsRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {STATS.map(({ icon: Icon, value, label, iconBg, iconColor }) => (
        <Card key={label} className="bg-white border-slate-200 rounded-xl shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`shrink-0 w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
              <p className="text-xs text-slate-500 mt-1 leading-tight">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Active Loans
// ---------------------------------------------------------------------------
function DaysChip({ days }: { days: number }) {
  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
        {Math.abs(days)}d overdue
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

function ActiveLoansSection() {
  return (
    <section aria-labelledby="active-loans-heading">
      <h2 id="active-loans-heading" className="text-lg font-semibold text-slate-900 mb-4">
        Active Loans
      </h2>
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop table */}
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
              {ACTIVE_LOANS.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <MiniCover gradient={loan.coverGradient} />
                      <div>
                        <p className="font-medium text-slate-900 leading-snug">{loan.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{loan.author}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{loan.borrowDate}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600">{loan.dueDate}</span>
                      {loan.daysRemaining < 0 && (
                        <Badge className="bg-red-100 text-red-600 border-0 text-xs px-2 py-0.5 rounded-full">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <DaysChip days={loan.daysRemaining} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 bg-white"
                      >
                        Extend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-slate-200 text-slate-500 hover:bg-slate-50 bg-white"
                      >
                        Return
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-slate-100">
          {ACTIVE_LOANS.map((loan) => (
            <div key={loan.id} className="p-4 flex gap-3">
              <MiniCover gradient={loan.coverGradient} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm leading-snug truncate">{loan.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{loan.author}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-slate-500">Due: {loan.dueDate}</span>
                  {loan.daysRemaining < 0 && (
                    <Badge className="bg-red-100 text-red-600 border-0 text-xs px-2 py-0.5 rounded-full">Overdue</Badge>
                  )}
                  <DaysChip days={loan.daysRemaining} />
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 bg-white">Extend</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs border-slate-200 text-slate-500 hover:bg-slate-50 bg-white">Return</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------
function ReservationsSection() {
  return (
    <section aria-labelledby="reservations-heading">
      <h2 id="reservations-heading" className="text-lg font-semibold text-slate-900 mb-4">
        My Reservations
      </h2>
      <div className="flex flex-col gap-3">
        {RESERVATIONS.map((res) => (
          <Card key={res.id} className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <MiniCover gradient={res.coverGradient} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-medium text-slate-900 text-sm leading-snug">{res.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{res.author}</p>
                  </div>
                  <Badge
                    className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${
                      res.ready ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {res.ready ? "Ready to borrow" : "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                  <span className="text-xs text-slate-500">Reserved: {res.reservedDate}</span>
                  <span className="text-xs text-slate-500">Expires: {res.expiryDate}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-8 text-xs border-slate-200 text-slate-500 hover:bg-slate-50 bg-white"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Penalties
// ---------------------------------------------------------------------------
function PenaltiesSection() {
  const totalUnpaid = PENALTIES.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0)

  return (
    <section aria-labelledby="penalties-heading">
      <h2 id="penalties-heading" className="text-lg font-semibold text-slate-900 mb-4">
        Penalties
      </h2>
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
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
              {PENALTIES.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4 font-medium text-slate-900">{p.title}</td>
                  <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{p.reason}</td>
                  <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{p.date}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">€{p.amount.toFixed(2)}</td>
                  <td className="px-4 py-4">
                    <Badge
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${
                        p.paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                      }`}
                    >
                      {p.paid ? "Paid" : "Unpaid"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {!p.paid && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-primary text-white hover:bg-primary/90"
                      >
                        Pay now
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
          {PENALTIES.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">{p.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{p.reason} · {p.date}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="font-semibold text-sm text-slate-900">€{p.amount.toFixed(2)}</span>
                  <Badge className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 ${p.paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {p.paid ? "Paid" : "Unpaid"}
                  </Badge>
                </div>
              </div>
              {!p.paid && (
                <Button size="sm" className="h-8 text-xs bg-primary text-white hover:bg-primary/90 shrink-0">
                  Pay now
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex justify-end">
          <p className="text-sm text-slate-700">
            Total outstanding:{" "}
            <span className="font-bold text-slate-900">€{totalUnpaid.toFixed(2)}</span>
          </p>
        </div>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Loan History
// ---------------------------------------------------------------------------
function LoanHistorySection() {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? HISTORY : HISTORY.slice(0, 4)

  return (
    <section aria-labelledby="loan-history-heading">
      <h2 id="loan-history-heading" className="text-lg font-semibold text-slate-900 mb-4">
        Loan History
      </h2>
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
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
              {visible.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4 font-medium text-slate-900">{entry.title}</td>
                  <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{entry.author}</td>
                  <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{entry.borrowDate}</td>
                  <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{entry.returnDate}</td>
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
          {visible.map((entry) => (
            <div key={entry.id} className="p-4">
              <p className="font-medium text-slate-900 text-sm">{entry.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{entry.author}</p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs text-slate-500">{entry.borrowDate} → {entry.returnDate}</span>
                <Badge className="bg-slate-100 text-slate-600 border-0 text-xs px-2 py-0.5 rounded-full">Returned</Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Load more */}
        <div className="border-t border-slate-100 px-5 py-3 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-slate-200 text-slate-500 hover:bg-slate-50 bg-white gap-1.5"
            onClick={() => setShowAll((v) => !v)}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
            {showAll ? "Show less" : "Load more"}
          </Button>
        </div>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Page Header */}
        <div className="bg-slate-50 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-3xl font-bold text-slate-900 text-balance">
              Welcome back, <span className="text-primary">Alex</span>
            </h1>
            <p className="mt-1.5 text-slate-500 text-base">
              {"Here's an overview of your library activity."}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-10">
          {/* Stats */}
          <StatsRow />

          {/* Active Loans */}
          <ActiveLoansSection />

          {/* Loan info box – visible because one loan is overdue */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 flex gap-4">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" strokeWidth={2} />
            <div className="flex-1">
              <p className="text-sm text-slate-700 leading-relaxed">
                <span className="font-semibold text-slate-900">Project Hail Mary</span> is overdue.
                A penalty of <span className="font-semibold">€0.50 per day</span> is being applied.
                Please return the book as soon as possible or contact the library.
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 h-8 text-xs bg-primary text-white hover:bg-primary/90 self-start"
            >
              Contact library
            </Button>
          </div>

          {/* Reservations */}
          <ReservationsSection />

          {/* Penalties */}
          <PenaltiesSection />

          {/* Loan History */}
          <LoanHistorySection />
        </div>
      </main>

      <Footer />
    </div>
  )
}
