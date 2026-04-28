import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "all", label: "Všetci" },
  { value: "pritomny", label: "Prítomný" },
  { value: "nepritomny", label: "Neprítomný" },
  { value: "nahrada", label: "Náhrada" },
  { value: "ospravedlneny", label: "Ospravedlnený" },
];

interface FilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilter: (status: string | null) => void;
  currentFilter: string | null;
}

export function FilterModal({
  open,
  onOpenChange,
  onFilter,
  currentFilter,
}: FilterModalProps) {
  const [selected, setSelected] = useState<string>(currentFilter ?? "all");

  const handleConfirm = () => {
    onFilter(selected === "all" ? null : selected);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="w-[400px] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Filter</h2>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1 hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prítomnosť
            </label>
            <Select value={selected} onValueChange={(v) => { if (v !== null) setSelected(v); }}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {STATUS_OPTIONS.find((o) => o.value === selected)?.label ??
                    "Všetci"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Zrušiť
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1D4ED8] rounded-lg hover:bg-[#1e40af]"
            >
              Potvrdiť
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
