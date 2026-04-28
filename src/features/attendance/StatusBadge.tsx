import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const STATUS_CONFIG = {
  pritomny: {
    label: "Prítomný",
    bg: "rgba(194, 238, 204, 0.5)",
    text: "#03781D",
  },
  nepritomny: {
    label: "Neprítomný",
    bg: "#FEE1E1",
    text: "#BA1717",
  },
  nahrada: {
    label: "Náhrada",
    bg: "rgba(249, 236, 170, 0.5)",
    text: "#E9C400",
  },
  ospravedlneny: {
    label: "Ospravedlnený",
    bg: "#dbeafe",
    text: "#2563eb",
  },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

interface StatusBadgeProps {
  status: string;
  onStatusChange: (status: string) => void;
}

function BadgeContent({ statusKey }: { statusKey: StatusKey }) {
  const config = STATUS_CONFIG[statusKey];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[5px] px-2 py-1 font-heading text-xs font-medium"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}

export function StatusBadge({ status, onStatusChange }: StatusBadgeProps) {
  const currentKey = (status in STATUS_CONFIG ? status : "nepritomny") as StatusKey;
  const config = STATUS_CONFIG[currentKey];

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex cursor-pointer items-center gap-1 rounded-[5px] border-none px-2 py-1 font-heading text-xs font-medium outline-none"
          style={{ backgroundColor: config.bg, color: config.text }}
        >
          {config.label}
          <ChevronDown size={12} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((key) => (
            <DropdownMenuItem
              key={key}
              onSelect={() => onStatusChange(key)}
              className="cursor-pointer px-2 py-1.5"
            >
              <BadgeContent statusKey={key} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
