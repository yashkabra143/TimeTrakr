import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, Download } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { useImportTimeEntries, useImportWithdrawals, useIsPro } from "@/lib/hooks";
import type { ImportResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { UpgradeModal } from "@/components/upgrade-modal";

type ImportResultEx = ImportResult & { skipped?: number };

// ── Template CSV strings ───────────────────────────────────────────────────
const ENTRY_TEMPLATE = `date,project,hours,description
1/15/2026,My Project,2.30,API integration work
1/16/2026,My Project,1.45,Bug fixes and testing
2/1/2026,My Project,3.00,Feature development`;

const WITHDRAWAL_TEMPLATE = `date,amount,notes,status
2024-01-31,250.50,January earnings,received
2024-02-28,180.00,February earnings,pending`;

function downloadTemplate(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Result Summary ─────────────────────────────────────────────────────────
function ImportSummary({ result, onReset }: { result: ImportResultEx; onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className={cn("grid gap-3 text-center", result.skipped ? "grid-cols-4" : "grid-cols-3")}>
        <div className="p-3 rounded-xl border"
          style={{ background: "hsl(155,60%,38%,0.06)", borderColor: "hsl(155,60%,38%,0.25)" }}>
          <CheckCircle2 className="w-5 h-5 mx-auto mb-1" style={{ color: "hsl(155,60%,38%)" }} />
          <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: "'Syne', sans-serif", color: "hsl(155,60%,38%)" }}>
            {result.imported}
          </p>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>Imported</p>
        </div>
        <div className="p-3 rounded-xl border border-destructive/20"
          style={{ background: "hsl(0,72%,51%,0.05)" }}>
          <XCircle className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold tabular-nums text-destructive" style={{ fontFamily: "'Syne', sans-serif" }}>
            {result.failed.length}
          </p>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>Failed</p>
        </div>
        {result.skipped ? (
          <div className="p-3 rounded-xl"
            style={{ background: "hsl(38,92%,50%,0.08)", border: "1px solid hsl(38,92%,50%,0.2)" }}>
            <AlertCircle className="w-5 h-5 mx-auto mb-1" style={{ color: "hsl(38,92%,45%)" }} />
            <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: "'Syne', sans-serif", color: "hsl(38,92%,45%)" }}>
              {result.skipped}
            </p>
            <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>Skipped</p>
          </div>
        ) : null}
        <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
          <FileText className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>
            {result.total}
          </p>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>Total Rows</p>
        </div>
      </div>

      {result.skipped ? (
        <p className="text-xs text-muted-foreground text-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
          Skipped rows = service fees, withdrawals & non-earning transactions (expected for Upwork reports)
        </p>
      ) : null}

      {result.failed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold flex items-center gap-1.5 text-destructive"
            style={{ fontFamily: "'Manrope', sans-serif" }}>
            <AlertCircle className="w-3.5 h-3.5" /> Failed rows:
          </p>
          <div className="max-h-36 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5">
            {result.failed.map((f, i) => (
              <div key={i} className="text-xs flex gap-2">
                <span className="text-muted-foreground shrink-0" style={{ fontFamily: "'DM Mono', monospace" }}>
                  Row {f.row}:
                </span>
                <span className="text-destructive" style={{ fontFamily: "'Manrope', sans-serif" }}>{f.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.imported > 0 && (
        <p className="text-sm text-center font-medium" style={{ fontFamily: "'Manrope', sans-serif", color: "hsl(155,60%,38%)" }}>
          {result.imported} row{result.imported !== 1 ? "s" : ""} imported successfully!
        </p>
      )}

      <motion.button
        onClick={onReset}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="w-full h-10 rounded-xl text-sm font-semibold border border-border/60 bg-card hover:bg-muted/50 transition-colors"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        Import Another File
      </motion.button>
    </motion.div>
  );
}

// ── File Drop Zone ─────────────────────────────────────────────────────────
function DropZone({ onFile, isLoading }: { onFile: (text: string, name: string) => void; isLoading: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const readFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      alert("Please upload a .csv file");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => onFile(e.target?.result as string, file.name);
    reader.readAsText(file);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
      className={cn(
        "border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all",
        dragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border/60 hover:border-primary/50 hover:bg-muted/30",
        isLoading && "pointer-events-none opacity-50"
      )}
    >
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
      <Upload className={cn("w-8 h-8 mx-auto mb-3 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
      {fileName ? (
        <div className="flex items-center justify-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>{fileName}</p>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Drop your CSV file here
          </p>
          <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
            or click to browse
          </p>
        </>
      )}
    </div>
  );
}

// ── Main Dialog ────────────────────────────────────────────────────────────
interface CsvImportDialogProps {
  type: "entries" | "withdrawals";
  trigger?: React.ReactNode;
}

export function CsvImportDialog({ type, trigger }: CsvImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ImportResultEx | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isPro = useIsPro();
  const importEntries = useImportTimeEntries();
  const importWithdrawals = useImportWithdrawals();

  const isEntries = type === "entries";
  const mutation = isEntries ? importEntries : importWithdrawals;

  const handleFile = (text: string) => setCsvText(text);

  const handleImport = async () => {
    if (!csvText) return;
    try {
      const res = await mutation.mutateAsync(csvText);
      setResult(res);
    } catch (err: any) {
      setResult({ imported: 0, failed: [{ row: 0, reason: err?.message || "Unknown error" }], total: 0 });
    }
  };

  const handleReset = () => { setResult(null); setCsvText(null); };
  const handleOpenChange = (v: boolean) => { setOpen(v); if (!v) { setResult(null); setCsvText(null); } };

  if (!isPro) {
    return (
      <>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowUpgrade(true)}
          className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold border border-border/60 bg-card hover:bg-muted/50 transition-colors"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <Upload className="w-3.5 h-3.5" /> Import CSV
        </motion.button>
        <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} featureName="CSV Import" />
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold border border-border/60 bg-card hover:bg-muted/50 transition-colors"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </motion.button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md rounded-2xl p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-border/60">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "hsl(38,92%,50%)" }}>
                <Upload className="w-4 h-4" style={{ color: "hsl(228,25%,9%)" }} />
              </div>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                Import {isEntries ? "Time Entries" : "Withdrawals"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {isEntries
                ? "Upload your Upwork transaction report CSV directly, or use the simple format: date, project, hours, description."
                : "Upload a CSV with columns: date, amount, notes (optional), status (optional: pending/received)."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          {result ? (
            <ImportSummary result={result} onReset={handleReset} />
          ) : (
            <div className="space-y-4">
              {/* Template download */}
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border/60 bg-muted/30">
                <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Need the format?
                </span>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => downloadTemplate(
                    isEntries ? ENTRY_TEMPLATE : WITHDRAWAL_TEMPLATE,
                    isEntries ? "time-entries-template.csv" : "withdrawals-template.csv"
                  )}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  <Download className="w-3.5 h-3.5" /> Download Template
                </motion.button>
              </div>

              {/* Format reference */}
              <div className="rounded-xl bg-muted/30 border border-border/60 p-3 text-xs overflow-x-auto whitespace-pre-wrap"
                style={{ fontFamily: "'DM Mono', monospace", color: "hsl(220,10%,50%)" }}>
                {isEntries
                  ? "✅ Upwork report: upload as-is (auto-detected)\n\n✅ Simple format:\ndate, project, hours, description\n15/1/2026, My Project, 2.30, Work done\n\nDate formats accepted:\n  15/1/2026 · 1/15/2026 · 2026-01-15"
                  : "date, amount, notes, status\n1/31/2026, 250.50, January, received"}
              </div>

              <DropZone onFile={handleFile} isLoading={mutation.isPending} />

              {csvText && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-xs font-medium"
                  style={{ color: "hsl(155,60%,38%)", fontFamily: "'Manrope', sans-serif" }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  File loaded — ready to import
                </motion.div>
              )}

              <motion.button
                onClick={handleImport}
                disabled={!csvText || mutation.isPending}
                whileHover={csvText && !mutation.isPending ? { scale: 1.01, boxShadow: "0 6px 24px hsl(38,92%,50%,0.35)" } : {}}
                whileTap={csvText && !mutation.isPending ? { scale: 0.98 } : {}}
                className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  background: "hsl(38,92%,50%)",
                  color: "hsl(228,25%,9%)",
                  boxShadow: "0 4px 16px hsl(38,92%,50%,0.2)",
                }}
              >
                {mutation.isPending ? "Importing..." : `Import ${isEntries ? "Time Entries" : "Withdrawals"}`}
              </motion.button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
