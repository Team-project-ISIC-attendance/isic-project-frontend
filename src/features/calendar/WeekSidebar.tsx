import { useState } from "react";
import { Pencil } from "lucide-react";
import type { components } from "@/api/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type WeekResponse = components["schemas"]["WeekResponse"];

interface WeekSidebarProps {
  weeks: WeekResponse[];
  activeWeek: number;
  onWeekClick: (weekNumber: number) => void;
  onNoteUpdate: (weekNumber: number, note: string) => void;
}

function WeekNoteEditor({
  week,
  onSave,
}: {
  week: WeekResponse;
  onSave: (note: string) => void;
}) {
  const [noteValue, setNoteValue] = useState(week.note);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="shrink-0 rounded p-1 text-text-secondary hover:text-text"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-64">
        <div className="flex flex-col gap-2">
          <Input
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder="Poznámka..."
            className="text-sm"
          />
          <Button
            size="sm"
            onClick={() => {
              onSave(noteValue);
              setOpen(false);
            }}
          >
            Uložiť
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function WeekSidebar({
  weeks,
  activeWeek,
  onWeekClick,
  onNoteUpdate,
}: WeekSidebarProps) {
  return (
    <div className="flex w-52 shrink-0 flex-col border-r border-border-custom">
      <div className="px-4 py-3 font-heading text-sm font-medium text-text">
        Týždne
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {weeks.map((week) => {
            const isActive = week.week_number === activeWeek;
            return (
              <div
                key={week.week_number}
                className={`flex cursor-pointer items-center justify-between border-l-4 px-4 py-2.5 transition-colors hover:bg-bg-secondary ${
                  isActive
                    ? "border-l-blue-600 bg-blue-50"
                    : "border-l-transparent"
                }`}
                onClick={() => onWeekClick(week.week_number)}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-heading text-sm ${
                      isActive ? "font-bold text-text" : "font-medium text-text"
                    }`}
                  >
                    Týždeň {week.week_number}
                  </div>
                  <div className="truncate font-body text-xs text-text-secondary">
                    {week.note || "Poznámka"}
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <WeekNoteEditor
                    week={week}
                    onSave={(note) => onNoteUpdate(week.week_number, note)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
