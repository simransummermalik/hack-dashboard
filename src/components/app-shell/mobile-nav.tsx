"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Sidebar } from "./sidebar";
import type { Role } from "@/lib/authorization";

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>
      <DialogContent className="left-0 top-0 h-full max-h-none w-64 max-w-[80vw] translate-x-0 translate-y-0 rounded-none border-r p-0 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left">
        <VisuallyHidden>
          <DialogTitle>Navigation menu</DialogTitle>
        </VisuallyHidden>
        <Sidebar role={role} className="w-full border-r-0" />
      </DialogContent>
    </Dialog>
  );
}
