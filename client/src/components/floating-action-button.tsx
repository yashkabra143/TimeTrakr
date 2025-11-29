import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EntryForm } from "@/components/entry-form";
import { useState } from "react";

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="fixed bottom-6 right-6 z-40 hidden sm:block">
          <Button
            size="lg"
            className="btn-success-gradient h-16 w-16 rounded-full shadow-lg hover:shadow-xl group pulse-glow"
            onClick={() => setOpen(true)}
            title="Log hours"
          >
            <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          </Button>
        </div>

        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Log Working Hours</DialogTitle>
            <DialogDescription>
              Add your working hours for today or any other date
            </DialogDescription>
          </DialogHeader>
          <EntryForm onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
