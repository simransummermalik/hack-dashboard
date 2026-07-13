"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

interface ConfirmButtonProps extends ButtonProps {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
  successMessage?: string;
}

export function ConfirmButton({
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  successMessage,
  children,
  ...buttonProps
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleConfirm() {
    startTransition(async () => {
      const result = await onConfirm();
      if (result.ok) {
        setOpen(false);
        if (successMessage) toast({ title: successMessage });
      } else {
        toast({ title: "Action failed", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button {...buttonProps}>{children}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
