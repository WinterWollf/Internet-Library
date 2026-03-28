"use client"

// [v0 import] Component: AuthPage (Login / Register / MFA)
// Location: frontend/app/(auth)/login/page.tsx  →  route: /login
// Connect to: POST /api/v1/auth/login/ — Sign in button; POST /api/v1/auth/register/ — Create account button; POST /api/v1/auth/mfa/ — Verify button (MFA step); POST /api/v1/auth/token/refresh — token refresh
// Mock data: Sign in button currently just switches to MFA view (no real API call); Create account button is disabled when terms not agreed but makes no API call; Resend code button has no handler; Verify button makes no API call
// Auth: public (unauthenticated only — redirect to /catalog if already logged in)
// TODO: wire Sign in to POST /api/v1/auth/login/; on 200 check mfa_required flag — if true show MFA view, else redirect to /catalog; wire Register to POST /api/v1/auth/register/ with { first_name, last_name, email, password, gender }; wire Verify to POST /api/v1/auth/mfa/ with the 6-digit OTP; wire Resend code; implement Forgot password flow; implement Continue as guest (redirect to /catalog without auth); store JWT in httpOnly cookie via backend Set-Cookie

import { useState, useRef, KeyboardEvent } from "react"
import Link from "next/link"
import { BookOpen, Eye, EyeOff, ArrowLeft, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"]
const strengthColor = [
  "bg-slate-200",
  "bg-red-400",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-green-500",
]

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getStrength(password)
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              password.length === 0
                ? "bg-slate-200"
                : seg <= strength
                ? strengthColor[strength]
                : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p className="text-xs text-slate-500">{strengthLabel[strength]}</p>
      )}
    </div>
  )
}

// ── OTP input row ─────────────────────────────────────────────────────────────
function OTPInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (val: string[]) => void
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace") {
      if (value[idx]) {
        const next = [...value]
        next[idx] = ""
        onChange(next)
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus()
      }
    }
  }

  const handleChange = (raw: string, idx: number) => {
    const digit = raw.replace(/\D/g, "").slice(-1)
    const next = [...value]
    next[idx] = digit
    onChange(next)
    if (digit && idx < 5) refs.current[idx + 1]?.focus()
  }

  return (
    <div className="flex gap-3 justify-center">
      {value.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => { refs.current[idx] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(e.target.value, idx)}
          onKeyDown={(e) => handleKey(e, idx)}
          className="w-12 h-14 text-center text-xl font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 outline-none transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-100 caret-blue-600"
        />
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
type AuthView = "tabs" | "mfa"

export default function AuthPage() {
  // shared state
  const [view, setView] = useState<AuthView>("tabs")
  const [activeTab, setActiveTab] = useState<"login" | "register">("login")

  // login
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPw, setShowLoginPw] = useState(false)

  // register
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showRegPw, setShowRegPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [gender, setGender] = useState<"female" | "male" | null>(null)
  const [agreed, setAgreed] = useState(false)

  // MFA
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-slate-900 tracking-tight">
          Internet Library
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-lg shadow-slate-200/80 border border-slate-100 overflow-hidden">
        {view === "tabs" && (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "login" | "register")}
          >
            {/* Tab switcher */}
            <div className="px-6 pt-6">
              <TabsList className="w-full grid grid-cols-2 bg-slate-100 rounded-lg p-1">
                <TabsTrigger
                  value="login"
                  className="rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500"
                >
                  Sign in
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500"
                >
                  Register
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── LOGIN ── */}
            <TabsContent value="login" className="px-6 pb-8 pt-6 space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 text-balance">
                  Welcome back
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Sign in to your account to continue.
                </p>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-sm font-medium text-slate-700">
                  Email address
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="h-10 border-slate-300 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-pw" className="text-sm font-medium text-slate-700">
                    Password
                  </Label>
                  <Link
                    href="#"
                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="login-pw"
                    type={showLoginPw ? "text" : "password"}
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="h-10 pr-10 border-slate-300 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw(!showLoginPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showLoginPw ? "Hide password" : "Show password"}
                  >
                    {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Sign in button */}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 font-medium"
                onClick={() => setView("mfa")}
              >
                Sign in
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Guest */}
              <Button
                variant="outline"
                className="w-full h-10 border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
              >
                Continue as guest
              </Button>
            </TabsContent>

            {/* ── REGISTER ── */}
            <TabsContent value="register" className="px-6 pb-8 pt-6 space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 text-balance">
                  Create account
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Join our library and start borrowing books.
                </p>
              </div>

              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name" className="text-sm font-medium text-slate-700">
                    First name
                  </Label>
                  <Input
                    id="first-name"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-10 border-slate-300 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name" className="text-sm font-medium text-slate-700">
                    Last name
                  </Label>
                  <Input
                    id="last-name"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-10 border-slate-300 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-sm font-medium text-slate-700">
                  Email address
                </Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="h-10 border-slate-300 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* Password + strength */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-pw" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="reg-pw"
                    type={showRegPw ? "text" : "password"}
                    placeholder="Create a password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="h-10 pr-10 border-slate-300 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPw(!showRegPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showRegPw ? "Hide password" : "Show password"}
                  >
                    {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthBar password={regPassword} />
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw" className="text-sm font-medium text-slate-700">
                  Confirm password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-pw"
                    type={showConfirmPw ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-10 pr-10 border-slate-300 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showConfirmPw ? "Hide password" : "Show password"}
                  >
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && regPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match.</p>
                )}
              </div>

              {/* Gender selector */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Gender <span className="text-slate-400 font-normal">(sets your profile avatar)</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["female", "male"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`h-11 rounded-lg border-2 text-sm font-medium transition-all capitalize ${
                        gender === g
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {g === "female" ? "Female" : "Male"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Terms */}
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="terms"
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(!!v)}
                  className="mt-0.5 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <label htmlFor="terms" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                  I agree to the{" "}
                  <Link href="#" className="text-blue-600 hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              {/* Submit */}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 font-medium"
                disabled={!agreed}
              >
                Create account
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {/* ── MFA VIEW ── */}
        {view === "mfa" && (
          <div className="px-6 py-8 space-y-6">
            {/* Icon */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Shield className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Two-Factor Authentication
                </h1>
                <p className="text-sm text-slate-500 mt-1 text-balance">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>
            </div>

            {/* OTP boxes */}
            <OTPInput value={otpDigits} onChange={setOtpDigits} />

            {/* Verify */}
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 font-medium"
              disabled={otpDigits.some((d) => d === "")}
            >
              Verify
            </Button>

            {/* Resend */}
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
              >
                Resend code
              </button>
            </div>

            {/* Back */}
            <div className="pt-1 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => {
                  setView("tabs")
                  setOtpDigits(["", "", "", "", "", ""])
                }}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to login
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Below-card link */}
      <p className="mt-6 text-sm text-slate-500">
        {view === "tabs" && activeTab === "login" ? (
          <>
            {"Don't have an account? "}
            <button
              type="button"
              onClick={() => setActiveTab("register")}
              className="text-blue-600 font-medium hover:underline"
            >
              Register
            </button>
          </>
        ) : view === "tabs" && activeTab === "register" ? (
          <>
            {"Already have an account? "}
            <button
              type="button"
              onClick={() => setActiveTab("login")}
              className="text-blue-600 font-medium hover:underline"
            >
              Sign in
            </button>
          </>
        ) : (
          <Link href="/" className="text-slate-400 hover:text-slate-600">
            Return to homepage
          </Link>
        )}
      </p>
    </div>
  )
}
