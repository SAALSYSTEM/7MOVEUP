import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-black hover:bg-accent-light active:bg-accent font-extrabold",
  secondary: "bg-elevated text-fg border border-line hover:bg-[#222226] font-semibold",
  ghost: "text-muted hover:text-fg hover:bg-white/5 font-semibold",
  outline: "border border-line text-fg hover:bg-white/5 font-semibold",
  danger: "bg-danger/12 text-danger border border-danger/30 hover:bg-danger/20 font-semibold",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-3.5 text-sm rounded-xl gap-1.5",
  md: "h-12 px-4 text-sm rounded-2xl gap-2",
  lg: "min-h-14 px-5 text-base rounded-2xl gap-2",
  icon: "h-11 w-11 rounded-full",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap transition-[background-color,color,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
