"use client"

// [v0 import] Component: SettingsPage
// Location: frontend/app/account/settings/page.tsx
// Connect to: GET /api/v1/auth/profile/ — ProfilePanel (pre-fill fields); POST /api/v1/auth/profile/ — Save changes; POST /api/v1/auth/password/ (django-allauth) — SecurityPanel Update password; DELETE /api/v1/auth/sessions/{id}/ — Revoke session; POST /api/v1/auth/mfa/ — MfaPanel enable/verify TOTP; DELETE /api/v1/auth/mfa/ — disable MFA; PATCH /api/v1/users/notifications/ — NotificationsPanel Save preferences; POST /api/v1/admin/block-user/ — DangerZonePanel Block account; DELETE /api/v1/users/me/ — Delete account
// Mock data: form fields have hardcoded default values (Alexandra Kowalski, a.kowalski@example.com, +48 600 123 456); SESSIONS list is hardcoded; BACKUP_CODES are static placeholders; QR code is a random dot grid (not a real TOTP secret); notification toggles reflect no real user state; session revoke only updates local UI state
// Auth: requires JWT token (any authenticated user)
// TODO: pre-fill ProfilePanel from GET /api/v1/auth/profile/; wire password change to django-allauth endpoint; fetch real active sessions; generate real TOTP QR code from backend via GET /api/v1/auth/mfa/setup/; validate 6-digit code against POST /api/v1/auth/mfa/verify/; load notification preferences from API; guard Danger Zone with a confirmation dialog before calling block/delete endpoints
// Avatar note: profile pictures are static assets assigned at registration — readers get one of two silhouettes (female/male), admins get a dedicated avatar. There is no upload or change functionality anywhere in the app; the User icon shown here is a placeholder until the correct static asset is wired in.

