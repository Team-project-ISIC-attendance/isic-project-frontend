import { useLayoutEffect, useRef } from "react";
import type { components } from "@/api/schema";

type ScheduleEntryResponse = components["schemas"]["ScheduleEntryResponse"];

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
  lessonMap: Map<number, number>;
  onBlockClick?: (lessonId: number, entry: ScheduleEntryResponse) => void;
}

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

interface LayoutEntry {
  entry: ScheduleEntryResponse;
  column: number;
  totalColumns: number;
}

function layoutOverlaps(entries: ScheduleEntryResponse[]): LayoutEntry[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => {
    const aStart = parseTime(a.start_time);
    const bStart = parseTime(b.start_time);
    return (
      aStart.hour * 60 + aStart.minute - (bStart.hour * 60 + bStart.minute)
    );
  });

  const columns: ScheduleEntryResponse[][] = [];

  for (const entry of sorted) {
    const entryStart = parseTime(entry.start_time);
    const entryStartMin = entryStart.hour * 60 + entryStart.minute;

    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      const lastInCol = columns[col][columns[col].length - 1];
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
      entryColumnMap.set(entry.id, col);
    }
  }

  return sorted.map((entry) => ({
    entry,
    column: entryColumnMap.get(entry.id) ?? 0,
    totalColumns: columns.length,
  }));
}

export function CalendarGrid({
  scheduleEntries,
  lessonMap,
  onBlockClick,
}: CalendarGridProps) {
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const entriesByDay = new Map<number, ScheduleEntryResponse[]>();
  for (const entry of scheduleEntries) {
    const day = entry.day_of_week;
    if (!entriesByDay.has(day)) entriesByDay.set(day, []);
    entriesByDay.get(day)!.push(entry);
  }

  const layoutByDay = new Map<number, LayoutEntry[]>();
  for (const [day, entries] of entriesByDay) {
    layoutByDay.set(day, layoutOverlaps(entries));
  }

  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT;

  useLayoutEffect(() => {
    if (gridScrollRef.current === null) return;
    const targetScrollTop = (8 - START_HOUR) * HOUR_HEIGHT;
    const scrollToWorkday = () => {
      if (gridScrollRef.current !== null) {
        gridScrollRef.current.scrollTop = targetScrollTop;
      }
    };

    scrollToWorkday();
    const frame = window.requestAnimationFrame(scrollToWorkday);
    return () => window.cancelAnimationFrame(frame);
  }, [scheduleEntries.length]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Day headers */}
      <div className="flex shrink-0 border-b border-border-custom">
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

      {/* Grid body */}
      <div ref={gridScrollRef} className="flex flex-1 overflow-auto">
        {/* Time labels */}
        <div className="relative w-16 shrink-0" style={{ height: totalHeight }}>
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

            return (
              <div
                key={day.value}
                className="relative flex-1 border-l border-border-custom"
              >
                {dayLayout.map(({ entry, column, totalColumns }) => {
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
                  const lessonId = lessonMap.get(entry.id);

                  return (
                    <div
                      key={entry.id}
                      className="absolute cursor-pointer overflow-hidden rounded-md px-2 py-1"
                      style={{
                        top,
                        height,
                        left: `${leftPercent}%`,
                        width: `calc(${widthPercent}% - 4px)`,
                        backgroundColor: hexToRgba(color, 0.15),
                        borderLeft: `4px solid ${color}`,
                      }}
                      onClick={() => {
                        if (lessonId !== undefined && onBlockClick) {
                          onBlockClick(lessonId, entry);
                        }
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
