import { cn } from "@/lib/utils";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
};

export function Switch({ checked, onCheckedChange, id, disabled, ...aria }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border transition-colors disabled:opacity-40",
        checked ? "border-accent bg-accent" : "border-line bg-elevated",
      )}
      {...aria}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-6 w-6 rounded-full shadow transition-transform",
          checked ? "translate-x-[23px] bg-black" : "translate-x-[3px] bg-muted",
        )}
      />
    </button>
  );
}
