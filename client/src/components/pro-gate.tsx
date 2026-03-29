import { useState } from "react";
import { useIsPro } from "@/lib/hooks";
import { UpgradeModal } from "./upgrade-modal";
import { ProLockOverlay } from "./pro-lock-overlay";

interface ProGateProps {
  children: React.ReactNode;
  mode?: "modal" | "blur";
  featureName?: string;
}

export function ProGate({ children, mode = "modal", featureName }: ProGateProps) {
  const isPro = useIsPro();
  const [showModal, setShowModal] = useState(false);

  if (isPro) return <>{children}</>;

  if (mode === "blur") {
    return (
      <>
        <ProLockOverlay featureName={featureName} onUpgradeClick={() => setShowModal(true)}>
          {children}
        </ProLockOverlay>
        <UpgradeModal open={showModal} onOpenChange={setShowModal} featureName={featureName} />
      </>
    );
  }

  // mode === "modal"
  return (
    <>
      <div onClick={() => setShowModal(true)} className="cursor-pointer">
        {children}
      </div>
      <UpgradeModal open={showModal} onOpenChange={setShowModal} featureName={featureName} />
    </>
  );
}
