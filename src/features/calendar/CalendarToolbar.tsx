import { Cpu, FileDown, LogOut, Plus, Trash2, Upload } from "lucide-react";
import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";
import { ConfirmationPopover } from "@/components/ui/confirmation-popover";
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
  deleteSemesterConfirmOpen: boolean;
  onDeleteSemesterConfirmOpenChange: (open: boolean) => void;
  onConfirmDeleteSemester: () => void;
  isDeletingSemester: boolean;
  onImportStudents: () => void;
  onAddScheduleEntry: () => void;
  onExportAttendance: () => void;
  onManageDevices: () => void;
  onLogout: () => void;
}

export function CalendarToolbar({
  semesters,
  selectedSemesterId,
  onSemesterChange,
  activeWeekDisplay,
  onCreateSemester,
  deleteSemesterConfirmOpen,
  onDeleteSemesterConfirmOpenChange,
  onConfirmDeleteSemester,
  isDeletingSemester,
  onImportStudents,
  onAddScheduleEntry,
  onExportAttendance,
  onManageDevices,
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

        <ConfirmationPopover
          open={deleteSemesterConfirmOpen}
          onOpenChange={onDeleteSemesterConfirmOpenChange}
          title="Odstrániť semester"
          description={
            <>
              Naozaj chcete odstrániť semester{" "}
              <strong>{selectedSemester?.name ?? "vybraný semester"}</strong>?
              Táto akcia sa nedá vrátiť späť.
            </>
          }
          confirmLabel="Odstrániť"
          confirmingLabel="Odstraňovanie..."
          onConfirm={onConfirmDeleteSemester}
          isConfirming={isDeletingSemester}
          trigger={<Button variant="outline" size="sm" aria-label="Odstrániť semester" title="Odstrániť semester" />}
          triggerDisabled={selectedSemesterId === null}
          triggerContent={
            <>
              <Trash2 className="mr-1 h-4 w-4" />
              Odstrániť semester
            </>
          }
          align="start"
        />
      </div>

      {/* Center section */}
      <div className="min-w-0">
        <h1 className="truncate font-heading text-xl font-medium text-text">
          {activeWeekDisplay}
        </h1>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {selectedSemesterId !== null && (
          <Button variant="outline" size="sm" onClick={onExportAttendance}>
            <FileDown className="mr-1 h-4 w-4" />
            Export dochádzky
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onImportStudents}
          disabled={selectedSemesterId === null}
        >
          <Upload className="mr-1 h-4 w-4" />
          Import študentov
        </Button>

        <Button
          size="sm"
          onClick={onAddScheduleEntry}
          disabled={selectedSemesterId === null}
        >
          <Plus className="mr-1 h-4 w-4" />
          Pridať rozvrh. jednotka
        </Button>

        <Button variant="outline" size="sm" onClick={onManageDevices}>
          <Cpu className="mr-1 h-4 w-4" />
          Zariadenia
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
