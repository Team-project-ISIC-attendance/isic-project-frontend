import { useEffect, useState } from "react";
import { ArrowRightLeft, X, Clock, ArrowDownUp } from "lucide-react";
import type { components } from "@/api/schema";
import { fetchSchedule } from "@/api/calendar";
import { moveAttendance, fetchScheduleEntryLessons } from "@/api/attendance";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

type AttendanceStudentEntry = components["schemas"]["AttendanceStudentEntry"];
type ScheduleEntryResponse = components["schemas"]["ScheduleEntryResponse"];
type LessonResponse = components["schemas"]["LessonResponse"];

const DAY_NAMES: Record<number, string> = {
  0: "Pondelok",
  1: "Utorok",
  2: "Streda",
  3: "Štvrtok",
  4: "Piatok",
  5: "Sobota",
  6: "Nedeľa",
};

interface MoveStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: AttendanceStudentEntry;
  attendanceId: number;
  subjectId: number | null;
  semesterId: number | null;
  lessonInfo: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  };
  onMoved: () => void;
}

interface TargetOption {
  lessonId: number;
  label: string;
  entryId: number;
  date: string;
}

export function MoveStudentModal({
  open,
  onOpenChange,
  student,
  attendanceId,
  subjectId,
  semesterId,
  lessonInfo,
  onMoved,
}: MoveStudentModalProps) {
  const [targetOptions, setTargetOptions] = useState<TargetOption[]>([]);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Fetch target lesson options on open
  useEffect(() => {
    if (!open || semesterId === null || subjectId === null) return;

    let cancelled = false;

    async function loadOptions() {
      setLoadingOptions(true);
      setError("");
      setSelectedTarget("");

      try {
        // Get all schedule entries for the semester
        const entries = await fetchSchedule(semesterId!);

        // Filter to entries of the same subject
        const sameSubjectEntries = entries.filter(
          (e: ScheduleEntryResponse) => e.subject_id === subjectId,
        );

        // Fetch lessons for each entry
        const allOptions: TargetOption[] = [];
        for (const entry of sameSubjectEntries) {
          const lessons: LessonResponse[] = await fetchScheduleEntryLessons(
            semesterId!,
            entry.id,
          );
          for (const lesson of lessons) {
            if (!lesson.cancelled) {
              const dayName = DAY_NAMES[entry.day_of_week] ?? "";
              allOptions.push({
                lessonId: lesson.id,
                label: `${dayName}, ${entry.start_time} - ${entry.end_time} (${lesson.date})`,
                entryId: entry.id,
                date: lesson.date,
              });
            }
          }
        }

        if (!cancelled) {
          setTargetOptions(allOptions);
          setLoadingOptions(false);
        }
      } catch {
        if (!cancelled) {
          setError("Nepodarilo sa načítať možnosti presunu.");
          setLoadingOptions(false);
        }
      }
    }

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, [open, semesterId, subjectId]);

  async function handleSubmit() {
    if (!selectedTarget) return;

    setSubmitting(true);
    setError("");

    try {
      await moveAttendance(attendanceId, Number(selectedTarget));
      onOpenChange(false);
      onMoved();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nepodarilo sa presunúť študenta.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (!submitting) {
      onOpenChange(false);
    }
  }

  const initials =
    (student.first_name?.[0] ?? "") + (student.last_name?.[0] ?? "");
  const fullName = [student.first_name, student.last_name]
    .filter(Boolean)
    .join(" ");
  const currentSlot = `${DAY_NAMES[lessonInfo.dayOfWeek] ?? ""}, ${lessonInfo.startTime} - ${lessonInfo.endTime}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[400px] rounded-[16px] border-none p-0 shadow-xl [&>button]:hidden">
        <div className="p-6">
          {/* Featured Icon */}
          <div className="flex items-start justify-between">
            <div className="flex size-12 items-center justify-center rounded-full border-[6px] border-[#f9f5ff] bg-[#f4ebff]">
              <ArrowRightLeft size={20} className="text-[#7c3aed]" />
            </div>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Title */}
          <h2 className="mt-4 font-body text-lg font-semibold text-[#171717]">
            Presunúť študenta
          </h2>
          <p className="mt-1 font-body text-sm text-[#525252]">
            Vyberte deň a čas, na ktorý chcete presunúť študenta.
          </p>

          {/* Student Row */}
          <div className="mt-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#dcfce7]">
              <span className="text-xs font-medium text-green-700">{initials}</span>
            </div>
            <span className="font-body text-sm font-semibold text-[#404040]">
              {fullName}
            </span>
          </div>

          {/* Current Slot */}
          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-lg border border-[#d4d4d4] bg-[#fafafa] px-3 py-2.5">
              <Clock size={16} className="shrink-0 text-gray-400" />
              <span className="text-sm text-[#525252]">{currentSlot}</span>
            </div>
          </div>

          {/* Swap Icon */}
          <div className="my-3 flex justify-center">
            <div className="flex size-8 items-center justify-center rounded-full bg-[#f5f5f5]">
              <ArrowDownUp size={16} className="text-gray-400" />
            </div>
          </div>

          {/* Target Slot Select */}
          <div>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              disabled={loadingOptions || submitting}
              className="w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2.5 text-sm text-[#171717] outline-none focus:border-[#1d4ed8] disabled:opacity-50"
            >
              <option value="">
                {loadingOptions ? "Načítavanie..." : "Nový deň a čas"}
              </option>
              {targetOptions.map((opt) => (
                <option key={opt.lessonId} value={String(opt.lessonId)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}

          {/* Footer */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={submitting}
              className="rounded-lg border border-[#d4d4d4] bg-white px-4 py-2.5 text-sm font-medium text-[#404040] hover:bg-gray-50 disabled:opacity-50"
            >
              Zrušiť
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedTarget || submitting}
              className="rounded-lg bg-[#1d4ed8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e40af] disabled:opacity-50"
            >
              {submitting ? "Presúvanie..." : "Potvrdiť"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
