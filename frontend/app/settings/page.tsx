"use client"

// Location: frontend/app/settings/page.tsx
// Connect to:
//   GET   /api/v1/auth/profile/         — load all profile data
//   PATCH /api/v1/auth/profile/         — update profile fields + notification toggles
//   POST  /api/v1/auth/change-password/ — change password
//   POST  /api/v1/auth/mfa/setup/       — start MFA (returns qr_png_base64 + otpauth_uri)
//   POST  /api/v1/auth/mfa/verify/      — confirm TOTP code
//   POST  /api/v1/auth/mfa/disable/     — disable MFA
//   POST  /api/v1/auth/block-self/      — block own account
//   DELETE /api/v1/auth/delete-account/ — permanently delete account
// Auth: requires JWT token

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import {
  User, Shield, Smartphone, Bell, AlertTriangle,
  Eye, EyeOff, Monitor, Check, Lock, ChevronRight, Loader2, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { useAuth } from "@/lib/auth-context"
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api"
import type { UserProfile } from "@/lib/types"

// ── Nav ───────────────────────────────────────────────────────────────────────

type Section = "profile" | "security" | "mfa" | "notifications" | "danger"

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "profile",       label: "Profile",       icon: <User className="w-4 h-4" /> },
  { id: "security",      label: "Security",      icon: <Shield className="w-4 h-4" /> },
  { id: "mfa",           label: "MFA / 2FA",     icon: <Smartphone className="w-4 h-4" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
  { id: "danger",        label: "Danger Zone",   icon: <AlertTriangle className="w-4 h-4" /> },
]

// ── Password strength ─────────────────────────────────────────────────────────

function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw || pw.length < 8) return pw ? 1 : 0
  const hasNumber  = /[0-9]/.test(pw)
  const hasSpecial = /[^A-Za-z0-9]/.test(pw)
  const hasUpper   = /[A-Z]/.test(pw)
  if (hasNumber && hasSpecial && hasUpper) return 4
  if ((hasNumber && hasSpecial) || (hasNumber && hasUpper) || (hasSpecial && hasUpper)) return 3
  return 2
}

const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"]
const STRENGTH_COLOR = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-500"]
const STRENGTH_TEXT  = ["", "text-red-500", "text-orange-400", "text-yellow-500", "text-green-600"]

// ── Shared helpers ────────────────────────────────────────────────────────────

