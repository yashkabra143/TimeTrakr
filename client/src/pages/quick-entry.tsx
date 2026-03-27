import { motion } from "framer-motion";
import { EntryForm } from "@/components/entry-form";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { Zap, Upload } from "lucide-react";

const fade = (i = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] } },
});

export default function QuickEntry() {
  return (
    <div className="max-w-2xl mx-auto space-y-7 pb-8">

      {/* Header */}
      <motion.div {...fade(0)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-1"
            style={{ fontFamily: "'DM Mono', monospace" }}>
            Log Time
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            Quick Entry
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Log your hours quickly for any project.
          </p>
        </div>

        <CsvImportDialog
          type="entries"
          trigger={
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-semibold border border-border/60 bg-card hover:bg-muted/60 transition-colors"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </motion.button>
          }
        />
      </motion.div>

      {/* Form card */}
      <motion.div
        {...fade(1)}
        className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm"
      >
        {/* Card header */}
        <div className="px-6 pt-5 pb-4 border-b border-border/40 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "hsl(38,92%,50%)" }}>
            <Zap className="w-4 h-4" style={{ color: "hsl(228,25%,9%)" }} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              New Time Entry
            </h2>
            <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Select a project and enter hours. Earnings calculated automatically.
            </p>
          </div>
        </div>

        <div className="p-6">
          <EntryForm />
        </div>
      </motion.div>
    </div>
  );
}
