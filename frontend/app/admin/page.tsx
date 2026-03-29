"use client"

// [v0 import] Component: AdminPage
// Location: frontend/app/admin/page.tsx
// Connect to: GET /api/v1/admin/users/ — UserManagement; GET /api/v1/admin/stats/ — StatsGrid; GET /api/v1/loans/active — RecentLoansSection; GET /api/v1/admin/users/?flagged=true — FlaggedAccountsSection; POST /api/v1/admin/block-user/ — Block account button; POST /api/v1/loans/extend — Send reminder
// Mock data: STATS, LOANS_PER_MONTH, GENRES, USERS, RECENT_LOANS, FLAGGED are all hardcoded; pagination is cosmetic (totalPages=3 hardcoded, only client-side search on local USERS array); chart data is static
// Auth: requires JWT token (admin role)
// TODO: fetch all sections from GET /api/v1/admin/stats/ and /api/v1/admin/users/; wire search to API query param; wire Block/Send reminder/View to real endpoints; guard route with admin role check; replace Admin badge overlay with a dedicated AdminNavbar variant or extend Navbar to accept a badge prop; derive chart data from stats API

import { useState } from "react"
import {
  Users,
  BookOpen,
  AlertTriangle,
  Clock,
  DollarSign,
  Library,
  Search,
  Lock,
  Eye,
  ChevronLeft,
  ChevronRight,
  Bell,
  Shield,
  Download,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import type { OpenLibraryBook } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AdminUser {
  id: number
  initials: string
  name: string
  email: string
  role: "Reader" | "Admin"
  status: "Active" | "Blocked"
  registered: string
  avatarColor: string
}

interface RecentLoan {
  id: number
  username: string
  bookTitle: string
  borrowDate: string
  dueDate: string
  status: "Active" | "Overdue" | "Returned"
}

interface FlaggedUser {
  id: number
  initials: string
  name: string
  email: string
  overdueBooks: number
  totalPenalty: number
  avatarColor: string
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const STATS = [
  { icon: Users,         value: "248",    label: "Total users",          iconBg: "bg-blue-50",   iconColor: "text-blue-600"   },
  { icon: BookOpen,      value: "37",     label: "Active loans",         iconBg: "bg-blue-50",   iconColor: "text-blue-600"   },
  { icon: AlertTriangle, value: "12",     label: "Overdue loans",        iconBg: "bg-red-50",    iconColor: "text-red-500"    },
  { icon: Clock,         value: "5",      label: "Pending reservations", iconBg: "bg-yellow-50", iconColor: "text-yellow-600" },
  { icon: DollarSign,    value: "€48.50", label: "Total penalties",      iconBg: "bg-blue-50",   iconColor: "text-blue-600"   },
  { icon: Library,       value: "1,204",  label: "Books in catalog",     iconBg: "bg-blue-50",   iconColor: "text-blue-600"   },
]

const LOANS_PER_MONTH = [
  { month: "Jan", loans: 42 },
  { month: "Feb", loans: 58 },
  { month: "Mar", loans: 51 },
  { month: "Apr", loans: 74 },
  { month: "May", loans: 67 },
  { month: "Jun", loans: 83 },
]

const GENRES = [
  { label: "Fiction",   pct: 38 },
  { label: "Science",   pct: 24 },
  { label: "History",   pct: 18 },
  { label: "Fantasy",   pct: 14 },
  { label: "Biography", pct: 6  },
]

const USERS: AdminUser[] = [
  { id: 1, initials: "AK", name: "Anna Kowalski", email: "anna.k@mail.com",  role: "Reader", status: "Active",  registered: "12 Jan 2025", avatarColor: "bg-violet-100 text-violet-700"   },
  { id: 2, initials: "TN", name: "Tom Nowak",     email: "t.nowak@mail.com", role: "Admin",  status: "Active",  registered: "3 Mar 2024",  avatarColor: "bg-blue-100 text-blue-700"       },
  { id: 3, initials: "MJ", name: "Maria Jensen",  email: "mjensen@mail.com", role: "Reader", status: "Blocked", registered: "18 Aug 2024", avatarColor: "bg-rose-100 text-rose-700"       },
  { id: 4, initials: "PW", name: "Paul Weber",    email: "p.weber@mail.com", role: "Reader", status: "Active",  registered: "5 Nov 2024",  avatarColor: "bg-emerald-100 text-emerald-700" },
  { id: 5, initials: "SB", name: "Sara Brown",    email: "sara.b@mail.com",  role: "Reader", status: "Active",  registered: "22 Feb 2025", avatarColor: "bg-amber-100 text-amber-700"     },
]

const RECENT_LOANS: RecentLoan[] = [
  { id: 1, username: "anna.k",  bookTitle: "The Midnight Library", borrowDate: "14 Mar 2026", dueDate: "4 Apr 2026",  status: "Active"   },
  { id: 2, username: "p.weber", bookTitle: "Atomic Habits",        borrowDate: "20 Mar 2026", dueDate: "29 Mar 2026", status: "Overdue"  },
  { id: 3, username: "sara.b",  bookTitle: "Dune",                 borrowDate: "18 Mar 2026", dueDate: "8 Apr 2026",  status: "Active"   },
  { id: 4, username: "mjensen", bookTitle: "Project Hail Mary",    borrowDate: "1 Mar 2026",  dueDate: "22 Mar 2026", status: "Returned" },
  { id: 5, username: "t.nowak", bookTitle: "Sapiens",              borrowDate: "5 Feb 2026",  dueDate: "26 Feb 2026", status: "Returned" },
]

const FLAGGED: FlaggedUser[] = [
  { id: 1, initials: "MJ", name: "Maria Jensen", email: "mjensen@mail.com", overdueBooks: 2, totalPenalty: 7.50, avatarColor: "bg-rose-100 text-rose-700"   },
  { id: 2, initials: "PW", name: "Paul Weber",   email: "p.weber@mail.com", overdueBooks: 1, totalPenalty: 2.00, avatarColor: "bg-amber-100 text-amber-700" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function LoanStatusBadge({ status }: { status: RecentLoan["status"] }) {
  const map = {
    Active:   "bg-blue-100 text-blue-700",
    Overdue:  "bg-red-100 text-red-600",
    Returned: "bg-slate-100 text-slate-600",
  }
  return (
    <Badge className={`text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${map[status]}`}>
      {status}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Stat Cards
// ---------------------------------------------------------------------------
function StatsGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
// Charts
// ---------------------------------------------------------------------------
const MAX_LOANS = Math.max(...LOANS_PER_MONTH.map((d) => d.loans))

function LoansBarChart() {
  return (
    <Card className="bg-white border-slate-200 shadow-sm h-full">
      <CardHeader className="pb-2 pt-5 px-6">
        <CardTitle className="text-base font-semibold text-slate-900">Loans per month</CardTitle>
        <p className="text-xs text-slate-500 mt-0.5">Jan – Jun 2026</p>
      </CardHeader>
      <CardContent className="px-6 pb-5">
        <div className="flex items-end gap-3 h-44 pt-2">
          {LOANS_PER_MONTH.map(({ month, loans }) => {
            const heightPct = Math.round((loans / MAX_LOANS) * 100)
            return (
              <div key={month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-xs font-medium text-slate-600">{loans}</span>
                <div
                  className="w-full rounded-t-md bg-blue-600 transition-all"
                  style={{ height: `${heightPct}%`, minHeight: "4px" }}
                />
                <span className="text-xs text-slate-400">{month}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function GenresBarChart() {
  const blueShades = [
    "bg-blue-600",
    "bg-blue-500",
    "bg-blue-400",
    "bg-blue-300",
    "bg-blue-200",
  ]
  return (
    <Card className="bg-white border-slate-200 shadow-sm h-full">
      <CardHeader className="pb-2 pt-5 px-6">
        <CardTitle className="text-base font-semibold text-slate-900">Most borrowed genres</CardTitle>
        <p className="text-xs text-slate-500 mt-0.5">Share of total loans</p>
      </CardHeader>
      <CardContent className="px-6 pb-5">
        <div className="flex flex-col gap-4 mt-2">
          {GENRES.map(({ label, pct }, i) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm text-slate-600">{label}</span>
              <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${blueShades[i]} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs text-slate-500 font-medium">{pct}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------------
function UserManagement() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const totalPages = 3

  const filtered = USERS.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <section aria-labelledby="user-mgmt-heading">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 id="user-mgmt-heading" className="text-lg font-semibold text-slate-900">
          User Management
        </h2>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 h-9 text-sm bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary"
          />
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">User</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Email</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Role</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Registered</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`shrink-0 w-8 h-8 rounded-full ${user.avatarColor} flex items-center justify-center text-xs font-semibold`}>
                        {user.initials}
                      </div>
                      <span className="font-medium text-slate-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3.5">
                    <Badge
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${
                        user.role === "Admin"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${
                        user.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {user.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{user.registered}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Block / Unblock"
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                      <button
                        title="View profile"
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.map((user) => (
            <div key={user.id} className="p-4 flex items-center gap-3">
              <div className={`shrink-0 w-9 h-9 rounded-full ${user.avatarColor} flex items-center justify-center text-xs font-semibold`}>
                {user.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-xs px-2 py-0.5 rounded-full border-0 ${user.role === "Admin" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{user.role}</Badge>
                  <Badge className={`text-xs px-2 py-0.5 rounded-full border-0 ${user.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{user.status}</Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100"><Lock className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100"><Eye className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">Showing {filtered.length} of 248 users</p>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                  page === i + 1
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Recent Loans
// ---------------------------------------------------------------------------
function RecentLoansSection() {
  return (
    <section aria-labelledby="recent-loans-heading">
      <h2 id="recent-loans-heading" className="text-lg font-semibold text-slate-900 mb-4">
        Recent Loans
      </h2>
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3 whitespace-nowrap">Username</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 w-full">Book title</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Borrowed</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Due date</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {RECENT_LOANS.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900 whitespace-nowrap">{loan.username}</td>
                  <td className="px-4 py-3.5 text-slate-700">{loan.bookTitle}</td>
                  <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{loan.borrowDate}</td>
                  <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{loan.dueDate}</td>
                  <td className="px-5 py-3.5"><LoanStatusBadge status={loan.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-slate-100">
          {RECENT_LOANS.map((loan) => (
            <div key={loan.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{loan.bookTitle}</p>
                  <p className="text-xs text-slate-500 mt-0.5">by {loan.username}</p>
                </div>
                <LoanStatusBadge status={loan.status} />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Borrowed {loan.borrowDate} · Due {loan.dueDate}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-slate-300 text-slate-600 hover:bg-slate-50 bg-white"
          >
            View all loans
          </Button>
        </div>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Flagged Accounts
// ---------------------------------------------------------------------------
function FlaggedAccountsSection() {
  return (
    <section aria-labelledby="flagged-heading">
      <h2 id="flagged-heading" className="text-lg font-semibold text-slate-900 mb-4">
        Flagged Accounts
      </h2>
      <div className="flex flex-col gap-3">
        {FLAGGED.map((user) => (
          <Card key={user.id} className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Avatar + info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`shrink-0 w-10 h-10 rounded-full ${user.avatarColor} flex items-center justify-center text-sm font-semibold`}>
                  {user.initials}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 sm:gap-8 text-sm">
                <div className="text-center">
                  <p className="font-bold text-red-600">{user.overdueBooks}</p>
                  <p className="text-xs text-slate-500 whitespace-nowrap">Overdue books</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900">€{user.totalPenalty.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 whitespace-nowrap">Total penalty</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 sm:justify-end">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white border-0"
                >
                  Block account
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 bg-white"
                >
                  <Bell className="w-3 h-3 mr-1" />
                  Send reminder
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Open Library Import
// ---------------------------------------------------------------------------
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

function OpenLibraryImport() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<OpenLibraryBook[]>([])
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    try {
      const token = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/)?.[1]
      const res = await fetch(`${API}/open-library/search/?q=${encodeURIComponent(query)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      })
      if (!res.ok) throw new Error("Search failed")
      const data = (await res.json()) as OpenLibraryBook[]
      setResults(data)
    } catch {
      toast.error("Failed to search Open Library")
    } finally {
      setSearching(false)
    }
  }

  async function handleImport(identifier: string, title: string) {
    setImporting(identifier)
    try {
      const token = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/)?.[1]
      const res = await fetch(`${API}/open-library/import/${encodeURIComponent(identifier)}/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      })
      if (!res.ok) throw new Error("Import failed")
      toast.success(`"${title}" queued for import`)
    } catch {
      toast.error(`Failed to import "${title}"`)
    } finally {
      setImporting(null)
    }
  }

  return (
    <section aria-labelledby="import-heading">
      <h2 id="import-heading" className="text-lg font-semibold text-slate-900 mb-4">
        Import from Open Library
      </h2>
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-6 flex flex-col gap-5">
          {/* Search form */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, author, or ISBN..."
                className="pl-9 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:ring-primary/40"
              />
            </div>
            <Button
              type="submit"
              disabled={searching || !query.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Search
            </Button>
          </form>

          {/* Results */}
          {results.length > 0 && (
            <div className="flex flex-col divide-y divide-slate-100">
              {results.map((book) => (
                <div key={book.ol_id} className="flex items-center gap-4 py-3">
                  {/* Cover thumbnail */}
                  {book.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="w-10 h-14 object-cover rounded shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-slate-100 rounded flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-slate-400" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{book.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{book.author}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {book.isbn && (
                        <span className="text-xs text-slate-400">ISBN: {book.isbn}</span>
                      )}
                      {book.year_published && (
                        <span className="text-xs text-slate-400">{book.year_published}</span>
                      )}
                    </div>
                  </div>

                  {/* Import button — uses ISBN if available, OL ID as fallback */}
                  {(() => {
                    const importId = book.isbn ?? book.ol_id
                    const isImporting = importing !== null && importing === importId
                    return (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 bg-white"
                        onClick={() => importId && void handleImport(importId, book.title)}
                        disabled={isImporting || !importId}
                      >
                        {isImporting ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Download className="w-3 h-3 mr-1" />
                        )}
                        Import
                      </Button>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}

          {!searching && query && results.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">
              No results found. Try a different search term.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      {/* Navbar with Admin badge */}
      <div className="relative">
        <Navbar />
        <div className="absolute top-1/2 right-4 sm:right-6 lg:right-8 -translate-y-1/2 pointer-events-none hidden md:flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            <Shield className="w-3 h-3" />
            Admin
          </span>
        </div>
      </div>

      <main className="flex-1 bg-slate-50">
        {/* Page header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-slate-500 mt-1.5 text-base">
              Manage users, monitor loans, and track library statistics.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-10">
          {/* Stats */}
          <StatsGrid />

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LoansBarChart />
            <GenresBarChart />
          </div>

          {/* User management */}
          <UserManagement />

          {/* Recent loans */}
          <RecentLoansSection />

          {/* Flagged accounts */}
          <FlaggedAccountsSection />

          {/* Open Library import */}
          <OpenLibraryImport />
        </div>
      </main>

      <Footer />
    </div>
  )
}
