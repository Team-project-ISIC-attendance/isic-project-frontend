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
} from "lucide-react";
import type { components } from "@/api/schema";
import {
  fetchScheduleEntryOverview,
  updateAttendanceStatus,
  downloadStudentsExport,
} from "@/api/attendance";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { FilterModal } from "./FilterModal";

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

function getInitials(firstName: string | null, lastName: string | null): string {
  const f = firstName?.[0] ?? "";
  const l = lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function StatusBadgeCell({
  status,
  attendanceId,
  isFuture,
  isCancelled,
  onStatusChange,
}: {
  status: string | null;
  attendanceId: number | null;
  isFuture: boolean;
  isCancelled: boolean;
  onStatusChange: (attendanceId: number, newStatus: string) => void;
}) {
  if (isCancelled || attendanceId === null || status === null) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  if (isFuture) {
    return (
      <span className="inline-flex items-center rounded-[5px] bg-gray-100 px-2 py-1 font-heading text-xs font-medium text-gray-400">
        Plánovaný
      </span>
    );
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

  // Determine current week index for highlighting and future detection
  const currentWeekIndex = weeks.findIndex((w) => w.is_current);

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
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((s) => {
      const name = `${s.first_name ?? ""} ${s.last_name ?? ""}`.toLowerCase();
      return name.includes(q);
    });
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
                      Meno
                    </span>
                  </div>
                  {/* Rows */}
                  {filtered.map((student, idx) => (
                    <div
                      key={student.isic_identifier}
                      className="flex h-[72px] items-center gap-3 border-b border-[rgba(229,229,229,0.9)] px-4"
                      style={{
                        backgroundColor: idx % 2 === 0 ? "white" : "#FAFAFA",
                        minWidth: 263,
                      }}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E0ECFF] font-heading text-xs font-medium text-[#1D4ED8]">
                        {getInitials(student.first_name, student.last_name)}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-heading text-sm font-medium text-[#333]">
                          {student.first_name} {student.last_name}
                        </span>
                        <span className="text-xs text-[#7C7C7C]">
                          ID: {student.isic_identifier}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scrollable week columns */}
                {weeks.map((week, wIdx) => {
                  const isCurrent = week.is_current;
                  const isFuture = currentWeekIndex >= 0 && wIdx > currentWeekIndex;

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
                              isFuture={isFuture}
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
                          <DropdownMenuItem className="cursor-pointer text-sm">
                            Presunúť
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-sm text-red-600">
                            Odstrániť
                          </DropdownMenuItem>
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
    </div>
  );
}
