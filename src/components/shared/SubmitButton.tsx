"use client";

import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  pending,
  pendingLabel,
  children,
  disabled,
  ...props
}: {
  pending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "children">) {
  return (
    <Button type="submit" {...props} disabled={pending || disabled}>
      {pending && <Loader2Icon className="animate-spin" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
