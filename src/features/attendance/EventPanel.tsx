import { useEffect, useState } from "react";
import { X, Pencil, Upload, Search, SlidersHorizontal, Maximize2 } from "lucide-react";
import type { components } from "@/api/schema";
import {
  updateAttendanceStatus,
  downloadStudentsExport,
  deleteEnrollment,
} from "@/api/attendance";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StudentCard } from "./StudentCard";
import { useLiveAttendance } from "./useLiveAttendance";
import { MoveStudentModal } from "./MoveStudentModal";

type AttendanceResponse = components["schemas"]["AttendanceResponse"];
type AttendanceSummary = components["schemas"]["AttendanceSummary"];
type AttendanceStudentEntry = components["schemas"]["AttendanceStudentEntry"];

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
  semesterId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMaximize?: () => void;
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
  let ospravedlneny = 0;
  for (const s of students) {
    if (s.status === "pritomny") pritomny++;
    else if (s.status === "nepritomny") nepritomny++;
    else if (s.status === "nahrada") nahrada++;
    else if (s.status === "ospravedlneny") ospravedlneny++;
  }
  return { total: students.length, pritomny, nepritomny, nahrada, ospravedlneny };
}

export function EventPanel({
  lessonId,
  subjectId,
  semesterId,
  open,
  onOpenChange,
  onMaximize,
}: EventPanelProps) {
  const { data, loading, changedIds } = useLiveAttendance(lessonId, open);
  const [optimistic, setOptimistic] = useState<Map<number, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [moveStudent, setMoveStudent] = useState<AttendanceStudentEntry | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);

  // Clear optimistic map and search when lesson changes
  useEffect(() => {
    async function reset() {
      setOptimistic(new Map());
      setSearchQuery("");
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

  // Filter by search query
  const filteredStudents = searchQuery
    ? mergedStudents.filter((s) => {
        const fullName = `${s.first_name ?? ""} ${s.last_name ?? ""}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
      })
    : mergedStudents;

  function handleExport() {
    if (subjectId !== null) {
      downloadStudentsExport(subjectId, "csv");
    }
  }

  function handleMove(student: AttendanceStudentEntry) {
    setMoveStudent(student);
    setMoveModalOpen(true);
  }

  function handleRemove(student: AttendanceStudentEntry) {
    if (subjectId === null) return;
    if (!confirm(`Naozaj chcete odstrániť študenta ${student.first_name} ${student.last_name}?`)) return;

    // Find enrollment_id from student data — use attendance_id as a workaround
    // The delete endpoint uses enrollment_id, but we have isic_id
    // Use the student's enrollment_id if available
    const enrollmentId = (student as Record<string, unknown>).enrollment_id as number | undefined;
    if (enrollmentId === undefined) {
      alert("Nie je možné odstrániť študenta — chýba enrollment ID.");
      return;
    }

    deleteEnrollment(subjectId, enrollmentId).catch(() => {
      alert("Nepodarilo sa odstrániť študenta.");
    });
  }

  function handleMoved() {
    setMoveModalOpen(false);
    setMoveStudent(null);
  }

  const lesson = data?.lesson;
  const students = filteredStudents;
  const summary = mergedStudents.length > 0
    ? recalcSummary(mergedStudents)
    : { total: 0, pritomny: 0, nepritomny: 0, nahrada: 0, ospravedlneny: 0 };
  const typeConfig = lesson
    ? LESSON_TYPE_CONFIG[lesson.lesson_type] ?? LESSON_TYPE_CONFIG.cvicenie
    : LESSON_TYPE_CONFIG.cvicenie;

  return (
    <>
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
                      className="inline-flex w-fit items-center rounded-full bg-[#f5f5f5] px-2 py-1 font-heading text-xs font-medium text-[#404040]"
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
                  <button className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#d4d4d4] bg-white font-heading text-sm font-medium text-black shadow-xs hover:bg-gray-50">
                    <Pencil size={16} />
                    Zmena udalosti
                  </button>
                  <button
                    onClick={handleExport}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#d4d4d4] bg-white font-heading text-sm font-medium text-black shadow-xs hover:bg-gray-50"
                  >
                    <Upload size={16} />
                    Export študentov
                  </button>
                </div>

                {/* Search Input */}
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#d4d4d4] bg-white px-3 py-2">
                  <Search size={16} className="shrink-0 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Vyhľadať študenta"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                  />
                </div>

                {/* Student List Header */}
                <div className="mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm font-medium">
                      Študenti
                    </span>
                    <span className="inline-flex items-center justify-center rounded-full border border-[rgba(229,229,229,0.9)] bg-[#f9f5ff] px-2 py-0.5 text-xs font-medium text-[#6941c6]">
                      {summary.total}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="relative rounded-md p-1 text-gray-400 hover:text-gray-600">
                      <SlidersHorizontal size={16} />
                      <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#6941c6] text-[10px] font-medium text-white">
                        1
                      </span>
                    </button>
                    <button
                      onClick={onMaximize}
                      className="rounded-md p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>
                </div>

                {/* "Meno" Column Header */}
                <div className="mt-3 border-b border-[rgba(229,229,229,0.9)] px-[24px] pb-2">
                  <span className="font-body text-xs font-semibold text-[#525252]">
                    Meno
                  </span>
                </div>

                {/* Student Cards */}
                <ScrollArea className="flex-1">
                  <div className="flex flex-col">
                    {students.map((student, index) => (
                      <StudentCard
                        key={student.attendance_id}
                        student={student}
                        onStatusChange={handleStatusChange}
                        onMove={handleMove}
                        onRemove={handleRemove}
                        index={index}
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

      {moveStudent && lesson && (
        <MoveStudentModal
          open={moveModalOpen}
          onOpenChange={setMoveModalOpen}
          student={moveStudent}
          attendanceId={moveStudent.attendance_id}
          subjectId={subjectId}
          semesterId={semesterId}
          lessonInfo={{
            dayOfWeek: lesson.day_of_week,
            startTime: lesson.start_time,
            endTime: lesson.end_time,
          }}
          onMoved={handleMoved}
        />
      )}
    </>
  );
}
