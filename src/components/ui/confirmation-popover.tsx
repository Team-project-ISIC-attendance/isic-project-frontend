import type { ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ConfirmationPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmingLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isConfirming?: boolean;
  trigger: ReactElement;
  triggerContent: ReactNode;
  triggerNativeButton?: boolean;
  triggerDisabled?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  contentClassName?: string;
}

export function ConfirmationPopover({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmingLabel,
  cancelLabel = "Zrušiť",
  onConfirm,
  isConfirming = false,
  trigger,
  triggerContent,
  triggerNativeButton = true,
  triggerDisabled = false,
  side = "bottom",
  align = "center",
  sideOffset = 8,
  contentClassName,
}: ConfirmationPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={trigger}
        nativeButton={triggerNativeButton}
        disabled={triggerDisabled}
      >
        {triggerContent}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn("w-80 p-3", contentClassName)}
      >
        <PopoverHeader className="gap-1.5">
          <PopoverTitle className="text-base leading-none font-medium">
            {title}
          </PopoverTitle>
          <PopoverDescription className="text-sm leading-5">
            {description}
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isConfirming}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {isConfirming ? (confirmingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
