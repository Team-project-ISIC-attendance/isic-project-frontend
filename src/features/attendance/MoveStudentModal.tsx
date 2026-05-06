import { useEffect, useState } from "react";
import { ArrowRightLeft, X, Clock, ArrowDownUp } from "lucide-react";
import type { components } from "@/api/schema";
import { fetchSchedule } from "@/api/calendar";
import { moveAttendance, fetchScheduleEntryLessons } from "@/api/attendance";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  getStudentAdditionalInfo,
  getStudentAvatarLabel,
  getStudentDisplayId,
  type StudentLike,
} from "./studentDisplay";

type ScheduleEntryResponse = components["schemas"]["ScheduleEntryResponse"];
type LessonResponse = components["schemas"]["LessonResponse"];

const DAY_NAMES: Record<number, string> = {
  1: "Pondelok",
  2: "Utorok",
  3: "Streda",
  4: "Štvrtok",
  5: "Piatok",
  6: "Sobota",
  7: "Nedeľa",
};

const LESSON_TYPE_LABELS: Record<string, string> = {
  cvicenie: "Cvičenie",
  prednaska: "Prednáška",
  laboratorium: "Laboratórium",
};

interface MoveStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentLike;
  attendanceId: number;
  currentLessonId: number;
  currentEntryId: number | null;
  subjectName: string;
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
  currentLessonId,
  currentEntryId,
  subjectName,
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

        const normalizedSubjectName = subjectName.trim().toLowerCase();
        const sameNamedEntries = entries.filter(
          (e: ScheduleEntryResponse) =>
            e.subject_name.trim().toLowerCase() === normalizedSubjectName &&
            e.id !== currentEntryId,
        );

        // Fetch lessons for each entry
        const allOptions: TargetOption[] = [];
        for (const entry of sameNamedEntries) {
          const lessons: LessonResponse[] = await fetchScheduleEntryLessons(
            semesterId!,
            entry.id,
          );
          for (const lesson of lessons) {
            if (!lesson.cancelled && lesson.id !== currentLessonId) {
              const dayName = DAY_NAMES[entry.day_of_week] ?? "";
              const lessonType =
                LESSON_TYPE_LABELS[entry.lesson_type] ?? entry.lesson_type;
              allOptions.push({
                lessonId: lesson.id,
                label:
                  `${entry.subject_name} · ${lessonType} · ${dayName}, ` +
                  `${entry.start_time} - ${entry.end_time}` +
                  `${entry.room ? ` · ${entry.room}` : ""} · ${lesson.date}`,
                entryId: entry.id,
                date: lesson.date,
              });
            }
          }
        }

        if (!cancelled) {
          setTargetOptions(
            allOptions.sort((left, right) => left.label.localeCompare(right.label)),
          );
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
  }, [open, semesterId, subjectId, currentLessonId, currentEntryId, subjectName]);

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

  const displayId = getStudentDisplayId(student);
  const additionalInfo = getStudentAdditionalInfo(student);
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
            Vyberte konkrétnu rozvrhovú jednotku, na ktorú chcete študenta presunúť.
          </p>

          {/* Student Row */}
          <div className="mt-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#dcfce7]">
              <span className="text-xs font-medium text-green-700">
                {getStudentAvatarLabel(student)}
              </span>
            </div>
            <div className="min-w-0" title={additionalInfo.join("\n")}>
              <span className="block truncate font-body text-sm font-semibold text-[#404040]">
                {displayId}
              </span>
              {additionalInfo[0] && (
                <span className="block truncate text-xs text-[#737373]">
                  {additionalInfo[0]}
                </span>
              )}
            </div>
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
