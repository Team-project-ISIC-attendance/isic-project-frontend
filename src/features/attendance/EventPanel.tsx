import { useEffect, useState } from "react";
import { X, Pencil, Upload, List, LayoutGrid } from "lucide-react";
import type { components } from "@/api/schema";
import {
  updateAttendanceStatus,
  downloadStudentsExport,
} from "@/api/attendance";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StudentCard } from "./StudentCard";
import { useLiveAttendance } from "./useLiveAttendance";

type AttendanceResponse = components["schemas"]["AttendanceResponse"];
type AttendanceSummary = components["schemas"]["AttendanceSummary"];

const LESSON_TYPE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  cvicenie: {
    label: "Cvičenie",
    bg: "rgba(194, 238, 204, 0.5)",
    text: "#03781D",
  },
  prednaska: {
    label: "Prednáška",
    bg: "rgba(194, 206, 238, 0.5)",
    text: "#1D3078",
  },
  laboratorium: {
    label: "Laboratórium",
    bg: "rgba(249, 224, 170, 0.5)",
    text: "#E9A100",
  },
};

interface EventPanelProps {
  lessonId: number | null;
  subjectId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(dateStr: string, dayOfWeek: number): string {
  const dayNames = [
    "Pondelok",
    "Utorok",
    "Streda",
    "Štvrtok",
    "Piatok",
    "Sobota",
    "Nedeľa",
  ];
  const dayName = dayNames[dayOfWeek] ?? "";
  const date = new Date(dateStr);
  const day = date.getDate();
  const months = [
    "Január",
    "Február",
    "Marec",
    "Apríl",
    "Máj",
    "Jún",
    "Júl",
    "August",
    "September",
    "Október",
    "November",
    "December",
  ];
  const month = months[date.getMonth()];
  return `${dayName}, ${day}. ${month}`;
}

function formatTimeRange(start: string, end: string): string {
  return `${start} - ${end}`;
}

function recalcSummary(
  students: AttendanceResponse["students"],
): AttendanceSummary {
  let pritomny = 0;
  let nepritomny = 0;
  let nahrada = 0;
  for (const s of students) {
    if (s.status === "pritomny") pritomny++;
    else if (s.status === "nepritomny") nepritomny++;
    else if (s.status === "nahrada") nahrada++;
  }
  return { total: students.length, pritomny, nepritomny, nahrada };
}

export function EventPanel({
  lessonId,
  subjectId,
  open,
  onOpenChange,
}: EventPanelProps) {
  const { data, loading, changedIds } = useLiveAttendance(lessonId, open);
  const [activeView, setActiveView] = useState<"list" | "grid">("list");
  const [optimistic, setOptimistic] = useState<Map<number, string>>(new Map());

  // Clear optimistic map when lesson changes
  useEffect(() => {
    async function reset() {
      setOptimistic(new Map());
    }
    reset();
  }, [lessonId]);

  function handleStatusChange(attendanceId: number, newStatus: string) {
    setOptimistic((prev) => new Map(prev).set(attendanceId, newStatus));

    updateAttendanceStatus(attendanceId, newStatus).catch(() => {
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.delete(attendanceId);
        return next;
      });
    });
  }

  // Merge polled data with optimistic updates
  const rawStudents = data?.students ?? [];
  const mergedStudents = rawStudents.map((s) => {
    const opt = optimistic.get(s.attendance_id);
    if (opt !== undefined && opt !== s.status) {
      return { ...s, status: opt };
    }
    return s;
  });

  function handleExport() {
    if (subjectId !== null) {
      downloadStudentsExport(subjectId, "csv");
    }
  }

  const lesson = data?.lesson;
  const students = mergedStudents;
  const summary = students.length > 0
    ? recalcSummary(students)
    : { total: 0, pritomny: 0, nepritomny: 0, nahrada: 0 };
  const typeConfig = lesson
    ? LESSON_TYPE_CONFIG[lesson.lesson_type] ?? LESSON_TYPE_CONFIG.cvicenie
    : LESSON_TYPE_CONFIG.cvicenie;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[558px] max-w-full overflow-hidden rounded-l-xl border-[0.5px] border-border-custom bg-white p-0"
      >
        {/* Visually hidden title for accessibility */}
        <SheetTitle className="sr-only">Detaily udalosti</SheetTitle>

        <div className="flex h-full flex-col p-5">
          {/* Close button */}
          <div className="flex justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-text-secondary">Načítavanie...</p>
            </div>
          ) : lesson ? (
            <>
              {/* Lesson Header */}
              <div className="mt-2 flex gap-3">
                <div
                  className="w-1 shrink-0 self-stretch rounded-full"
                  style={{ backgroundColor: lesson.subject_color }}
                />
                <div className="flex flex-col gap-1.5">
                  <span
                    className="inline-flex w-fit items-center rounded-[5px] px-2 py-1 font-heading text-xs font-medium"
                    style={{
                      backgroundColor: typeConfig.bg,
                      color: typeConfig.text,
                    }}
                  >
                    {typeConfig.label}
                  </span>
                  <h2 className="font-heading text-lg font-medium text-[#333]">
                    {lesson.subject_name}
                  </h2>
                  <p className="flex items-center gap-1.5 font-body text-xs font-medium text-[#7C7C7C]">
                    {formatDate(lesson.date, lesson.day_of_week)}
                    <span className="inline-block size-[3px] rounded-full bg-[#7C7C7C]" />
                    {formatTimeRange(lesson.start_time, lesson.end_time)}
                    <span className="inline-block size-[3px] rounded-full bg-[#7C7C7C]" />
                    {lesson.recurrence}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex gap-3">
                <button className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#F5F5F5] font-heading text-sm font-medium text-black hover:bg-gray-200">
                  <Pencil size={16} />
                  Zmena udalosti
                </button>
                <button
                  onClick={handleExport}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#F5F5F5] font-heading text-sm font-medium text-black hover:bg-gray-200"
                >
                  <Upload size={16} />
                  Export študentov
                </button>
              </div>

              {/* Student List Header */}
              <div className="mt-5 flex items-center justify-between">
                <span className="font-heading text-sm font-medium">
                  Študenti ({summary.total})
                </span>
                <div className="flex rounded-[5px] bg-[#F5F5F5] p-[3px]">
                  <button
                    onClick={() => setActiveView("list")}
                    className={`rounded-[3px] p-1 ${activeView === "list" ? "bg-white shadow-sm" : ""}`}
                  >
                    <List size={14} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => setActiveView("grid")}
                    className={`rounded-[3px] p-1 ${activeView === "grid" ? "bg-white shadow-sm" : ""}`}
                  >
                    <LayoutGrid size={14} className="text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Student Cards */}
              <ScrollArea className="mt-3 flex-1">
                <div className="flex flex-col gap-2.5">
                  {students.map((student) => (
                    <StudentCard
                      key={student.attendance_id}
                      student={student}
                      onStatusChange={handleStatusChange}
                      justScanned={changedIds.has(student.attendance_id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
