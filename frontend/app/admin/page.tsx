"use client"

// [v0 import] Component: AdminPage
// Location: frontend/app/admin/page.tsx
// Connect to: GET /api/v1/admin/stats/dashboard/, GET /api/v1/admin/stats/loans-per-month/, GET /api/v1/admin/stats/most-borrowed-genres/, GET /api/v1/admin/users/, GET /api/v1/admin/loans/, GET /api/v1/admin/stats/overdue-report/
// Auth: requires JWT token (admin role) — enforced by middleware.ts
// Mock data: removed — all sections wired to real API

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import {
  Users,
  BookOpen,
  AlertTriangle,
  Clock,
  DollarSign,
  Library,
  Search,
  Lock,
  Unlock,
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import type { OpenLibraryBook } from "@/lib/types"

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

function getToken(): string {
  return document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/)?.[1] ?? ""
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(init?.headers as Record<string, string>),
    },
    credentials: "include",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    throw Object.assign(new Error((body.error as string) ?? res.statusText), {
      status: res.status,
      code: body.code,
    })
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DashboardStats {
  total_users: number
  total_readers: number
  blocked_users: number
  total_books: number
  total_copies: number
  available_copies: number
  active_loans: number
  overdue_loans: number
  pending_reservations: number
  total_penalties_unpaid: string
  total_penalties_collected: string
}

interface LoanPerMonth { month: number; year: number; count: number }
interface Genre { genre: string; loan_count: number; percentage: number }

interface AdminUser {
  id: number
  email: string
  first_name: string
  last_name: string
  phone: string
  role: "reader" | "admin"
  is_blocked: boolean
  blocked_reason: string
  mfa_enabled: boolean
  gender: "female" | "male" | ""
  is_active: boolean
  date_joined: string
  last_login: string | null
}

interface AdminLoan {
  id: number
  copy: { id: number; copy_number: number; condition: string; book: { id: number; title: string; author: string; cover_url: string } }
  borrowed_at: string
  due_date: string
  returned_at: string | null
  prolongation_count: number
  status: "active" | "overdue" | "returned"
  days_remaining: number | null
  is_overdue: boolean
  reader_id: number
  reader_email: string
  reader_name: string
}

interface OverdueReport {
  id: number
  email: string
  first_name: string
  last_name: string
  overdue_loans_count: number
  total_penalty: string | null
  oldest_overdue_date: string | null
}

interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[] }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function userInitials(u: { first_name: string; last_name: string; email: string }): string {
  if (u.first_name && u.last_name) return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase()
  return u.email[0].toUpperCase()
}

function avatarSrc(u: { role: string; gender?: string }): string | null {
  if (u.role === "admin") return "/avatars/admin.svg"
  if (u.gender === "female") return "/avatars/female.svg"
  if (u.gender === "male") return "/avatars/male.svg"
  return null
}

function UserAvatar({ user, size = 8 }: { user: AdminUser; size?: number }) {
  const src = avatarSrc(user)
  const cls = `shrink-0 w-${size} h-${size} rounded-full overflow-hidden`
  if (src) return <div className={cls}><Image src={src} alt="" width={size * 4} height={size * 4} /></div>
  return (
    <div className={`${cls} bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold`}>
      {userInitials(user)}
    </div>
  )
}

function LoanStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-blue-100 text-blue-700",
    overdue: "bg-red-100 text-red-600",
    returned: "bg-slate-100 text-slate-600",
  }
  return (
    <Badge className={`text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Stats Grid
// ---------------------------------------------------------------------------
function StatsGrid({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-white border-slate-200 rounded-xl shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2"><Skeleton className="h-5 w-12" /><Skeleton className="h-3 w-24" /></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  if (!stats) return null

  const unpaid = parseFloat(stats.total_penalties_unpaid)
  const cards = [
    { icon: Users, value: stats.total_users, label: "Total users", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
    { icon: BookOpen, value: stats.active_loans, label: "Active loans", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
    ...(stats.overdue_loans > 0
      ? [{ icon: AlertTriangle, value: stats.overdue_loans, label: "Overdue loans", iconBg: "bg-red-50", iconColor: "text-red-500" }]
      : []),
    { icon: Clock, value: stats.pending_reservations, label: "Pending reservations", iconBg: "bg-yellow-50", iconColor: "text-yellow-600" },
    ...(unpaid > 0
      ? [{ icon: DollarSign, value: `€${unpaid.toFixed(2)}`, label: "Unpaid penalties", iconBg: "bg-amber-50", iconColor: "text-amber-600" }]
      : []),
    { icon: Library, value: stats.total_books, label: "Books in catalog", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map(({ icon: Icon, value, label, iconBg, iconColor }) => (
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
function LoansBarChart({ data, loading }: { data: LoanPerMonth[]; loading: boolean }) {
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <Card className="bg-white border-slate-200 shadow-sm h-full">
      <CardHeader className="pb-2 pt-5 px-6">
        <CardTitle className="text-base font-semibold text-slate-900">Loans per month</CardTitle>
        <p className="text-xs text-slate-500 mt-0.5">Last 6 months</p>
      </CardHeader>
      <CardContent className="px-6 pb-5">
        {loading ? (
          <div className="flex items-end gap-3 h-44"><Skeleton className="w-full h-full rounded" /></div>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-16">No data yet</p>
        ) : (
          <div className="flex items-end gap-3 h-44 pt-2">
            {data.map(({ month, year, count }) => {
              const heightPct = Math.round((count / max) * 100)
              return (
                <div key={`${year}-${month}`} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-xs font-medium text-slate-600">{count}</span>
                  <div className="w-full rounded-t-md bg-blue-600 transition-all" style={{ height: `${heightPct}%`, minHeight: "4px" }} />
                  <span className="text-xs text-slate-400">{MONTH_NAMES[month - 1]}</span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GenresBarChart({ data, loading }: { data: Genre[]; loading: boolean }) {
  const blueShades = ["bg-blue-600","bg-blue-500","bg-blue-400","bg-blue-300","bg-blue-200"]

  return (
    <Card className="bg-white border-slate-200 shadow-sm h-full">
      <CardHeader className="pb-2 pt-5 px-6">
        <CardTitle className="text-base font-semibold text-slate-900">Most borrowed genres</CardTitle>
        <p className="text-xs text-slate-500 mt-0.5">Share of total loans</p>
      </CardHeader>
      <CardContent className="px-6 pb-5">
        {loading ? (
          <div className="flex flex-col gap-4 mt-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-5 w-full" />)}</div>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-16">No data yet</p>
        ) : (
          <div className="flex flex-col gap-4 mt-2">
            {data.map(({ genre, percentage }, i) => (
              <div key={genre} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-sm text-slate-600 truncate">{genre}</span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${blueShades[i] ?? "bg-blue-200"} transition-all`} style={{ width: `${percentage}%` }} />
                </div>
                <span className="w-9 text-right text-xs text-slate-500 font-medium">{percentage.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------------
function UserManagement({ onAction }: { onAction: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"" | "reader" | "admin">("")
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "blocked">("")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Block dialog state
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; user: AdminUser | null; reason: string; loading: boolean }>({
    open: false, user: null, reason: "", loading: false,
  })

  // Profile dialog state
  const [profileDialog, setProfileDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false, user: null,
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUsers = useCallback(async (s: string, role: string, status: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) })
      if (s) params.set("search", s)
      if (role) params.set("role", role)
      if (status === "active") params.set("is_blocked", "false")
      if (status === "blocked") params.set("is_blocked", "true")
      const data = await apiFetch<Paginated<AdminUser>>(`/admin/users/?${params}`)
      setUsers(data.results)
      setTotalCount(data.count)
    } catch {
      toast.error("Failed to load users.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch when filters/page change
  useEffect(() => {
    fetchUsers(search, roleFilter, statusFilter, page)
  }, [fetchUsers, roleFilter, statusFilter, page])

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchUsers(val, roleFilter, statusFilter, 1)
    }, 300)
  }

  async function handleBlock() {
    if (!blockDialog.user || !blockDialog.reason.trim()) return
    setBlockDialog((d) => ({ ...d, loading: true }))
    try {
      await apiFetch(`/admin/users/${blockDialog.user.id}/block/`, {
        method: "POST",
        body: JSON.stringify({ reason: blockDialog.reason.trim() }),
      })
      toast.success(`${blockDialog.user.first_name || blockDialog.user.email} has been blocked.`)
      setBlockDialog({ open: false, user: null, reason: "", loading: false })
      void fetchUsers(search, roleFilter, statusFilter, page)
      onAction()
    } catch (err: unknown) {
      const e = err as { message?: string }
      toast.error(e.message ?? "Failed to block user.")
      setBlockDialog((d) => ({ ...d, loading: false }))
    }
  }

  async function handleUnblock(user: AdminUser) {
    try {
      await apiFetch(`/admin/users/${user.id}/unblock/`, { method: "POST" })
      toast.success(`${user.first_name || user.email} has been unblocked.`)
      void fetchUsers(search, roleFilter, statusFilter, page)
      onAction()
    } catch (err: unknown) {
      const e = err as { message?: string }
      toast.error(e.message ?? "Failed to unblock user.")
    }
  }

  const ROLE_TABS: { label: string; value: "" | "reader" | "admin" }[] = [
    { label: "All", value: "" },
    { label: "Readers", value: "reader" },
    { label: "Admins", value: "admin" },
  ]
  const STATUS_TABS: { label: string; value: "" | "active" | "blocked" }[] = [
    { label: "All", value: "" },
    { label: "Active", value: "active" },
    { label: "Blocked", value: "blocked" },
  ]

  return (
    <section aria-labelledby="user-mgmt-heading">
      {/* Block dialog */}
      <Dialog open={blockDialog.open} onOpenChange={(open) => { if (!open) setBlockDialog({ open: false, user: null, reason: "", loading: false }) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block {blockDialog.user?.first_name || blockDialog.user?.email}</DialogTitle>
            <DialogDescription>Provide a reason for blocking this account. The user will be informed.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Block reason</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 text-sm p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="e.g. Multiple overdue books not returned..."
              value={blockDialog.reason}
              onChange={(e) => setBlockDialog((d) => ({ ...d, reason: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBlockDialog({ open: false, user: null, reason: "", loading: false })}>Cancel</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={!blockDialog.reason.trim() || blockDialog.loading} onClick={handleBlock}>
              {blockDialog.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Block account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile dialog */}
      <Dialog open={profileDialog.open} onOpenChange={(open) => { if (!open) setProfileDialog({ open: false, user: null }) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          {profileDialog.user && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <UserAvatar user={profileDialog.user} size={12} />
                <div>
                  <p className="font-semibold text-slate-900">{profileDialog.user.first_name} {profileDialog.user.last_name}</p>
                  <p className="text-sm text-slate-500">{profileDialog.user.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Role</span><p className="font-medium text-slate-900 capitalize">{profileDialog.user.role}</p></div>
                <div><span className="text-slate-500">Status</span><p className={`font-medium ${profileDialog.user.is_blocked ? "text-red-600" : "text-green-600"}`}>{profileDialog.user.is_blocked ? "Blocked" : "Active"}</p></div>
                <div><span className="text-slate-500">Phone</span><p className="font-medium text-slate-900">{profileDialog.user.phone || "—"}</p></div>
                <div><span className="text-slate-500">Gender</span><p className="font-medium text-slate-900 capitalize">{profileDialog.user.gender || "—"}</p></div>
                <div><span className="text-slate-500">MFA</span><p className="font-medium text-slate-900">{profileDialog.user.mfa_enabled ? "Enabled" : "Disabled"}</p></div>
                <div><span className="text-slate-500">Joined</span><p className="font-medium text-slate-900">{fmtDate(profileDialog.user.date_joined)}</p></div>
                <div><span className="text-slate-500">Last login</span><p className="font-medium text-slate-900">{fmtDate(profileDialog.user.last_login ?? undefined)}</p></div>
              </div>
              {profileDialog.user.is_blocked && (
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-700">Block reason</p>
                  <p className="text-sm text-red-600 mt-0.5">{profileDialog.user.blocked_reason || "—"}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Header + filters */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 id="user-mgmt-heading" className="text-lg font-semibold text-slate-900">User Management</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search users..." className="pl-9 h-9 text-sm bg-white border-slate-200 text-slate-900 placeholder:text-slate-400" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {ROLE_TABS.map((t) => (
              <button key={t.value} onClick={() => { setRoleFilter(t.value); setPage(1) }} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${roleFilter === t.value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {STATUS_TABS.map((t) => (
              <button key={t.value} onClick={() => { setStatusFilter(t.value); setPage(1) }} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${statusFilter === t.value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 flex flex-col gap-4">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">No users found.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">User</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Email</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Registered</th>
                    <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} size={8} />
                          <span className="font-medium text-slate-900">{user.first_name} {user.last_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 truncate max-w-[160px]">{user.email}</td>
                      <td className="px-4 py-3.5">
                        <Badge className={`text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${user.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge className={`text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${user.is_blocked ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                          {user.is_blocked ? "Blocked" : "Active"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{fmtDate(user.date_joined)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {user.is_blocked ? (
                            <button title="Unblock" onClick={() => void handleUnblock(user)} className="p-1.5 rounded-md text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button title="Block" onClick={() => setBlockDialog({ open: true, user, reason: "", loading: false })} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Lock className="w-4 h-4" />
                            </button>
                          )}
                          <button title="View profile" onClick={() => setProfileDialog({ open: true, user })} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
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
              {users.map((user) => (
                <div key={user.id} className="p-4 flex items-center gap-3">
                  <UserAvatar user={user} size={9} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs px-2 py-0.5 rounded-full border-0 ${user.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{user.role}</Badge>
                      <Badge className={`text-xs px-2 py-0.5 rounded-full border-0 ${user.is_blocked ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>{user.is_blocked ? "Blocked" : "Active"}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {user.is_blocked
                      ? <button onClick={() => void handleUnblock(user)} className="p-1.5 rounded-md text-slate-400 hover:text-green-600 hover:bg-green-50"><Unlock className="w-4 h-4" /></button>
                      : <button onClick={() => setBlockDialog({ open: true, user, reason: "", loading: false })} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Lock className="w-4 h-4" /></button>}
                    <button onClick={() => setProfileDialog({ open: true, user })} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100"><Eye className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">Showing {users.length} of {totalCount} users</p>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const pg = i + 1
              return (
                <button key={pg} onClick={() => setPage(pg)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page === pg ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{pg}</button>
              )
            })}
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors">
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
  const [loans, setLoans] = useState<AdminLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "overdue" | "returned">("")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = expanded ? 20 : 5

  const fetchLoans = useCallback(async (status: string, p: number, pageSize: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ ordering: "-borrowed_at", page: String(p), page_size: String(pageSize) })
      if (status) params.set("status", status)
      const data = await apiFetch<Paginated<AdminLoan>>(`/admin/loans/?${params}`)
      setLoans(data.results)
      setTotalCount(data.count)
    } catch {
      toast.error("Failed to load loans.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLoans(statusFilter, page, PAGE_SIZE)
  }, [fetchLoans, statusFilter, page, PAGE_SIZE])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const STATUS_TABS: { label: string; value: "" | "active" | "overdue" | "returned" }[] = [
    { label: "All", value: "" },
    { label: "Active", value: "active" },
    { label: "Overdue", value: "overdue" },
    { label: "Returned", value: "returned" },
  ]

  return (
    <section aria-labelledby="recent-loans-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="recent-loans-heading" className="text-lg font-semibold text-slate-900">
          {expanded ? "All Loans" : "Recent Loans"}
        </h2>
        {expanded && (
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {STATUS_TABS.map((t) => (
              <button key={t.value} onClick={() => { setStatusFilter(t.value); setPage(1) }} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${statusFilter === t.value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t.label}</button>
            ))}
          </div>
        )}
      </div>
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 flex flex-col gap-4">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : loans.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">No loans found.</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 px-5 py-3 whitespace-nowrap">Reader</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 w-full">Book title</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Borrowed</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">Due date</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-5 py-3 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loans.map((loan) => (
                    <tr key={loan.id} className={`hover:bg-slate-50/60 transition-colors ${loan.is_overdue ? "bg-red-50/40" : ""}`}>
                      <td className="px-5 py-3.5 font-medium text-slate-900 whitespace-nowrap">{loan.reader_name}</td>
                      <td className="px-4 py-3.5 text-slate-700">{loan.copy.book.title}</td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{fmtDate(loan.borrowed_at)}</td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{fmtDate(loan.due_date)}</td>
                      <td className="px-5 py-3.5"><LoanStatusBadge status={loan.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {loans.map((loan) => (
                <div key={loan.id} className={`p-4 ${loan.is_overdue ? "bg-red-50/40" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{loan.copy.book.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">by {loan.reader_name}</p>
                    </div>
                    <LoanStatusBadge status={loan.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Borrowed {fmtDate(loan.borrowed_at)} · Due {fmtDate(loan.due_date)}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex items-center justify-between">
          {expanded && totalPages > 1 ? (
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : <span />}
          <Button variant="outline" size="sm" className="h-8 text-xs border-slate-300 text-slate-600 hover:bg-slate-50 bg-white" onClick={() => { setExpanded((e) => !e); setStatusFilter(""); setPage(1) }}>
            {expanded ? "Show recent only" : "View all loans"}
          </Button>
        </div>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Flagged Accounts
// ---------------------------------------------------------------------------
function FlaggedAccountsSection({ onAction }: { onAction: () => void }) {
  const [flagged, setFlagged] = useState<OverdueReport[]>([])
  const [loading, setLoading] = useState(true)
  const [blocking, setBlocking] = useState<Set<number>>(new Set())
  const [reminding, setReminding] = useState<Set<number>>(new Set())

  const fetchFlagged = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<OverdueReport[]>("/admin/stats/overdue-report/")
      setFlagged(data)
    } catch {
      toast.error("Failed to load flagged accounts.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchFlagged() }, [fetchFlagged])

  async function handleBlock(user: OverdueReport) {
    setBlocking((s) => new Set(s).add(user.id))
    try {
      await apiFetch(`/admin/users/${user.id}/block/`, {
        method: "POST",
        body: JSON.stringify({ reason: "Blocked due to overdue loans" }),
      })
      toast.success(`${user.first_name || user.email} has been blocked.`)
      setFlagged((list) => list.filter((u) => u.id !== user.id))
      onAction()
    } catch (err: unknown) {
      const e = err as { message?: string }
      toast.error(e.message ?? "Failed to block user.")
    } finally {
      setBlocking((s) => { const n = new Set(s); n.delete(user.id); return n })
    }
  }

  async function handleReminder(user: OverdueReport) {
    setReminding((s) => new Set(s).add(user.id))
    try {
      await apiFetch("/admin/notifications/send-reminder/", {
        method: "POST",
        body: JSON.stringify({ user_id: user.id }),
      })
      toast.success("Reminder sent.")
    } catch {
      toast.error("Failed to send reminder.")
    } finally {
      setReminding((s) => { const n = new Set(s); n.delete(user.id); return n })
    }
  }

  return (
    <section aria-labelledby="flagged-heading">
      <h2 id="flagged-heading" className="text-lg font-semibold text-slate-900 mb-4">Flagged Accounts</h2>
      {loading ? (
        <div className="flex flex-col gap-3">{Array.from({length:2}).map((_,i)=><Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : flagged.length === 0 ? (
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center text-sm text-slate-400">No flagged accounts. All readers are in good standing.</CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {flagged.map((user) => (
            <Card key={user.id} className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-sm font-semibold text-red-700">
                    {user.first_name?.[0] ?? user.email[0].toUpperCase()}{user.last_name?.[0] ?? ""}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    {user.oldest_overdue_date && (
                      <p className="text-xs text-red-500 mt-0.5">Oldest overdue: {fmtDate(user.oldest_overdue_date)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6 sm:gap-8 text-sm">
                  <div className="text-center">
                    <p className="font-bold text-red-600">{user.overdue_loans_count}</p>
                    <p className="text-xs text-slate-500 whitespace-nowrap">Overdue books</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-900">€{user.total_penalty ? parseFloat(user.total_penalty).toFixed(2) : "0.00"}</p>
                    <p className="text-xs text-slate-500 whitespace-nowrap">Total penalty</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <Button size="sm" className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white border-0" disabled={blocking.has(user.id)} onClick={() => void handleBlock(user)}>
                    {blocking.has(user.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : "Block account"}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 bg-white" disabled={reminding.has(user.id)} onClick={() => void handleReminder(user)}>
                    {reminding.has(user.id) ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Bell className="w-3 h-3 mr-1" />}
                    Send reminder
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Open Library Import — unchanged
// ---------------------------------------------------------------------------
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
      const res = await fetch(`${API}/open-library/search/?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        credentials: "include",
      })
      if (!res.ok) throw new Error("Search failed")
      const data = (await res.json()) as OpenLibraryBook[]
      setResults(data)
    } catch {
      toast.error("Failed to search Open Library.")
    } finally {
      setSearching(false)
    }
  }

  async function handleImport(identifier: string, title: string) {
    setImporting(identifier)
    try {
      const res = await fetch(`${API}/open-library/import/${encodeURIComponent(identifier)}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        credentials: "include",
      })
      if (!res.ok) throw new Error("Import failed")
      toast.success(`"${title}" queued for import.`)
    } catch {
      toast.error(`Failed to import "${title}".`)
    } finally {
      setImporting(null)
    }
  }

  return (
    <section aria-labelledby="import-heading">
      <h2 id="import-heading" className="text-lg font-semibold text-slate-900 mb-4">Import from Open Library</h2>
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-6 flex flex-col gap-5">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, author, or ISBN..." className="pl-9 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400" />
            </div>
            <Button type="submit" disabled={searching || !query.trim()} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
              {searching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Search
            </Button>
          </form>
          {results.length > 0 && (
            <div className="flex flex-col divide-y divide-slate-100">
              {results.map((book) => (
                <div key={book.ol_id} className="flex items-center gap-4 py-3">
                  {book.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.cover_url} alt={book.title} className="w-10 h-14 object-cover rounded shadow-sm shrink-0" />
                  ) : (
                    <div className="w-10 h-14 bg-slate-100 rounded flex items-center justify-center shrink-0"><BookOpen className="w-4 h-4 text-slate-400" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{book.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{book.author}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {book.isbn && <span className="text-xs text-slate-400">ISBN: {book.isbn}</span>}
                      {book.year_published && <span className="text-xs text-slate-400">{book.year_published}</span>}
                    </div>
                  </div>
                  {(() => {
                    const importId = book.isbn ?? book.ol_id
                    const isImporting = importing === importId
                    return (
                      <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 bg-white" onClick={() => importId && void handleImport(importId, book.title)} disabled={isImporting || !importId}>
                        {isImporting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}Import
                      </Button>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
          {!searching && query && results.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No results found. Try a different search term.</p>
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
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [loansPerMonth, setLoansPerMonth] = useState<LoanPerMonth[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [chartsLoading, setChartsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await apiFetch<DashboardStats>("/admin/stats/dashboard/")
      setStats(data)
    } catch {
      toast.error("Failed to load dashboard stats.")
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchCharts = useCallback(async () => {
    setChartsLoading(true)
    try {
      const [lpm, gen] = await Promise.all([
        apiFetch<LoanPerMonth[]>("/admin/stats/loans-per-month/?months=6"),
        apiFetch<Genre[]>("/admin/stats/most-borrowed-genres/?limit=5"),
      ])
      setLoansPerMonth(lpm)
      setGenres(gen)
    } catch {
      toast.error("Failed to load chart data.")
    } finally {
      setChartsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStats()
    void fetchCharts()
  }, [fetchStats, fetchCharts])

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <div className="relative">
        <Navbar />
        <div className="absolute top-1/2 right-4 sm:right-6 lg:right-8 -translate-y-1/2 pointer-events-none hidden md:flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            <Shield className="w-3 h-3" />Admin
          </span>
        </div>
      </div>

      <main className="flex-1 bg-slate-50">
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-slate-500 mt-1.5 text-base">Manage users, monitor loans, and track library statistics.</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-10">
          <StatsGrid stats={stats} loading={statsLoading} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LoansBarChart data={loansPerMonth} loading={chartsLoading} />
            <GenresBarChart data={genres} loading={chartsLoading} />
          </div>

          <UserManagement onAction={fetchStats} />
          <RecentLoansSection />
          <FlaggedAccountsSection onAction={fetchStats} />
          <OpenLibraryImport />
        </div>
      </main>

      <Footer />
    </div>
  )
}