import { useState } from "react"
import {
  User,
  Shield,
  Smartphone,
  Bell,
  AlertTriangle,
  Eye,
  EyeOff,
  Monitor,
  MapPin,
  Download,
  Check,
  Lock,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Section = "profile" | "security" | "mfa" | "notifications" | "danger"

interface NavItem {
  id: Section
  label: string
  icon: React.ReactNode
}

// ---------------------------------------------------------------------------
// Settings sidebar nav items
// ---------------------------------------------------------------------------
const NAV_ITEMS: NavItem[] = [
  { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
  { id: "security", label: "Security", icon: <Shield className="w-4 h-4" /> },
  { id: "mfa", label: "MFA / 2FA", icon: <Smartphone className="w-4 h-4" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
  { id: "danger", label: "Danger Zone", icon: <AlertTriangle className="w-4 h-4" /> },
]

// ---------------------------------------------------------------------------
// Password strength helper
// ---------------------------------------------------------------------------
function passwordStrength(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"]
const STRENGTH_COLOR = [
  "",
  "bg-red-500",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-green-500",
]

// ---------------------------------------------------------------------------
// Mock backup codes
// ---------------------------------------------------------------------------
const BACKUP_CODES = [
  "A1B2-C3D4", "E5F6-G7H8", "I9J0-K1L2", "M3N4-O5P6",
  "Q7R8-S9T0", "U1V2-W3X4", "Y5Z6-A7B8", "C9D0-E1F2",
]

// ---------------------------------------------------------------------------
// Active sessions data
// ---------------------------------------------------------------------------
const SESSIONS = [
  { device: "MacBook Pro — Chrome 122", location: "Warsaw, Poland", lastActive: "Today, 10:42 AM" },
  { device: "iPhone 15 — Safari", location: "Krakow, Poland", lastActive: "Yesterday, 6:15 PM" },
]

// ---------------------------------------------------------------------------
// Sub-panels
// ---------------------------------------------------------------------------

function ProfilePanel() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
        <p className="text-sm text-slate-500 mt-1">Update your personal information.</p>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-start gap-3">
        <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
          <User className="w-9 h-9 text-slate-400" strokeWidth={1.5} />
        </div>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Profile picture is assigned automatically based on your account type.
        </p>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="first-name" className="text-sm font-medium text-slate-700">First name</Label>
          <Input id="first-name" defaultValue="Alexandra" className="border-slate-200 focus-visible:ring-primary" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last-name" className="text-sm font-medium text-slate-700">Last name</Label>
          <Input id="last-name" defaultValue="Kowalski" className="border-slate-200 focus-visible:ring-primary" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email address</Label>
          <div className="relative">
            <Input
              id="email"
              defaultValue="a.kowalski@example.com"
              readOnly
              className="border-slate-200 bg-slate-50 text-slate-500 pr-32 cursor-default"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
              Change email
            </button>
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="phone" className="text-sm font-medium text-slate-700">Phone number</Label>
          <Input id="phone" defaultValue="+48 600 123 456" className="border-slate-200 focus-visible:ring-primary" />
        </div>
      </div>

      <Button className="bg-blue-600 hover:bg-blue-700 text-white">
        Save changes
      </Button>
    </div>
  )
}

function SecurityPanel() {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [revokedSessions, setRevokedSessions] = useState<number[]>([])
  const strength = passwordStrength(newPassword)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Security</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your password and active sessions.</p>
      </div>

      {/* Change password */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-slate-800">Change password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current password */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Current password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                placeholder="Enter current password"
                className="border-slate-200 pr-10 focus-visible:ring-primary"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowCurrent(!showCurrent)}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">New password</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                placeholder="Enter new password"
                className="border-slate-200 pr-10 focus-visible:ring-primary"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Strength bar */}
            <div className="space-y-1 pt-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((seg) => (
                  <div
                    key={seg}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                      strength >= seg ? STRENGTH_COLOR[strength] : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              {newPassword && (
                <p className={`text-xs font-medium ${
                  strength <= 1 ? "text-red-500"
                  : strength === 2 ? "text-orange-400"
                  : strength === 3 ? "text-yellow-500"
                  : "text-green-600"
                }`}>
                  {STRENGTH_LABEL[strength]}
                </p>
              )}
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Confirm new password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat new password"
                className="border-slate-200 pr-10 focus-visible:ring-primary"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button className="bg-blue-600 hover:bg-blue-700 text-white mt-2">
            Update password
          </Button>
        </CardContent>
      </Card>

      {/* Active sessions */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-slate-800">Active sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {SESSIONS.map((session, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between gap-4 py-3 ${
                idx < SESSIONS.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Monitor className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{session.device}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-500">{session.location}</span>
                    <span className="text-slate-300 text-xs">·</span>
                    <span className="text-xs text-slate-400">{session.lastActive}</span>
                  </div>
                </div>
              </div>
              {revokedSessions.includes(idx) ? (
                <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">Revoked</Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 text-slate-600 hover:bg-slate-50 text-xs shrink-0"
                  onClick={() => setRevokedSessions((p) => [...p, idx])}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function MfaPanel() {
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [setupStep, setSetupStep] = useState<1 | 2>(1)
  const [code, setCode] = useState("")
  const [verified, setVerified] = useState(false)

  const authenticatorApps = [
    { name: "Google Authenticator", initials: "GA", color: "bg-red-100 text-red-600" },
    { name: "Authy", initials: "Au", color: "bg-blue-100 text-blue-600" },
    { name: "Microsoft Authenticator", initials: "MS", color: "bg-blue-100 text-blue-800" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Two-Factor Authentication</h2>
        <p className="text-sm text-slate-500 mt-1">Add an extra layer of security to your account.</p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">Status:</span>
        <Badge
          className={`text-xs font-semibold border-0 ${
            mfaEnabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
          }`}
        >
          {mfaEnabled ? "Enabled" : "Disabled"}
        </Badge>
        {!mfaEnabled && (
          <button
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            onClick={() => setMfaEnabled(true)}
          >
            Enable 2FA
          </button>
        )}
        {mfaEnabled && (
          <button
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            onClick={() => { setMfaEnabled(false); setVerified(false); setCode("") }}
          >
            Disable
          </button>
        )}
      </div>

      {/* Setup flow — shown when enabling but not yet verified */}
      {mfaEnabled && !verified && (
        <Card className="border-blue-100 bg-blue-50/40 shadow-sm">
          <CardContent className="pt-6 space-y-6">
            {/* Step 1 — QR */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <p className="text-sm font-semibold text-slate-800">Scan with your authenticator app</p>
              </div>
              <div className="flex flex-col items-start gap-2 pl-8">
                <div className="w-40 h-40 bg-slate-200 rounded-lg flex items-center justify-center border border-slate-300">
                  <div className="grid grid-cols-7 gap-0.5 p-2 opacity-40">
                    {Array.from({ length: 49 }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-[1px] ${Math.random() > 0.5 ? "bg-slate-800" : "bg-transparent"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500">Scan this QR code with your authenticator app</p>
              </div>
            </div>

            {/* Step 2 — Verify */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 ${setupStep === 2 ? "bg-blue-600" : "bg-slate-300"}`}>2</div>
                <p className="text-sm font-semibold text-slate-800">Enter the 6-digit code</p>
              </div>
              <div className="flex items-center gap-3 pl-8">
                <Input
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setSetupStep(2) }}
                  className="w-36 border-slate-200 focus-visible:ring-primary text-center tracking-widest font-mono text-lg"
                />
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={code.length < 6}
                  onClick={() => setVerified(true)}
                >
                  Verify and enable
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backup codes — shown when MFA is enabled and verified */}
      {mfaEnabled && verified && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <CardTitle className="text-base font-semibold text-slate-800">2FA is active — Backup codes</CardTitle>
            </div>
            <p className="text-sm text-slate-500 mt-1">Store these codes in a safe place. Each can be used once.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 rounded-lg p-4">
              {BACKUP_CODES.map((code) => (
                <code key={code} className="text-xs font-mono text-slate-700 bg-white rounded px-2 py-1.5 border border-slate-200 text-center">
                  {code}
                </code>
              ))}
            </div>
            <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 gap-2">
              <Download className="w-4 h-4" />
              Download backup codes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Supported apps */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Supported authenticator apps</p>
        <div className="flex flex-col sm:flex-row gap-3">
          {authenticatorApps.map((app) => (
            <div key={app.name} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${app.color}`}>
                {app.initials}
              </div>
              <span className="text-sm text-slate-700 font-medium">{app.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotificationsPanel() {
  const [toggles, setToggles] = useState({
    emailReminders: true,
    overdueNotices: true,
    reservationUpdates: true,
    accountAlerts: false,
  })

  const items = [
    {
      key: "emailReminders" as const,
      label: "Email reminders",
      description: "Receive reminders 3 days before your loan due date.",
    },
    {
      key: "overdueNotices" as const,
      label: "Overdue notices",
      description: "Get notified when a loan becomes overdue.",
    },
    {
      key: "reservationUpdates" as const,
      label: "Reservation updates",
      description: "Be notified when a reserved book becomes available.",
    },
    {
      key: "accountAlerts" as const,
      label: "Account alerts",
      description: "Security and account status notifications.",
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Notifications</h2>
        <p className="text-sm text-slate-500 mt-1">Choose which notifications you want to receive.</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6 divide-y divide-slate-100">
          {items.map((item, idx) => (
            <div key={item.key} className={`flex items-center justify-between gap-6 py-4 ${idx === 0 ? "pt-0" : ""}`}>
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
              </div>
              <Switch
                checked={toggles[item.key]}
                onCheckedChange={(val) => setToggles((p) => ({ ...p, [item.key]: val }))}
                className="data-[state=checked]:bg-blue-600 shrink-0"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button className="bg-blue-600 hover:bg-blue-700 text-white">
        Save preferences
      </Button>
    </div>
  )
}

function DangerZonePanel() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Danger Zone</h2>
        <p className="text-sm text-slate-500 mt-1">These actions are irreversible. Please proceed with caution.</p>
      </div>

      <div className="rounded-xl border-2 border-red-200 bg-red-50/30 p-6 space-y-6">
        {/* Block account */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800">Block my account temporarily</p>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
              Your account will be suspended and you will not be able to log in until you contact support to reactivate it.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <Lock className="w-4 h-4 mr-2" />
            Block account
          </Button>
        </div>

        <div className="border-t border-red-200" />

        {/* Delete account */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800">Delete my account permanently</p>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
              All your data, loan history, and reservations will be permanently deleted. This action cannot be undone.
            </p>
          </div>
          <Button className="bg-red-600 hover:bg-red-700 text-white shrink-0">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Delete account
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>("profile")

  const panelMap: Record<Section, React.ReactNode> = {
    profile: <ProfilePanel />,
    security: <SecurityPanel />,
    mfa: <MfaPanel />,
    notifications: <NotificationsPanel />,
    danger: <DangerZonePanel />,
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1 bg-slate-50">
        {/* Page header */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Account Settings</h1>
            <p className="text-slate-500 mt-2 text-base">
              Manage your personal information and security preferences.
            </p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* Sidebar nav */}
            <aside className="w-full lg:w-60 shrink-0">
              <nav className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {NAV_ITEMS.map((item, idx) => {
                  const isActive = activeSection === item.id
                  const isDanger = item.id === "danger"
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left transition-all duration-150 border-l-[3px] ${
                        idx < NAV_ITEMS.length - 1 ? "border-b border-slate-100" : ""
                      } ${
                        isActive
                          ? "border-l-blue-600 bg-blue-50 text-blue-700"
                          : isDanger
                          ? "border-l-transparent text-red-500 hover:bg-red-50 hover:text-red-600"
                          : "border-l-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span className={isActive ? "text-blue-600" : isDanger ? "text-red-400" : "text-slate-400"}>
                        {item.icon}
                      </span>
                      {item.label}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-blue-400" />}
                    </button>
                  )
                })}
              </nav>
            </aside>

            {/* Content panel */}
            <div className="flex-1 min-w-0">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8">
                {panelMap[activeSection]}
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
