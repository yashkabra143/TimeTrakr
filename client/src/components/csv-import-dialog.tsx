import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useImportTimeEntries, useImportWithdrawals } from "@/lib/hooks";
import type { ImportResult } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Template CSV strings ───────────────────────────────────────────────────
const ENTRY_TEMPLATE = `date,project,hours,description
2024-01-15,My Project,2.30,API integration work
2024-01-16,My Project,1.45,Bug fixes and testing
2024-02-01,My Project,3.00,Feature development`;

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
function ImportSummary({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.imported}</p>
          <p className="text-xs text-green-600">Imported</p>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
          <XCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{result.failed.length}</p>
          <p className="text-xs text-red-500">Failed</p>
        </div>
        <div className="p-3 bg-muted rounded-lg border border-border">
          <FileText className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-2xl font-bold">{result.total}</p>
          <p className="text-xs text-muted-foreground">Total Rows</p>
        </div>
      </div>

      {result.failed.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-1 text-destructive">
            <AlertCircle className="w-4 h-4" /> Failed rows:
          </p>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2 space-y-1">
            {result.failed.map((f, i) => (
              <div key={i} className="text-xs flex gap-2">
                <span className="font-mono text-muted-foreground shrink-0">Row {f.row}:</span>
                <span className="text-destructive">{f.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.imported > 0 && (
        <p className="text-sm text-green-600 text-center">
          ✅ {result.imported} row{result.imported !== 1 ? "s" : ""} imported successfully!
        </p>
      )}

      <Button variant="outline" onClick={onReset} className="w-full">Import Another File</Button>
    </div>
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
        "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
        isLoading && "pointer-events-none opacity-50"
      )}
    >
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      {fileName ? (
        <p className="text-sm font-medium">{fileName}</p>
      ) : (
        <>
          <p className="text-sm font-medium">Drop your CSV file here</p>
          <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
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
  const [result, setResult] = useState<ImportResult | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" /> Import CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import {isEntries ? "Time Entries" : "Withdrawals"} via CSV</DialogTitle>
          <DialogDescription>
            {isEntries
              ? "Upload a CSV with columns: date, project, hours, description (optional)."
              : "Upload a CSV with columns: date, amount, notes (optional), status (optional)."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <ImportSummary result={result} onReset={handleReset} />
        ) : (
          <div className="space-y-4">
            {/* Template download */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border text-sm">
              <span className="text-muted-foreground">Need the format?</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadTemplate(
                  isEntries ? ENTRY_TEMPLATE : WITHDRAWAL_TEMPLATE,
                  isEntries ? "time-entries-template.csv" : "withdrawals-template.csv"
                )}
              >
                <Download className="w-4 h-4 mr-1" /> Download Template
              </Button>
            </div>

            {/* Column format reference */}
            <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
              {isEntries
                ? "date, project, hours, description\n2024-01-15, My Project, 2.30, Work done"
                : "date, amount, notes, status\n2024-01-31, 250.50, January, received"}
            </div>

            <DropZone onFile={handleFile} isLoading={mutation.isPending} />

            {csvText && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                File loaded — ready to import
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={!csvText || mutation.isPending}
              className="w-full"
            >
              {mutation.isPending ? "Importing..." : `Import ${isEntries ? "Time Entries" : "Withdrawals"}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
