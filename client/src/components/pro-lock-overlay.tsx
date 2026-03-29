import { Lock } from "lucide-react";

interface ProLockOverlayProps {
  children: React.ReactNode;
  featureName?: string;
  onUpgradeClick?: () => void;
}

export function ProLockOverlay({ children, featureName = "This feature", onUpgradeClick }: ProLockOverlayProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[2px] opacity-60">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-[1px] rounded-2xl">
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-sm font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {featureName} requires Pro
          </p>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="px-4 py-2 rounded-xl bg-amber-500 text-amber-950 text-sm font-semibold hover:bg-amber-400 transition-colors"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Upgrade to Pro
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
