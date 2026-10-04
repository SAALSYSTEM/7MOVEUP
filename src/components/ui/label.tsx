import type { LabelHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted", className)} {...props} />;
}

export function FieldHint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-2 text-xs leading-relaxed text-subtle", className)}>{children}</p>;
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 text-xs font-medium text-danger">
      {children}
    </p>
  );
}
