// [v0 import] Component: HowItWorks
// Location: frontend/components/how-it-works.tsx
// Connect to: N/A — static informational section
// Mock data: step descriptions are hardcoded
// Auth: public
// TODO: none
import { Search, BookMarked, RotateCcw } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Search",
    description:
      "Find books by title, author, or ISBN using our powerful search engine with instant results.",
  },
  {
    icon: BookMarked,
    title: "Borrow",
    description:
      "Reserve your copy with one click and get instant access — no queues, no paperwork.",
  },
  {
    icon: RotateCcw,
    title: "Return",
    description:
      "Return or extend your loan anytime from your personal dashboard before the due date.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 lg:py-28 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Simple process
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            How it works
          </h2>
          <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
            Start reading in minutes. Three simple steps between you and your next great book.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="flex flex-col items-center text-center gap-5 group"
              >
                {/* Icon circle */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:border-blue-300 group-hover:bg-blue-50 transition-all duration-300">
                    <Icon className="w-7 h-7 text-primary" strokeWidth={1.5} />
                  </div>
                  {/* Step number */}
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
