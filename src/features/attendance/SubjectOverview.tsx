import { useEffect, useState } from "react";
import {
  X,
  Pencil,
  Upload,
  Search,
  SlidersHorizontal,
  Minimize2,
  ChevronDown,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import type { components } from "@/api/schema";
import {
  fetchScheduleEntryOverview,
  updateAttendanceStatus,
  downloadStudentsExport,
  deleteEnrollment,
} from "@/api/attendance";
import { deleteSubject } from "@/api/calendar";
import { ConfirmationPopover } from "@/components/ui/confirmation-popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterModal } from "./FilterModal";
import { MoveStudentModal } from "./MoveStudentModal";
import {
  getStudentAvatarLabel,
  getStudentDisplayId,
  getStudentMeta,
  matchesStudentQuery,
} from "./studentDisplay";

type OverviewResponse = components["schemas"]["OverviewResponse"];
type OverviewStudent = components["schemas"]["OverviewStudent"];

const LESSON_TYPE_CONFIG: Record<
  string,
  { label: string }
> = {
  cvicenie: { label: "Cvičenie" },
  prednaska: { label: "Prednáška" },
  laboratorium: { label: "Laboratórium" },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  pritomny: { label: "Prítomný", bg: "rgba(194, 238, 204, 0.5)", text: "#03781D" },
  nepritomny: { label: "Neprítomný", bg: "#FEE1E1", text: "#BA1717" },
  nahrada: { label: "Náhrada", bg: "rgba(249, 236, 170, 0.5)", text: "#E9C400" },
  ospravedlneny: { label: "Ospravedlnený", bg: "#dbeafe", text: "#2563eb" },
};

interface SubjectOverviewProps {
  subjectId: number;
  entryId: number;
  semesterId: number;
  onClose: () => void;
  onMinimize: () => void;
  onEdit?: () => void;
}

function StatusBadgeCell({
  status,
  attendanceId,
  isCancelled,
  onStatusChange,
}: {
  status: string | null;
  attendanceId: number | null;
  isCancelled: boolean;
  onStatusChange: (attendanceId: number, newStatus: string) => void;
}) {
  if (isCancelled || attendanceId === null || status === null) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.nepritomny;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex cursor-pointer items-center gap-1 rounded-[5px] border-none px-2 py-1 font-heading text-xs font-medium outline-none"
          style={{ backgroundColor: config.bg, color: config.text }}
        >
          {config.label}
          <ChevronDown size={12} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => onStatusChange(attendanceId, key)}
              className="cursor-pointer px-2 py-1.5"
            >
              <span
                className="inline-flex items-center gap-1 rounded-[5px] px-2 py-1 font-heading text-xs font-medium"
                style={{ backgroundColor: cfg.bg, color: cfg.text }}
              >
                {cfg.label}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function SubjectOverview({
  subjectId,
  entryId,
  semesterId,
  onClose,
  onMinimize,
  onEdit,
}: SubjectOverviewProps) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<Map<string, string>>(new Map());
  const [selectedStudent, setSelectedStudent] = useState<OverviewStudent | null>(null);
  const [deleteSubjectConfirmOpen, setDeleteSubjectConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [removeStudentTargetKey, setRemoveStudentTargetKey] = useState<string | null>(null);
  const [isRemovingStudent, setIsRemovingStudent] = useState(false);
  const [moveStudent, setMoveStudent] = useState<OverviewStudent | null>(null);
  const [moveStudentOpen, setMoveStudentOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await fetchScheduleEntryOverview(subjectId, entryId, semesterId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Načítanie zlyhalo");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subjectId, entryId, semesterId]);

  async function handleDeleteSubject() {
    try {
      setIsDeleting(true);
      await deleteSubject(subjectId);
      setDeleteSubjectConfirmOpen(false);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chyba pri mazaní";
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleStatusChange(attendanceId: number, newStatus: string) {
    const key = String(attendanceId);
    setOptimistic((prev) => new Map(prev).set(key, newStatus));

    updateAttendanceStatus(attendanceId, newStatus).catch(() => {
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    });
  }

  function handleExport() {
    downloadStudentsExport(subjectId, "csv");
  }

  function getRemoveStudentKey(student: OverviewStudent) {
    return student.enrollment_id !== null
      ? `enrollment-${student.enrollment_id}`
      : `isic-${student.isic_identifier}`;
  }

  async function handleRemoveStudent(student: OverviewStudent) {
    if (!student.enrollment_id) return;
    setIsRemovingStudent(true);
    try {
      await deleteEnrollment(subjectId, student.enrollment_id);
      setRemoveStudentTargetKey(null);
      if (
        selectedStudent !== null &&
        getRemoveStudentKey(selectedStudent) === getRemoveStudentKey(student)
      ) {
        setSelectedStudent(null);
      }
      const result = await fetchScheduleEntryOverview(subjectId, entryId, semesterId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba pri odstraňovaní");
    } finally {
      setIsRemovingStudent(false);
    }
  }

  function getMoveContext(student: OverviewStudent) {
    if (!data) return null;
    const weekOrder = [
      data.weeks.find((w) => w.is_current),
      ...data.weeks.filter((w) => !w.is_current),
    ].filter((w): w is NonNullable<typeof w> => w != null);
    for (const week of weekOrder) {
      if (week.lesson_id === null) continue;
      const sw = student.weeks.find((w) => w.week_number === week.week_number);
      if (sw?.attendance_id != null) {
        return { attendanceId: sw.attendance_id, lessonId: week.lesson_id };
      }
    }
    return null;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <p className="text-sm text-text-secondary">Načítavanie...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white">
        <p className="text-sm text-danger">{error}</p>
        <button
          onClick={onClose}
          className="rounded-lg border border-[#d4d4d4] bg-white px-4 py-2 text-sm font-medium text-black shadow-xs hover:bg-gray-50"
        >
          Zavrieť
        </button>
      </div>
    );
  }
  if (!data) return null;

  const entry = data.schedule_entry;
  const weeks = data.weeks;
  const typeConfig = LESSON_TYPE_CONFIG[entry.lesson_type] ?? LESSON_TYPE_CONFIG.cvicenie;

  // Apply optimistic updates to student data
  const studentsWithOptimistic: OverviewStudent[] = data.students.map((student) => ({
    ...student,
    weeks: student.weeks.map((sw) => {
      if (sw.attendance_id !== null) {
        const opt = optimistic.get(String(sw.attendance_id));
        if (opt !== undefined) {
          return { ...sw, status: opt };
        }
      }
      return sw;
    }),
  }));

  // Filter by search
  let filtered = studentsWithOptimistic;
  if (searchQuery) {
    filtered = filtered.filter((s) => matchesStudentQuery(s, searchQuery));
  }

  // Filter by status
  if (statusFilter) {
    filtered = filtered.filter((s) =>
      s.weeks.some((w) => w.status === statusFilter),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="shrink-0 px-8 pt-6 pb-4">
        <div className="flex items-start justify-between">
          {/* Left side: lesson info */}
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex w-fit items-center rounded-full bg-[#f5f5f5] px-2 py-1 font-heading text-xs font-medium text-[#404040]">
              {typeConfig.label}
            </span>
            <h1 className="font-heading text-lg font-medium text-[#333]">
              {entry.subject_name}
            </h1>
            <p className="flex items-center gap-1.5 font-body text-xs font-medium text-[#7C7C7C]">
              {entry.start_time} – {entry.end_time}
              <span className="inline-block size-[3px] rounded-full bg-[#7C7C7C]" />
              {entry.recurrence}
            </p>
          </div>

          {/* Right side: close + action buttons */}
          <div className="flex flex-col items-end gap-3">
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col gap-2">
              <button
                onClick={onEdit}
                className="flex h-9 w-[187px] items-center justify-center gap-2 rounded-lg border border-[#d4d4d4] bg-white font-heading text-sm font-medium text-black shadow-xs hover:bg-gray-50"
              >
                <Pencil size={14} />
                Zmena udalosti
              </button>
              <button
                onClick={handleExport}
                className="flex h-9 w-[187px] items-center justify-center gap-2 rounded-lg border border-[#d4d4d4] bg-white font-heading text-sm font-medium text-black shadow-xs hover:bg-gray-50"
              >
                <Upload size={14} />
                Export študentov
              </button>
              <ConfirmationPopover
                open={deleteSubjectConfirmOpen}
                onOpenChange={setDeleteSubjectConfirmOpen}
                title="Potvrdiť zmazanie predmetu"
                description={
                  <>
                    Ste si istý, že chcete zmazať predmet{" "}
                    <strong>{entry.subject_name}</strong>? Táto akcia sa nedá
                    vrátiť späť.
                  </>
                }
                confirmLabel="Zmazať"
                confirmingLabel="Mazanie..."
                onConfirm={() => void handleDeleteSubject()}
                isConfirming={isDeleting}
                trigger={
                  <button
                    type="button"
                    className="flex h-9 w-[187px] items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 font-heading text-sm font-medium text-red-600 shadow-xs hover:bg-red-100"
                  />
                }
                triggerContent={
                  <>
                    <Trash2 size={14} />
                    Zmazať predmet
                  </>
                }
                align="end"
              />
            </div>
          </div>
        </div>

        {/* Search */}
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
      </div>

      {/* Table Section */}
      <div className="flex min-h-0 flex-1 flex-col px-8 pb-6">
        {/* Table Header: Študenti count + icons */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-heading text-sm font-medium">Študenti</span>
            <span className="inline-flex items-center justify-center rounded-full border border-[rgba(229,229,229,0.9)] bg-[#f9f5ff] px-2 py-0.5 text-xs font-medium text-[#6941c6]">
              {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterOpen(true)}
              className="relative rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <SlidersHorizontal size={16} />
              {statusFilter && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#6941c6] text-[10px] font-medium text-white">
                  1
                </span>
              )}
            </button>
            <button
              onClick={onMinimize}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-b border-[rgba(229,229,229,0.9)]" />

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-secondary">Žiadni študenti</p>
          </div>
        ) : (
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="inline-flex min-w-full">
                {/* Fixed Meno column */}
                <div className="sticky left-0 z-10 bg-white">
                  {/* Header */}
                  <div className="flex h-11 items-center border-b border-[rgba(229,229,229,0.9)] px-4">
                    <span className="font-body text-xs font-semibold text-[#525252]">
                      ID
                    </span>
                  </div>
                  {/* Rows */}
                  {filtered.map((student, idx) => (
                    <div
                      key={student.isic_identifier}
                      className="flex h-[72px] cursor-pointer items-center gap-3 border-b border-[rgba(229,229,229,0.9)] px-4 hover:bg-[#F0F4FF]"
                      style={{
                        backgroundColor: idx % 2 === 0 ? "white" : "#FAFAFA",
                        minWidth: 320,
                      }}
                      onClick={() => setSelectedStudent(student)}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E0ECFF] font-heading text-xs font-medium text-[#1D4ED8]">
                        {getStudentAvatarLabel(student)}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-heading text-sm font-medium text-[#333]">
                          {getStudentDisplayId(student)}
                        </span>
                        {getStudentMeta(student) && (
                          <span className="text-xs text-[#7C7C7C]">
                            {getStudentMeta(student)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scrollable week columns */}
                {weeks.map((week) => {
                  const isCurrent = week.is_current;

                  return (
                    <div
                      key={week.week_number}
                      className="min-w-[120px]"
                      style={{
                        backgroundColor: isCurrent ? "rgba(194, 238, 204, 0.15)" : undefined,
                      }}
                    >
                      {/* Column header */}
                      <div
                        className="flex h-11 items-center justify-center border-b border-[rgba(229,229,229,0.9)] px-2"
                        style={{
                          backgroundColor: isCurrent ? "rgba(194, 238, 204, 0.3)" : undefined,
                        }}
                      >
                        <span className="whitespace-nowrap font-body text-xs font-semibold text-[#525252]">
                          T{week.week_number}, {week.date_range}
                        </span>
                      </div>
                      {/* Cells per student */}
                      {filtered.map((student, idx) => {
                        const sw = student.weeks.find(
                          (w) => w.week_number === week.week_number,
                        );
                        return (
                          <div
                            key={student.isic_identifier}
                            className="flex h-[72px] items-center justify-center border-b border-[rgba(229,229,229,0.9)] px-2"
                            style={{
                              backgroundColor: isCurrent
                                ? "rgba(194, 238, 204, 0.15)"
                                : idx % 2 === 0
                                  ? "white"
                                  : "#FAFAFA",
                            }}
                          >
                            <StatusBadgeCell
                              status={sw?.status ?? null}
                              attendanceId={sw?.attendance_id ?? null}
                              isCancelled={week.lesson_id === null}
                              onStatusChange={handleStatusChange}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Action column */}
                <div className="min-w-[72px]">
                  <div className="h-11 border-b border-[rgba(229,229,229,0.9)]" />
                  {filtered.map((student, idx) => (
                    <div
                      key={student.isic_identifier}
                      className="flex h-[72px] items-center justify-center border-b border-[rgba(229,229,229,0.9)]"
                      style={{
                        backgroundColor: idx % 2 === 0 ? "white" : "#FAFAFA",
                      }}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded-md p-1 text-gray-400 outline-none hover:text-gray-600">
                          <MoreHorizontal size={16} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="cursor-pointer text-sm"
                            disabled={getMoveContext(student) === null}
                            onClick={() => {
                              setMoveStudent(student);
                              setMoveStudentOpen(true);
                            }}
                          >
                            Presunúť
                          </DropdownMenuItem>
                          <ConfirmationPopover
                            open={
                              removeStudentTargetKey ===
                              getRemoveStudentKey(student)
                            }
                            onOpenChange={(open) =>
                              setRemoveStudentTargetKey(
                                open ? getRemoveStudentKey(student) : null,
                              )
                            }
                            title="Odstrániť študenta"
                            description={
                              <>
                                Naozaj chcete odstrániť študenta{" "}
                                <strong>{getStudentDisplayId(student)}</strong>{" "}
                                z predmetu? Táto akcia sa nedá vrátiť späť.
                              </>
                            }
                            confirmLabel="Odstrániť"
                            confirmingLabel="Odstraňovanie..."
                            onConfirm={() => void handleRemoveStudent(student)}
                            isConfirming={
                              isRemovingStudent &&
                              removeStudentTargetKey ===
                                getRemoveStudentKey(student)
                            }
                            trigger={
                              <DropdownMenuItem
                                closeOnClick={false}
                                variant="destructive"
                                className="cursor-pointer text-sm"
                              />
                            }
                            triggerContent="Odstrániť"
                            triggerNativeButton={false}
                            triggerDisabled={!student.enrollment_id}
                            side="left"
                            align="start"
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </div>

      <FilterModal
        key={`${filterOpen}-${statusFilter ?? "all"}`}
        open={filterOpen}
        onOpenChange={setFilterOpen}
        onFilter={setStatusFilter}
        currentFilter={statusFilter}
      />

      <Dialog
        open={selectedStudent !== null}
        onOpenChange={(open) => { if (!open) setSelectedStudent(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedStudent ? getStudentDisplayId(selectedStudent) : ""}</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="flex flex-col gap-3">
              {selectedStudent.student_identifier && (
                <div>
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="text-sm font-medium">{selectedStudent.student_identifier}</p>
                </div>
              )}
              {selectedStudent.study_identification && (
                <div>
                  <p className="text-xs text-muted-foreground">Štúdium</p>
                  <p className="text-sm">{selectedStudent.study_identification}</p>
                </div>
              )}
              {selectedStudent.email_is && (
                <div>
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <p className="text-sm">{selectedStudent.email_is}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Karta čip</p>
                <p className="font-mono text-sm">{selectedStudent.isic_identifier}</p>
              </div>
              <div className="flex justify-end gap-2 border-t border-[#e5e5e5] pt-3">
                <button
                  disabled={getMoveContext(selectedStudent) === null}
                  onClick={() => {
                    const s = selectedStudent;
                    setSelectedStudent(null);
                    setMoveStudent(s);
                    setMoveStudentOpen(true);
                  }}
                  className="rounded-lg border border-[#d4d4d4] bg-white px-3 py-1.5 font-heading text-sm font-medium text-[#404040] shadow-xs hover:bg-gray-50 disabled:opacity-40"
                >
                  Presunúť
                </button>
                <ConfirmationPopover
                  open={
                    selectedStudent !== null &&
                    removeStudentTargetKey ===
                      getRemoveStudentKey(selectedStudent)
                  }
                  onOpenChange={(open) =>
                    setRemoveStudentTargetKey(
                      open && selectedStudent !== null
                        ? getRemoveStudentKey(selectedStudent)
                        : null,
                    )
                  }
                  title="Odstrániť študenta"
                  description={
                    <>
                      Naozaj chcete odstrániť študenta{" "}
                      <strong>
                        {selectedStudent
                          ? getStudentDisplayId(selectedStudent)
                          : ""}
                      </strong>{" "}
                      z predmetu? Táto akcia sa nedá vrátiť späť.
                    </>
                  }
                  confirmLabel="Odstrániť"
                  confirmingLabel="Odstraňovanie..."
                  onConfirm={() => {
                    if (selectedStudent) {
                      void handleRemoveStudent(selectedStudent);
                    }
                  }}
                  isConfirming={
                    isRemovingStudent &&
                    selectedStudent !== null &&
                    removeStudentTargetKey ===
                      getRemoveStudentKey(selectedStudent)
                  }
                  trigger={
                    <button
                      type="button"
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-heading text-sm font-medium text-red-600 shadow-xs hover:bg-red-100 disabled:opacity-40"
                    />
                  }
                  triggerContent="Odstrániť"
                  triggerDisabled={!selectedStudent.enrollment_id}
                  align="end"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Move Student Modal */}
      {moveStudent && (() => {
        const ctx = getMoveContext(moveStudent);
        if (!ctx) return null;
        return (
          <MoveStudentModal
            open={moveStudentOpen}
            onOpenChange={setMoveStudentOpen}
            student={moveStudent}
            attendanceId={ctx.attendanceId}
            currentLessonId={ctx.lessonId}
            currentEntryId={entryId}
            subjectName={entry.subject_name}
            subjectId={subjectId}
            semesterId={semesterId}
            lessonInfo={{
              dayOfWeek: entry.day_of_week,
              startTime: entry.start_time,
              endTime: entry.end_time,
            }}
            onMoved={async () => {
              setMoveStudentOpen(false);
              setMoveStudent(null);
              const result = await fetchScheduleEntryOverview(subjectId, entryId, semesterId);
              setData(result);
            }}
          />
        );
      })()}
    </div>
  );
}