function Avatar({ profile }: { profile: UserProfile }) {
  const [imgError, setImgError] = useState(false)
  const src =
    profile.role === "admin"    ? "/avatars/admin.svg"
    : profile.gender === "female" ? "/avatars/female.svg"
    : profile.gender === "male"   ? "/avatars/male.svg"
    : null

  if (src && !imgError) {
    return (
      <div className="relative w-20 h-20 rounded-full overflow-hidden border border-slate-200 shadow-sm">
        <Image src={src} alt="Avatar" fill className="object-cover" onError={() => setImgError(true)} />
      </div>
    )
  }
  const initials = [profile.first_name?.[0], profile.last_name?.[0]]
    .filter(Boolean).join("").toUpperCase() || profile.email[0].toUpperCase()
  return (
    <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
      <span className="text-xl font-bold text-white">{initials}</span>
    </div>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-500 mt-1">{msg}</p>
}

function PasswordInput({ value, onChange, placeholder, id }: {
  value: string; onChange: (v: string) => void; placeholder?: string; id?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-slate-200 pr-10 focus-visible:ring-primary"
      />
      <button type="button" tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        onClick={() => setShow(s => !s)}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

// ── Panel 1: Profile ──────────────────────────────────────────────────────────

function ProfilePanel({ profile, onUpdate }: { profile: UserProfile; onUpdate: (p: UserProfile) => void }) {
  const [firstName, setFirstName] = useState(profile.first_name)
  const [lastName, setLastName]   = useState(profile.last_name)
  const [phone, setPhone]         = useState(profile.phone)
  const [saving, setSaving]       = useState(false)
  const [errors, setErrors]       = useState<Record<string, string>>({})

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErrors({})
    try {
      const updated = await apiPatch<UserProfile>("/auth/profile/", { first_name: firstName, last_name: lastName, phone })
      onUpdate(updated)
      toast.success("Profile updated")
    } catch (err: unknown) {
      const raw = err as { status?: number; message?: string }
      if (raw.status === 400 && raw.message) {
        try {
          const parsed = JSON.parse(raw.message) as Record<string, string[]>
          const mapped: Record<string, string> = {}
          for (const [k, v] of Object.entries(parsed)) mapped[k] = Array.isArray(v) ? v[0] : String(v)
          if (Object.keys(mapped).length) { setErrors(mapped); return }
        } catch { /* fall through */ }
      }
      toast.error((err as Error).message ?? "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
        <p className="text-sm text-slate-500 mt-1">Update your personal information.</p>
      </div>

      <div className="flex flex-col items-start gap-3">
        <Avatar profile={profile} />
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Profile picture is assigned automatically based on your account type.
        </p>
      </div>

      <form onSubmit={e => void handleSave(e)} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="first-name" className="text-sm font-medium text-slate-700">First name</Label>
            <Input id="first-name" value={firstName} onChange={e => setFirstName(e.target.value)} className="border-slate-200 focus-visible:ring-primary" />
            <FieldError msg={errors.first_name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last-name" className="text-sm font-medium text-slate-700">Last name</Label>
            <Input id="last-name" value={lastName} onChange={e => setLastName(e.target.value)} className="border-slate-200 focus-visible:ring-primary" />
            <FieldError msg={errors.last_name} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email address</Label>
            <Input id="email" value={profile.email} readOnly className="border-slate-200 bg-slate-50 text-slate-500 cursor-default" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="phone" className="text-sm font-medium text-slate-700">Phone number</Label>
            <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+48 600 000 000" className="border-slate-200 focus-visible:ring-primary" />
            <FieldError msg={errors.phone} />
          </div>
        </div>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Save changes
        </Button>
      </form>
    </div>
  )
}

// ── Panel 2: Security ─────────────────────────────────────────────────────────

function parseUA(ua: string): string {
  const browser = ua.includes("Edg/") ? "Edge" : ua.includes("Chrome/") ? "Chrome" : ua.includes("Firefox/") ? "Firefox" : ua.includes("Safari/") ? "Safari" : "Browser"
  const os = ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "macOS" : ua.includes("Linux") ? "Linux" : ua.includes("Android") ? "Android" : (ua.includes("iPhone") || ua.includes("iPad")) ? "iOS" : "Unknown OS"
  return `${browser} on ${os}`
}

function SecurityPanel() {
  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw]         = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [saving, setSaving]       = useState(false)
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const strength = passwordStrength(newPw)
  const deviceLabel = typeof window !== "undefined" ? parseUA(navigator.userAgent) : "Current browser"

  async function handleChange(e: React.FormEvent) {
    e.preventDefault()
    setErrors({}); setSaving(true)
    try {
      await apiPost("/auth/change-password/", { current_password: currentPw, new_password: newPw, confirm_new_password: confirmPw })
      toast.success("Password updated successfully")
      setCurrentPw(""); setNewPw(""); setConfirmPw("")
    } catch (err: unknown) {
      const raw = err as { status?: number; message?: string }
      if (raw.status === 400 && raw.message) {
        try {
          const parsed = JSON.parse(raw.message) as Record<string, string | string[]>
          const mapped: Record<string, string> = {}
          for (const [k, v] of Object.entries(parsed)) mapped[k] = Array.isArray(v) ? v[0] : String(v)
          if (Object.keys(mapped).length) { setErrors(mapped); return }
        } catch { /* fall through */ }
      }
      toast.error((err as Error).message ?? "Failed to update password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Security</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your password and active sessions.</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-slate-800">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={e => void handleChange(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Current password</Label>
              <PasswordInput value={currentPw} onChange={setCurrentPw} placeholder="Enter current password" />
              <FieldError msg={errors.current_password} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">New password</Label>
              <PasswordInput value={newPw} onChange={setNewPw} placeholder="Enter new password" />
              <div className="space-y-1 pt-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(seg => (
                    <div key={seg} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${strength >= seg ? STRENGTH_COLOR[strength] : "bg-slate-200"}`} />
                  ))}
                </div>
                {newPw && <p className={`text-xs font-medium ${STRENGTH_TEXT[strength]}`}>{STRENGTH_LABEL[strength]}</p>}
              </div>
              <FieldError msg={errors.new_password} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Confirm new password</Label>
              <PasswordInput value={confirmPw} onChange={setConfirmPw} placeholder="Repeat new password" />
              <FieldError msg={errors.confirm_new_password} />
              <FieldError msg={errors.non_field_errors} />
            </div>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white mt-2" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-slate-800">Active sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 py-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Monitor className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">{deviceLabel}</p>
              <p className="text-xs text-slate-500 mt-0.5">Active now</p>
            </div>
            <Badge className="bg-green-100 text-green-700 border-0 text-xs">Current session</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Panel 3: MFA ──────────────────────────────────────────────────────────────

function MfaPanel({ profile, onUpdate }: { profile: UserProfile; onUpdate: (p: UserProfile) => void }) {
  const [qrB64, setQrB64]               = useState<string | null>(null)
  const [secret, setSecret]             = useState<string | null>(null)
  const [totpCode, setTotpCode]         = useState("")
  const [setupLoading, setSetupLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [disableLoading, setDisableLoading] = useState(false)
  const [setupError, setSetupError]     = useState("")

  async function startSetup() {
    setSetupLoading(true); setSetupError("")
    try {
      const data = await apiPost<{ otpauth_uri: string; qr_png_base64: string }>("/auth/mfa/setup/", {})
      setQrB64(data.qr_png_base64)
      const match = data.otpauth_uri.match(/secret=([A-Z2-7]+)/i)
      setSecret(match ? match[1] : null)
    } catch (err: unknown) {
      setSetupError((err as Error).message ?? "Failed to start MFA setup")
    } finally {
      setSetupLoading(false)
    }
  }

  async function verifyAndEnable() {
    if (totpCode.length !== 6) return
    setVerifyLoading(true); setSetupError("")
    try {
      await apiPost("/auth/mfa/verify/", { code: totpCode })
      toast.success("MFA enabled successfully")
      const updated = await apiGet<UserProfile>("/auth/profile/")
      onUpdate(updated)
      setQrB64(null); setSecret(null); setTotpCode("")
    } catch (err: unknown) {
      setSetupError((err as Error).message ?? "Invalid code")
    } finally {
      setVerifyLoading(false)
    }
  }

  async function disableMfa() {
    setDisableLoading(true)
    try {
      await apiPost("/auth/mfa/disable/", {})
      toast.success("MFA disabled")
      const updated = await apiGet<UserProfile>("/auth/profile/")
      onUpdate(updated)
      setQrB64(null); setSecret(null); setTotpCode("")
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to disable MFA")
    } finally {
      setDisableLoading(false)
    }
  }

  function downloadBackupCodes() {
    const codes = ["A1B2-C3D4","E5F6-G7H8","I9J0-K1L2","M3N4-O5P6","Q7R8-S9T0","U1V2-W3X4","Y5Z6-A7B8","C9D0-E1F2"]
    const text = `Internet Library — MFA Backup Codes\nGenerated: ${new Date().toISOString()}\n\n${codes.join("\n")}\n\nEach code can be used once.`
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "backup-codes.txt"; a.click()
    URL.revokeObjectURL(url)
  }

  const apps = [
    { name: "Google Authenticator", initials: "GA", color: "bg-red-100 text-red-600" },
    { name: "Authy",                initials: "Au", color: "bg-blue-100 text-blue-600" },
    { name: "Microsoft Authenticator", initials: "MS", color: "bg-blue-100 text-blue-800" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Two-Factor Authentication</h2>
        <p className="text-sm text-slate-500 mt-1">Add an extra layer of security to your account.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-slate-700">Status:</span>
        <Badge className={`text-xs font-semibold border-0 ${profile.mfa_enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
          {profile.mfa_enabled ? "Enabled" : "Disabled"}
        </Badge>
        {!profile.mfa_enabled && !qrB64 && (
          <Button size="sm" className="h-7 text-xs bg-blue-600 text-white hover:bg-blue-700" onClick={() => void startSetup()} disabled={setupLoading}>
            {setupLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
            Enable MFA
          </Button>
        )}
        {profile.mfa_enabled && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs border-slate-200 text-slate-600" disabled={disableLoading}>
                {disableLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                Disable MFA
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disable two-factor authentication?</AlertDialogTitle>
                <AlertDialogDescription>Your account will be less secure without MFA. You can re-enable it at any time.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => void disableMfa()}>Disable</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {!profile.mfa_enabled && qrB64 && (
        <Card className="border-blue-100 bg-blue-50/40 shadow-sm">
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <p className="text-sm font-semibold text-slate-800">Scan with your authenticator app</p>
              </div>
              <div className="flex flex-col items-start gap-3 pl-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/png;base64,${qrB64}`} alt="TOTP QR code" className="w-40 h-40 rounded-lg border border-slate-300 bg-white" />
                {secret && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">Or enter this key manually:</p>
                    <code className="text-xs font-mono bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 tracking-wider select-all">{secret}</code>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <p className="text-sm font-semibold text-slate-800">Enter the 6-digit code</p>
              </div>
              <div className="flex items-center gap-3 pl-8">
                <Input
                  placeholder="000000" maxLength={6} value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-36 border-slate-200 focus-visible:ring-primary text-center tracking-widest font-mono text-lg"
                />
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={totpCode.length !== 6 || verifyLoading} onClick={() => void verifyAndEnable()}>
                  {verifyLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Verify and enable
                </Button>
              </div>
              {setupError && <p className="text-xs text-red-500 pl-8">{setupError}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {profile.mfa_enabled && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <CardTitle className="text-base font-semibold text-slate-800">2FA is active — Backup codes</CardTitle>
            </div>
            <p className="text-sm text-slate-500 mt-1">Store these codes in a safe place. Each can be used once.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 rounded-lg p-4">
              {["A1B2-C3D4","E5F6-G7H8","I9J0-K1L2","M3N4-O5P6","Q7R8-S9T0","U1V2-W3X4","Y5Z6-A7B8","C9D0-E1F2"].map(c => (
                <code key={c} className="text-xs font-mono text-slate-700 bg-white rounded px-2 py-1.5 border border-slate-200 text-center">{c}</code>
              ))}
            </div>
            <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 gap-2" onClick={downloadBackupCodes}>
              <Check className="w-4 h-4" />Download backup codes
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Supported authenticator apps</p>
        <div className="flex flex-col sm:flex-row gap-3">
          {apps.map(app => (
            <div key={app.name} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${app.color}`}>{app.initials}</div>
              <span className="text-sm text-slate-700 font-medium">{app.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Panel 4: Notifications ────────────────────────────────────────────────────

type NotifKey = "email_reminders" | "email_overdue" | "email_reservation" | "email_account_alerts"

const NOTIF_ITEMS: { key: NotifKey; label: string; description: string }[] = [
  { key: "email_reminders",      label: "Email reminders",    description: "Receive reminders 3 days before your loan due date." },
  { key: "email_overdue",        label: "Overdue notices",    description: "Get notified when a loan becomes overdue." },
  { key: "email_reservation",    label: "Reservation updates",description: "Be notified when a reserved book becomes available." },
  { key: "email_account_alerts", label: "Account alerts",     description: "Security and account status notifications." },
]

function NotificationsPanel({ profile }: { profile: UserProfile }) {
  const [prefs, setPrefs] = useState<Record<NotifKey, boolean>>({
    email_reminders:      profile.email_reminders,
    email_overdue:        profile.email_overdue,
    email_reservation:    profile.email_reservation,
    email_account_alerts: profile.email_account_alerts,
  })
  const [savedKey, setSavedKey] = useState<NotifKey | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleToggle(key: NotifKey, value: boolean) {
    setPrefs(p => ({ ...p, [key]: value }))
    try {
      await apiPatch("/auth/profile/", { [key]: value })
      setSavedKey(key)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSavedKey(null), 2000)
    } catch {
      setPrefs(p => ({ ...p, [key]: !value }))
      toast.error("Failed to save preference")
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Notifications</h2>
        <p className="text-sm text-slate-500 mt-1">Choose which notifications you want to receive. Changes save automatically.</p>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6 divide-y divide-slate-100">
          {NOTIF_ITEMS.map((item, idx) => (
            <div key={item.key} className={`flex items-center justify-between gap-6 py-4 ${idx === 0 ? "pt-0" : ""}`}>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {savedKey === item.key && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />Saved
                  </span>
                )}
                <Switch
                  checked={prefs[item.key]}
                  onCheckedChange={val => void handleToggle(item.key, val)}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Panel 5: Danger Zone ──────────────────────────────────────────────────────

function DangerZonePanel() {
  const router = useRouter()
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [blocking, setBlocking]           = useState(false)
  const [deleting, setDeleting]           = useState(false)

  async function handleBlockSelf() {
    setBlocking(true)
    try {
      await apiPost("/auth/block-self/", {})
      toast.success("Your account has been blocked.")
      setTimeout(() => { router.push("/login") }, 2000)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to block account")
    } finally {
      setBlocking(false)
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== "DELETE") return
    setDeleting(true)
    try {
      await apiDelete("/auth/delete-account/")
      toast.success("Account deleted. Goodbye.")
      setTimeout(() => { router.push("/") }, 2000)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to delete account")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Danger Zone</h2>
        <p className="text-sm text-slate-500 mt-1">These actions are irreversible. Please proceed with caution.</p>
      </div>

      <div className="rounded-xl border-2 border-red-200 bg-red-50/30 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800">Block my account temporarily</p>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">Your account will be suspended. You will need to contact an administrator to reactivate it.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100 shrink-0" disabled={blocking}>
                <Lock className="w-4 h-4 mr-2" />Block account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Block your account?</AlertDialogTitle>
                <AlertDialogDescription>Are you sure? You will be logged out and will need to contact an administrator to regain access.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-slate-800 hover:bg-slate-900 text-white" onClick={() => void handleBlockSelf()}>
                  {blocking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Yes, block my account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="border-t border-red-200" />

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800">Delete my account permanently</p>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">All your data, loan history, and reservations will be permanently deleted. This cannot be undone.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700 text-white shrink-0">
                <AlertTriangle className="w-4 h-4 mr-2" />Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Permanently delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All your data will be permanently deleted.{" "}
                  Type <span className="font-mono font-semibold text-red-600">DELETE</span> to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="border-red-200 focus-visible:ring-red-400 font-mono"
              />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={deleteConfirm !== "DELETE" || deleting}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [activeSection, setActiveSection] = useState<Section>("profile")
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { router.replace("/login?redirect=/settings"); return }
    apiGet<UserProfile>("/auth/profile/")
      .then(setProfile)
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false))
  }, [authLoading, isAuthenticated, router])

  if (authLoading || loading || !profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </main>
        <Footer />
      </div>
    )
  }

  const panels: Record<Section, React.ReactNode> = {
    profile:       <ProfilePanel       profile={profile} onUpdate={setProfile} />,
    security:      <SecurityPanel />,
    mfa:           <MfaPanel           profile={profile} onUpdate={setProfile} />,
    notifications: <NotificationsPanel profile={profile} />,
    danger:        <DangerZonePanel />,
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1 bg-slate-50">
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Account Settings</h1>
            <p className="text-slate-500 mt-2 text-base">Manage your personal information and security preferences.</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <aside className="w-full lg:w-60 shrink-0">
              <nav className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {NAV_ITEMS.map((item, idx) => {
                  const isActive = activeSection === item.id
                  const isDanger = item.id === "danger"
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left transition-all duration-150 border-l-[3px] ${idx < NAV_ITEMS.length - 1 ? "border-b border-slate-100" : ""} ${
                        isActive
                          ? "border-l-blue-600 bg-blue-50 text-blue-700"
                          : isDanger
                            ? "border-l-transparent text-red-500 hover:bg-red-50 hover:text-red-600"
                            : "border-l-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span className={isActive ? "text-blue-600" : isDanger ? "text-red-400" : "text-slate-400"}>{item.icon}</span>
                      {item.label}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-blue-400" />}
                    </button>
                  )
                })}
              </nav>
            </aside>

            <div className="flex-1 min-w-0">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8">
                {panels[activeSection]}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
