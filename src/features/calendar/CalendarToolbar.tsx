import { FileDown, LogOut, Plus, Trash2, Upload } from "lucide-react";
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
  onDeleteSemester: () => void;
  onImportStudents: () => void;
  onAddScheduleEntry: () => void;
  onExportAttendance: () => void;
  onLogout: () => void;
}

export function CalendarToolbar({
  semesters,
  selectedSemesterId,
  onSemesterChange,
  activeWeekDisplay,
  onCreateSemester,
  onDeleteSemester,
  onImportStudents,
  onAddScheduleEntry,
  onExportAttendance,
  onLogout,
}: CalendarToolbarProps) {
  const selectedSemester = semesters.find((s) => s.id === selectedSemesterId);

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-border-custom px-4 py-3">
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

        <Button
          variant="outline"
          size="icon-sm"
          onClick={onDeleteSemester}
          disabled={selectedSemesterId === null}
          aria-label="Odstrániť semester"
          title="Odstrániť semester"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Center section */}
      <div className="min-w-0">
        <h1 className="truncate font-heading text-xl font-medium text-text">
          {activeWeekDisplay}
        </h1>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onImportStudents}>
          <Upload className="mr-1 h-4 w-4" />
          Import študentov
        </Button>

        {selectedSemesterId !== null && (
          <Button variant="outline" size="sm" onClick={onExportAttendance}>
            <FileDown className="mr-1 h-4 w-4" />
            Export dochádzky
          </Button>
        )}

        <Button size="sm" onClick={onAddScheduleEntry}>
          <Plus className="mr-1 h-4 w-4" />
          Pridať rozvrh. jednotka
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onLogout}
          aria-label="Odhlásiť sa"
          title="Odhlásiť sa"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
