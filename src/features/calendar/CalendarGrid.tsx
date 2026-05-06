import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import {
  getWeekdayDate,
  parseSemesterDate,
} from "@/features/calendar/semesterDates";
import { Pencil, Plus, Trash2 } from "lucide-react";

type ScheduleEntryResponse = components["schemas"]["ScheduleEntryResponse"];
type SemesterResponse = components["schemas"]["SemesterResponse"];
type WeekLessonResponse = components["schemas"]["WeekLessonResponse"];

const HOUR_HEIGHT = 60;
const START_HOUR = 0;
const END_HOUR = 23;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i,
);
const DAYS = [
  { value: 1, label: "Po" },
  { value: 2, label: "Ut" },
  { value: 3, label: "St" },
  { value: 4, label: "Št" },
  { value: 5, label: "Pi" },
] as const;

interface CalendarGridProps {
  scheduleEntries: ScheduleEntryResponse[];
  weekLessons: WeekLessonResponse[];
  semester: SemesterResponse | null;
  activeWeek: number;
  onBlockClick?: (lessonId: number, entry: ScheduleEntryResponse) => void;
  onSlotClick?: (draft: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) => void;
  onEntryEdit?: (entry: ScheduleEntryResponse) => void;
  onEntryDelete?: (entry: ScheduleEntryResponse) => void | Promise<void>;
}

interface ContextMenuState {
  entry: ScheduleEntryResponse;
  x: number;
  y: number;
}

const SLOT_SNAP_MINUTES = 30;
const DEFAULT_SLOT_DURATION_MINUTES = 100;
const MAX_END_MINUTES = END_HOUR * 60 + 59;

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: h, minute: m };
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatMinutes(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

interface RenderedEntry {
  entry: ScheduleEntryResponse;
  lessonId: number;
}

interface LayoutEntry {
  entry: RenderedEntry;
  column: number;
  totalColumns: number;
}

function layoutOverlaps(entries: RenderedEntry[]): LayoutEntry[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => {
    const aStart = parseTime(a.entry.start_time);
    const bStart = parseTime(b.entry.start_time);
    return (
      aStart.hour * 60 + aStart.minute - (bStart.hour * 60 + bStart.minute)
    );
  });

  const columns: RenderedEntry[][] = [];

  for (const entry of sorted) {
    const entryStart = parseTime(entry.entry.start_time);
    const entryStartMin = entryStart.hour * 60 + entryStart.minute;

    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      const lastInCol = columns[col][columns[col].length - 1].entry;
      const lastEnd = parseTime(lastInCol.end_time);
      const lastEndMin = lastEnd.hour * 60 + lastEnd.minute;

      if (entryStartMin >= lastEndMin) {
        columns[col].push(entry);
        placed = true;
        break;
      }
    }

    if (!placed) {
      columns.push([entry]);
    }
  }

  const entryColumnMap = new Map<number, number>();
  for (let col = 0; col < columns.length; col++) {
    for (const entry of columns[col]) {
      entryColumnMap.set(entry.entry.id, col);
    }
  }

  return sorted.map((entry) => ({
    entry,
    column: entryColumnMap.get(entry.entry.id) ?? 0,
    totalColumns: columns.length,
  }));
}

