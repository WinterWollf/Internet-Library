// [v0 import] Component: Footer
// Location: frontend/components/footer.tsx
// Connect to: N/A — static footer
// Mock data: Privacy Policy and Contact hrefs are "#" placeholders
// Auth: public
// TODO: replace "#" hrefs with real routes (/privacy, /contact)
import { BookOpen } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo + copyright */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-center w-5 h-5 rounded bg-primary">
              <BookOpen className="w-3 h-3 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span>
              <span className="text-foreground font-medium">InternetLibrary</span>
              {" "}&copy; {currentYear}. All rights reserved.
            </span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6" aria-label="Footer navigation">
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
