import { useState } from "react";
import type { components } from "@/api/schema";
import { downloadAttendanceExport } from "@/api/attendance";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type SubjectResponse = components["schemas"]["SubjectResponse"];

interface AttendanceExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: SubjectResponse[];
  semesterId: number | null;
  defaultSubjectId: number | null;
}

export function AttendanceExportDialog({
  open,
  onOpenChange,
  subjects,
  semesterId,
  defaultSubjectId,
}: AttendanceExportDialogProps) {
  const initialSubjectId = defaultSubjectId ?? subjects[0]?.id ?? null;
  const [subjectId, setSubjectId] = useState(
    initialSubjectId === null ? "" : String(initialSubjectId),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    if (semesterId === null || !subjectId) return;
    setSubmitting(true);
    setError("");
    try {
      await downloadAttendanceExport(Number(subjectId), semesterId, "csv");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export zlyhal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Export dochádzky</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Predmet</Label>
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-[#d5d7da] bg-white px-3 text-sm text-[#404040] outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option value="">Vyberte predmet</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={String(subject.id)}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Formát</Label>
            <div className="flex h-10 items-center rounded-lg border border-[#d5d7da] bg-[#fafafa] px-3 text-sm text-[#404040]">
              CSV
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Zrušiť
          </Button>
          <Button
            onClick={handleExport}
            disabled={!subjectId || semesterId === null || submitting}
          >
            {submitting ? "Exportovanie..." : "Exportovať CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