export function CalendarGrid({
  scheduleEntries,
  weekLessons,
  semester,
  activeWeek,
  onBlockClick,
  onSlotClick,
  onEntryEdit,
  onEntryDelete,
}: CalendarGridProps) {
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);
  const scheduleEntriesById = new Map(
    scheduleEntries.map((entry) => [entry.id, entry] as const),
  );
  const entriesByDay = new Map<number, RenderedEntry[]>();
  const visibleEntries = weekLessons
    .map((lesson) => {
      const entry = scheduleEntriesById.get(lesson.schedule_entry_id);
      if (!entry) {
        return null;
      }
      return { entry, lessonId: lesson.lesson_id };
    })
    .filter((entry): entry is RenderedEntry => entry !== null);

  for (const renderedEntry of visibleEntries) {
    const day = renderedEntry.entry.day_of_week;
    if (!entriesByDay.has(day)) entriesByDay.set(day, []);
    entriesByDay.get(day)!.push(renderedEntry);
  }

  const layoutByDay = new Map<number, LayoutEntry[]>();
  for (const [day, entries] of entriesByDay) {
    layoutByDay.set(day, layoutOverlaps(entries));
  }

  const semesterStart = parseSemesterDate(semester?.start_date ?? "");
  const semesterEnd = parseSemesterDate(semester?.end_date ?? "");

  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT;

  useLayoutEffect(() => {
    if (gridScrollRef.current === null) return;
    const now = new Date();
    const currentOffsetPx =
      (now.getHours() - START_HOUR) * HOUR_HEIGHT +
      (now.getMinutes() / 60) * HOUR_HEIGHT;
    const scrollToCurrentTime = () => {
      if (gridScrollRef.current !== null) {
        const half = gridScrollRef.current.clientHeight / 2;
        gridScrollRef.current.scrollTop = Math.max(0, currentOffsetPx - half);
      }
    };

    scrollToCurrentTime();
    const frame = window.requestAnimationFrame(scrollToCurrentTime);
    return () => window.cancelAnimationFrame(frame);
  }, [scheduleEntries.length]);

  useEffect(() => {
    if (contextMenu === null) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        contextMenuRef.current !== null &&
        event.target instanceof Node &&
        contextMenuRef.current.contains(event.target)
      ) {
        return;
      }
      setContextMenu(null);
      setDeleteConfirmOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
        setDeleteConfirmOpen(false);
      }
    }

    function handleScroll() {
      setContextMenu(null);
      setDeleteConfirmOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenu]);

  function handleDayColumnClick(
    event: React.MouseEvent<HTMLDivElement>,
    dayOfWeek: number,
    isDisabledDay: boolean,
  ) {
    if (isDisabledDay || onSlotClick === undefined) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetY = Math.min(Math.max(0, event.clientY - bounds.top), totalHeight);
    const rawMinutes = START_HOUR * 60 + (offsetY / HOUR_HEIGHT) * 60;
    const snappedMinutes = Math.max(
      START_HOUR * 60,
      Math.min(
        END_HOUR * 60,
        Math.floor(rawMinutes / SLOT_SNAP_MINUTES) * SLOT_SNAP_MINUTES,
      ),
    );
    const endMinutes = Math.min(
      MAX_END_MINUTES,
      snappedMinutes + DEFAULT_SLOT_DURATION_MINUTES,
    );

    setContextMenu(null);
    setDeleteConfirmOpen(false);
    onSlotClick({
      dayOfWeek,
      startTime: formatMinutes(snappedMinutes),
      endTime: formatMinutes(endMinutes),
    });
  }

  async function handleDeleteFromContextMenu() {
    if (contextMenu === null || onEntryDelete === undefined) {
      return;
    }

    setIsDeletingEntry(true);
    try {
      await onEntryDelete(contextMenu.entry);
      setContextMenu(null);
      setDeleteConfirmOpen(false);
    } finally {
      setIsDeletingEntry(false);
    }
  }

  if (semester === null) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#fcfcfd]">
        <div className="max-w-sm rounded-2xl border border-[#eaecf0] bg-white px-6 py-8 text-center shadow-sm">
          <div className="font-heading text-lg font-medium text-text">
            Žiadny semester
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            Pre zobrazenie rozvrhu najprv vytvorte semester.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div ref={gridScrollRef} className="flex-1 overflow-auto">
        <div className="min-w-[720px]">
          {/* Day headers live in the same scroll container as the columns. */}
          <div className="sticky top-0 z-20 flex border-b border-border-custom bg-white">
            <div className="w-16 shrink-0" />
            {DAYS.map((day) => (
              <div
                key={day.value}
                className="flex-1 border-l border-border-custom py-2 text-center font-heading text-sm font-medium text-text-secondary"
              >
                {day.label}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Time labels */}
            <div
              className="relative w-16 shrink-0"
              style={{ height: totalHeight }}
            >
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-2 font-body text-xs text-text-secondary"
                  style={{
                    top: Math.max(0, (hour - START_HOUR) * HOUR_HEIGHT - 8),
                  }}
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div className="relative flex flex-1" style={{ height: totalHeight }}>
              {/* Horizontal grid lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-border-custom"
                  style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                />
              ))}

              {/* Day column separators + blocks */}
              {DAYS.map((day) => {
                const dayLayout = layoutByDay.get(day.value) ?? [];
                const weekdayDate = semester
                  ? getWeekdayDate(semester.start_date, activeWeek, day.value)
                  : null;
                const isDisabledDay =
                  weekdayDate !== null &&
                  semesterStart !== null &&
                  semesterEnd !== null &&
                  (weekdayDate < semesterStart || weekdayDate > semesterEnd);

                return (
                  <div
                    key={day.value}
                    className={`group relative flex-1 border-l border-border-custom ${
                      isDisabledDay ? "bg-[#171717]/5" : "cursor-cell transition-colors hover:bg-[#eff6ff]/55"
                    }`}
                    title={isDisabledDay ? undefined : "Kliknite pre pridanie rozvrhovej jednotky"}
                    onClick={(event) =>
                      handleDayColumnClick(event, day.value, isDisabledDay)
                    }
                  >
                    {isDisabledDay && (
                      <div className="absolute inset-0 bg-[#171717]/6" />
                    )}
                    {dayLayout.map(({ entry: renderedEntry, column, totalColumns }) => {
                      const entry = renderedEntry.entry;
                      const start = parseTime(entry.start_time);
                      const end = parseTime(entry.end_time);
                      const startMin = start.hour * 60 + start.minute;
                      const endMin = end.hour * 60 + end.minute;
                      const durationMin = endMin - startMin;

                      const top =
                        (start.hour - START_HOUR) * HOUR_HEIGHT +
                        (start.minute / 60) * HOUR_HEIGHT;
                      const height = (durationMin / 60) * HOUR_HEIGHT;
                      const widthPercent = 100 / totalColumns;
                      const leftPercent = column * widthPercent;

                      const color = entry.subject_color || "#4CAF50";
                      const lessonId = renderedEntry.lessonId;

                      return (
                        <div
                          key={entry.id}
                          className="absolute cursor-pointer overflow-hidden rounded-md px-2 py-1 shadow-sm"
                          style={{
                            top,
                            height,
                            left: `${leftPercent}%`,
                            width: `calc(${widthPercent}% - 4px)`,
                            backgroundColor: hexToRgba(color, 0.15),
                            borderLeft: `4px solid ${color}`,
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (onBlockClick) {
                              onBlockClick(lessonId, entry);
                              return;
                            }
                            onEntryEdit?.(entry);
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setDeleteConfirmOpen(false);
                            setContextMenu({
                              entry,
                              x: Math.min(event.clientX, window.innerWidth - 236),
                              y: Math.min(event.clientY, window.innerHeight - 180),
                            });
                          }}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="truncate font-body text-xs font-medium text-text">
                              {entry.subject_name}
                            </span>
                            {entry.room && (
                              <span className="shrink-0 font-body text-xs text-text-secondary">
                                {entry.room}
                              </span>
                            )}
                          </div>
                          <div className="font-body text-xs text-text-secondary">
                            {{
                              prednaska: "Prednáška",
                              cvicenie: "Cvičenie",
                              laboratorium: "Laboratórium",
                            }[entry.lesson_type] ?? entry.lesson_type}
                          </div>
                        </div>
                      );
                    })}
                    {!isDisabledDay && (
                      <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full border border-dashed border-[#c7d7f9] bg-white/85 px-2 py-1 text-[11px] text-[#5d6f90] opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                        <Plus className="h-3 w-3" />
                        Pridať
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-56 rounded-xl border border-[#dbe4f5] bg-white p-1.5 shadow-[0_16px_40px_-18px_rgba(15,23,42,0.35)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {!deleteConfirmOpen ? (
            <div className="space-y-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#13213f] hover:bg-[#f4f8ff]"
                onClick={() => {
                  setContextMenu(null);
                  onEntryEdit?.(contextMenu.entry);
                }}
              >
                <Pencil className="h-4 w-4 text-[#155eef]" />
                Upraviť rozvrhovú jednotku
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#b42318] hover:bg-[#fff2f1]"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Odstrániť
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-2">
              <p className="text-sm text-[#44516a]">
                Odstrániť <strong>{contextMenu.entry.subject_name}</strong>?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-[#d5d7da] px-3 py-1.5 text-sm text-[#344054] hover:bg-[#f8fafc]"
                  disabled={isDeletingEntry}
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  Zrušiť
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#d92d20] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#b42318] disabled:opacity-50"
                  disabled={isDeletingEntry}
                  onClick={() => void handleDeleteFromContextMenu()}
                >
                  {isDeletingEntry ? "Odstraňovanie..." : "Odstrániť"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
