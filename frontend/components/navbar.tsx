"use client";

// [v0 import] Component: Navbar
// Location: frontend/components/navbar.tsx
// Connect to: POST /api/v1/auth/logout/ — Logout option in user menu
// Auth: public shell; auth-aware (shows user menu when logged in)

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { BookOpen, Menu, X, User, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "My loans", href: "/loans" },
  ];

  const initials = user
    ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase()
    : "";

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "bg-background/95 backdrop-blur-md border-b border-border"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
              <BookOpen className="w-4 h-4 text-primary-foreground" strokeWidth={2} />
            </div>
            <span className="text-foreground font-semibold text-base tracking-tight">
              Internet<span className="text-primary">Library</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth Area */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="w-9 h-9 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center hover:bg-primary/90 transition-colors"
                  aria-label="User menu"
                >
                  {initials || <User className="w-4 h-4" />}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      My account
                    </Link>
                    {user?.role === "admin" && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        Admin panel
                      </Link>
                    )}
                    <button
                      onClick={() => { setDropdownOpen(false); void logout(); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 bg-white"
                  asChild
                >
                  <Link href="/login">Login</Link>
                </Button>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  asChild
                >
                  <Link href="/login?tab=register">Register</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background/98 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex gap-3 pt-2 border-t border-border">
              {isAuthenticated ? (
                <>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href="/settings" onClick={() => setMenuOpen(false)}>
                      My account
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { setMenuOpen(false); void logout(); }}
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50 bg-white"
                    asChild
                  >
                    <Link href="/login" onClick={() => setMenuOpen(false)}>Login</Link>
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    asChild
                  >
                    <Link href="/login?tab=register" onClick={() => setMenuOpen(false)}>
                      Register
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
