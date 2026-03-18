import { Menu, Plus, Upload } from "lucide-react";
import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SemesterResponse = components["schemas"]["SemesterResponse"];

interface CalendarToolbarProps {
  semesters: SemesterResponse[];
  selectedSemesterId: number | null;
  onSemesterChange: (id: number) => void;
  activeWeekDisplay: string;
  onCreateSemester: () => void;
  onImportStudents: () => void;
  onAddScheduleEntry: () => void;
}

export function CalendarToolbar({
  semesters,
  selectedSemesterId,
  onSemesterChange,
  activeWeekDisplay,
  onCreateSemester,
  onImportStudents,
  onAddScheduleEntry,
}: CalendarToolbarProps) {
  const selectedSemester = semesters.find((s) => s.id === selectedSemesterId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-custom px-4 py-3">
      {/* Left section */}
      <div className="flex items-center gap-2">
        <Select
          value={selectedSemesterId !== null ? String(selectedSemesterId) : undefined}
          onValueChange={(val) => {
            if (val !== null) onSemesterChange(Number(val));
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Vyberte semester">
              {selectedSemester?.name ?? "Vyberte semester"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {semesters.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={onCreateSemester}>
          <Plus className="mr-1 h-4 w-4" />
          Pridať semester
        </Button>
      </div>

      {/* Center section */}
      <div className="flex items-center gap-3">
        <Menu className="h-5 w-5 text-text-secondary" />
        <h1 className="font-heading text-xl font-medium text-text">
          {activeWeekDisplay}
        </h1>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onImportStudents}>
          <Upload className="mr-1 h-4 w-4" />
          Import študentov
        </Button>

        <Button size="sm" onClick={onAddScheduleEntry}>
          <Plus className="mr-1 h-4 w-4" />
          Pridať rozvrh. jednotka
        </Button>
      </div>
    </div>
  );
}
