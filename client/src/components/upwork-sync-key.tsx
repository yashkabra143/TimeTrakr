import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SyncStatus { hasKey: boolean; createdAt: string | null; lastSyncAt: string | null }

async function call<T>(method: string): Promise<T> {
  const res = await fetch("/api/sync/key", { method, credentials: "include" });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? `Request failed (${res.status})`);
  return res.status === 204 ? (undefined as T) : res.json();
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Never";

/** Settings → Data: the key the weekly Upwork sync agent uses to send data. */
export function UpworkSyncKey() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newKey, setNewKey] = useState<string | null>(null);
  const { data: status } = useQuery({ queryKey: ["/api/sync/key"], queryFn: () => call<SyncStatus>("GET") });

  const create = useMutation({
    mutationFn: () => call<{ key: string }>("POST"),
    onSuccess: ({ key }) => { setNewKey(key); qc.invalidateQueries({ queryKey: ["/api/sync/key"] }); },
    onError: (e: Error) => toast({ title: "Couldn't create key", description: e.message, variant: "destructive" }),
  });
  const revoke = useMutation({
    mutationFn: () => call<void>("DELETE"),
    onSuccess: () => { setNewKey(null); qc.invalidateQueries({ queryKey: ["/api/sync/key"] }); toast({ title: "Sync key revoked" }); },
    onError: (e: Error) => toast({ title: "Couldn't revoke key", description: e.message, variant: "destructive" }),
  });

  const btn = "flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="space-y-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="px-4 py-3 rounded-xl border border-border/50 bg-background">
          <p className="text-muted-foreground">Sync key</p>
          <p className="font-semibold mt-0.5">{status?.hasKey ? `Active since ${fmt(status.createdAt)}` : "Not set up"}</p>
        </div>
        <div className="px-4 py-3 rounded-xl border border-border/50 bg-background">
          <p className="text-muted-foreground">Last sync</p>
          <p className="font-semibold mt-0.5">{fmt(status?.lastSyncAt ?? null)}</p>
        </div>
      </div>

      {newKey && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold">Copy this key now. It won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-[11px] px-3 py-2 rounded-lg bg-background border border-border/50"
              style={{ fontFamily: "'DM Mono', monospace" }}>{newKey}</code>
            <button type="button" className={`${btn} border border-border hover:bg-muted`}
              onClick={() => navigator.clipboard.writeText(newKey).then(() => toast({ title: "Key copied" }))}>
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Put it in your scheduled sync. Making a new key stops the old one working.</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <motion.button type="button" onClick={() => create.mutate()} disabled={create.isPending}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className={btn} style={{ background: "hsl(38,92%,50%)", color: "hsl(228,25%,9%)" }}>
          <KeyRound className="w-3.5 h-3.5" />
          {create.isPending ? "Creating..." : status?.hasKey ? "Replace key" : "Create sync key"}
        </motion.button>
        {status?.hasKey && (
          <button type="button" onClick={() => revoke.mutate()} disabled={revoke.isPending}
            className={`${btn} border border-border hover:bg-muted text-destructive`}>
            <Trash2 className="w-3.5 h-3.5" /> {revoke.isPending ? "Revoking..." : "Revoke"}
          </button>
        )}
      </div>
    </div>
  );
}
