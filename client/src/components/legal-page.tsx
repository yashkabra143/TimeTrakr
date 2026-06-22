import { Link } from "wouter";
import { Clock, ArrowLeft } from "lucide-react";

/**
 * Shared shell for static legal documents (Privacy Policy, Terms of Service).
 * Public, full-screen, light theme for long-form readability — matches the
 * app's Syne (headings) / Manrope (body) + amber accent design language.
 */
export function LegalPage({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "hsl(220,20%,97%)", fontFamily: "'Manrope', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(38,92%,50%)" }}>
              <Clock className="w-3.5 h-3.5" style={{ color: "hsl(228,25%,9%)" }} />
            </div>
            <span className="text-base font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "hsl(228,25%,12%)" }}>
              TimeTrakr
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight"
          style={{ fontFamily: "'Syne', sans-serif", color: "hsl(228,25%,10%)", letterSpacing: "-0.02em" }}
        >
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

        {/* Template disclaimer — remove once a lawyer has reviewed + placeholders filled. */}
        <div className="mt-6 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Template notice:</strong> This is a starting point, not legal advice. Have it reviewed by a qualified
          lawyer and replace every <code className="px-1 rounded bg-amber-100">[bracketed]</code> placeholder before you
          rely on it publicly.
        </div>

        {intro && <div className="mt-8 text-[15px] leading-relaxed" style={{ color: "hsl(228,12%,30%)" }}>{intro}</div>}

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed" style={{ color: "hsl(228,12%,30%)" }}>
          {children}
        </div>

        <footer className="mt-16 pt-8 border-t border-black/5 flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} TimeTrakr. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

/** A titled section within a legal document. */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "hsl(228,25%,14%)" }}>
        {heading}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
