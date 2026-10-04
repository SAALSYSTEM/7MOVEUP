import type { ReactNode } from "react";

import { useApp } from "@/app/app-context";

import { Button } from "./button";
import { Sheet } from "./sheet";

type ConfirmSheetProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  destructive?: boolean;
  children?: ReactNode;
};

export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  destructive,
  children,
}: ConfirmSheetProps) {
  const { t } = useApp();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children}
    </Sheet>
  );
}
