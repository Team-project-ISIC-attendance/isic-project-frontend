import { useState } from "react";
import {
  CalendarPlus,
  X,
  Clock,
  Minus,
  Plus,
} from "lucide-react";
import {
  DatePickerField,
  formatDisplayDateValue,
} from "@/components/ui/date-picker-field";
import type { components } from "@/api/schema";
import {
  createScheduleEntry,
  createSubject,
  deleteScheduleEntry,
  updateScheduleEntry,
} from "@/api/calendar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLOR_PRESETS = [
  "#079455",
  "#1570EF",
  "#444CE7",
  "#6938EF",
  "#BA24D5",
  "#DD2590",
  "#D92D20",
  "#E04F16",
] as const;

const DAY_LABELS = [
  { value: 1, label: "P", title: "Pondelok" },
  { value: 2, label: "U", title: "Utorok" },
  { value: 3, label: "S", title: "Streda" },
  { value: 4, label: "Š", title: "Štvrtok" },
  { value: 5, label: "P", title: "Piatok" },
] as const;

const DEFAULT_RECURRENCE_INTERVAL = 1;
const DEFAULT_DURATION_MINUTES = 110; // 1h 50min

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

type ScheduleEntryResponse = components["schemas"]["ScheduleEntryResponse"];

interface ScheduleEntryDraft {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
}

interface ScheduleEntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: number;
  scheduleEntries?: ScheduleEntryResponse[];
  initialDraft?: ScheduleEntryDraft | null;
  mode?: "create" | "edit";
  entry?: ScheduleEntryResponse | null;
  onCreated: (createdSubjectId?: number) => void | Promise<void>;
  onUpdated?: () => void | Promise<void>;
}

function createAutoSubjectCode(subjectName: string) {
  const normalized = subjectName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  const prefix = normalized.slice(0, 6) || "SUB";
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${suffix}`;
}

function normalizeRoom(room: string | null | undefined) {
  return room ?? null;
}

function getRecurringEditGroup(
  entry: ScheduleEntryResponse | null,
  scheduleEntries: ScheduleEntryResponse[],
) {
  if (entry === null || entry.is_one_time) {
    return entry ? [entry] : [];
  }

  const matchingEntries = scheduleEntries
    .filter((candidate) => {
      return (
        candidate.subject_id === entry.subject_id &&
        candidate.start_time === entry.start_time &&
        candidate.end_time === entry.end_time &&
        normalizeRoom(candidate.room) === normalizeRoom(entry.room) &&
        candidate.lesson_type === entry.lesson_type &&
        candidate.is_one_time === entry.is_one_time &&
        candidate.recurrence_interval === entry.recurrence_interval &&
        candidate.end_date === entry.end_date
      );
    })
    .sort((left, right) => left.day_of_week - right.day_of_week || left.id - right.id);
  return matchingEntries.length > 0 ? matchingEntries : [entry];
}

function getInitialSelectedDays(
  entry: ScheduleEntryResponse | null,
  scheduleEntries: ScheduleEntryResponse[],
  initialDraft: ScheduleEntryDraft | null,
) {
  if (entry === null) {
    return initialDraft?.dayOfWeek ? new Set([initialDraft.dayOfWeek]) : new Set<number>();
  }
  if (entry.is_one_time) {
    return new Set([entry.day_of_week]);
  }

  const recurringGroup = getRecurringEditGroup(entry, scheduleEntries);
  return new Set(recurringGroup.map((groupEntry) => groupEntry.day_of_week));
}

export function ScheduleEntryFormDialog({
  open,
  onOpenChange,
  semesterId,
  scheduleEntries = [],
  initialDraft = null,
  mode = "create",
  entry = null,
  onCreated,
  onUpdated,
}: ScheduleEntryFormDialogProps) {
  const isEditing = mode === "edit" && entry !== null;
  const [activeTab, setActiveTab] = useState<"recurring" | "one-time">(
    entry?.is_one_time ? "one-time" : "recurring",
  );
  const [name, setName] = useState(entry?.subject_name ?? "");
  const [startTime, setStartTime] = useState(
    entry?.start_time ?? initialDraft?.startTime ?? "08:00",
  );
  const [endTime, setEndTime] = useState(() => {
    if (entry?.end_time) return entry.end_time;
    if (initialDraft?.endTime) return initialDraft.endTime;
    const start = initialDraft?.startTime ?? "08:00";
    return addMinutes(start, DEFAULT_DURATION_MINUTES);
  });
  const [lessonType, setLessonType] = useState(entry?.lesson_type ?? "prednaska");
  const [room, setRoom] = useState(entry?.room ?? "");
  const [color, setColor] = useState<string>(
    entry?.subject_color || COLOR_PRESETS[0],
  );
  const [selectedDays, setSelectedDays] = useState<Set<number>>(
    getInitialSelectedDays(entry, scheduleEntries, initialDraft),
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(
    entry?.recurrence_interval ?? DEFAULT_RECURRENCE_INTERVAL,
  );
  const [endOption, setEndOption] = useState<"semester" | "date">(
    entry?.end_date ? "date" : "semester",
  );
  const [endDate, setEndDate] = useState(entry?.end_date ?? "");
  const [endDateInput, setEndDateInput] = useState(
    entry?.end_date ? formatDisplayDateValue(entry.end_date) : "",
  );
  const [endDateInputError, setEndDateInputError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setActiveTab("recurring");
    setName("");
    setStartTime("08:00");
    setEndTime("10:00");
    setLessonType("prednaska");
    setRoom("");
    setColor(COLOR_PRESETS[0]);
    setSelectedDays(new Set());
    setRecurrenceInterval(DEFAULT_RECURRENCE_INTERVAL);
    setEndOption("semester");
    setEndDate("");
    setEndDateInput("");
    setEndDateInputError("");
    setError("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  function handleTabChange(nextTab: "recurring" | "one-time") {
    setActiveTab(nextTab);
    if (nextTab === "one-time") {
      setSelectedDays((prev) => {
        if (prev.size <= 1) return prev;
        return new Set([Array.from(prev).sort((a, b) => a - b)[0]]);
      });
    }
  }

  function toggleDay(day: number) {
    if (activeTab === "one-time") {
      setSelectedDays(new Set([day]));
      return;
    }
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validation
    if (!name.trim()) {
      setError("Názov je povinný");
      return;
    }
    if (startTime >= endTime) {
      setError("Začiatok musí byť pred koncom");
      return;
    }
    if (activeTab === "recurring" && selectedDays.size === 0) {
      setError("Vyberte aspoň jeden deň");
      return;
    }
    if (activeTab === "one-time" && selectedDays.size !== 1) {
      setError("Vyberte deň");
      return;
    }
    setSubmitting(true);

    try {
      const isOneTime = activeTab === "one-time";
      const computedEndDate = endOption === "date" && endDate ? endDate : null;
      const buildUpdatePayload = (dayOfWeek: number) => ({
        subject_name: name.trim(),
        subject_color: color,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room: room || null,
        lesson_type: lessonType,
        is_one_time: isOneTime,
        recurrence_interval: isOneTime ? 1 : recurrenceInterval,
        end_date: computedEndDate,
      });

      if (isEditing && entry !== null) {
        const selectedDayList = Array.from(selectedDays).sort((left, right) => left - right);
        const recurringGroup = getRecurringEditGroup(entry, scheduleEntries);

        if (isOneTime) {
          const selectedDay = selectedDayList[0] ?? entry.day_of_week;
          await updateScheduleEntry(
            semesterId,
            entry.id,
            buildUpdatePayload(selectedDay),
          );

          for (const groupEntry of recurringGroup) {
            if (groupEntry.id !== entry.id) {
              await deleteScheduleEntry(semesterId, groupEntry.id);
            }
          }
        } else {
          const existingEntriesByDay = new Map<number, ScheduleEntryResponse[]>();
          for (const groupEntry of recurringGroup) {
            const list = existingEntriesByDay.get(groupEntry.day_of_week) ?? [];
            list.push(groupEntry);
            existingEntriesByDay.set(groupEntry.day_of_week, list);
          }

          const assignedEntryIds = new Set<number>();
          const reusableEntries = recurringGroup.filter(
            (groupEntry) => !selectedDayList.includes(groupEntry.day_of_week),
          );
          const assignments: Array<{
            dayOfWeek: number;
            entryToReuse: ScheduleEntryResponse | null;
          }> = [];

          for (const dayOfWeek of selectedDayList) {
            const exactMatch = (existingEntriesByDay.get(dayOfWeek) ?? []).find(
              (groupEntry) => !assignedEntryIds.has(groupEntry.id),
            );
            if (exactMatch) {
              assignedEntryIds.add(exactMatch.id);
              assignments.push({ dayOfWeek, entryToReuse: exactMatch });
              continue;
            }

            const reusableEntry = reusableEntries.find(
              (groupEntry) => !assignedEntryIds.has(groupEntry.id),
            );
            if (reusableEntry) {
              assignedEntryIds.add(reusableEntry.id);
              assignments.push({ dayOfWeek, entryToReuse: reusableEntry });
              continue;
            }

            assignments.push({ dayOfWeek, entryToReuse: null });
          }

          for (const assignment of assignments) {
            if (assignment.entryToReuse === null) {
              continue;
            }
            await updateScheduleEntry(
              semesterId,
              assignment.entryToReuse.id,
              buildUpdatePayload(assignment.dayOfWeek),
            );
          }

          for (const assignment of assignments) {
            if (assignment.entryToReuse !== null) {
              continue;
            }
            await createScheduleEntry(semesterId, {
              subject_id: entry.subject_id,
              day_of_week: assignment.dayOfWeek,
              start_time: startTime,
              end_time: endTime,
              room: room || null,
              lesson_type: lessonType,
              is_one_time: false,
              recurrence_interval: recurrenceInterval,
              end_date: computedEndDate,
            });
          }

          for (const groupEntry of recurringGroup) {
            if (!assignedEntryIds.has(groupEntry.id)) {
              await deleteScheduleEntry(semesterId, groupEntry.id);
            }
          }
        }

        resetForm();
        onOpenChange(false);
        await onUpdated?.();
        return;
      }

      // Auto-create subject from name + color
      const autoCode = createAutoSubjectCode(name.trim());
      const subject = await createSubject({
        name: name.trim(),
        code: autoCode,
        color,
      });

      if (isOneTime) {
        // One-time: create a single entry for the selected day.
        const selectedDay = Array.from(selectedDays)[0];
        await createScheduleEntry(semesterId, {
          subject_id: subject.id,
          day_of_week: selectedDay,
          start_time: startTime,
          end_time: endTime,
          room: room || null,
          lesson_type: lessonType,
          is_one_time: true,
          recurrence_interval: 1,
          end_date: computedEndDate,
        });
      } else {
        // Recurring: create one entry per selected day
        const days = Array.from(selectedDays).sort();
        for (const day of days) {
          await createScheduleEntry(semesterId, {
            subject_id: subject.id,
            day_of_week: day,
            start_time: startTime,
            end_time: endTime,
            room: room || null,
            lesson_type: lessonType,
            is_one_time: false,
            recurrence_interval: recurrenceInterval,
            end_date: computedEndDate,
          });
        }
      }

      resetForm();
      onOpenChange(false);
      await onCreated(subject.id);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : isEditing
            ? "Chyba pri ukladaní"
            : "Chyba pri vytváraní";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] overflow-hidden p-0 gap-0 sm:max-w-[700px]"
      >
        <div className="flex max-h-[90vh] flex-col">
          {/* Header */}
          <div className="shrink-0 bg-white pt-6 px-6 pb-5">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="absolute right-4 top-4 rounded-lg p-2.5 text-[#737373] hover:bg-[#f5f5f5]"
            >
              <X size={24} />
            </button>

            <div className="flex flex-col gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-[#e5e5e5] shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
                <CalendarPlus size={22} className="text-[#171717]" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-[#171717] leading-7">
                  {isEditing
                    ? "Upraviť rozvrhovú jednotku"
                    : "Pridať rozvrhovú jednotku"}
                </h2>
                <p className="text-sm font-normal text-[#525252] leading-5">
                  {isEditing
                    ? "Upravte údaje a následne uložte zmeny rozvrhovej jednotky."
                    : "Vyplňte všetky polia a následne môžete vytvoriť rozvrhovú jednotku."}
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6">
              {/* Tabs */}
              <div className="flex rounded-lg border border-[#d5d7da] bg-[#fafafa] p-0.5">
                <button
                  type="button"
                  onClick={() => handleTabChange("recurring")}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    activeTab === "recurring"
                      ? "bg-white border border-[#d5d7da] text-[#171717] shadow-sm"
                      : "border border-transparent text-[#737373]"
                  }`}
                >
                  Opakujúca sa
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("one-time")}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    activeTab === "one-time"
                      ? "bg-white border border-[#d5d7da] text-[#171717] shadow-sm"
                      : "border border-transparent text-[#737373]"
                  }`}
                >
                  Jednorazová
                </button>
              </div>

              {/* Názov */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-[#414651]">
                  Názov
                </Label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="napr. Udajove struktury"
                  className="h-10 w-full rounded-lg border border-[#d5d7da] bg-white px-3 py-2 text-sm shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] outline-none placeholder:text-[#a3a3a3] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]"
                />
              </div>

              {/* Začiatok / Koniec */}
              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-2">
                  <Label className="text-sm font-medium text-[#414651]">
                    Začiatok
                  </Label>
                  <div className="flex items-center rounded-lg border border-[#d5d7da] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="h-10 flex-1 appearance-none bg-transparent px-3 py-2 text-sm outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                    <div className="px-3">
                      <Clock size={16} className="text-[#737373]" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label className="text-sm font-medium text-[#414651]">
                    Koniec
                  </Label>
                  <div className="flex items-center rounded-lg border border-[#d5d7da] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="h-10 flex-1 appearance-none bg-transparent px-3 py-2 text-sm outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                    <div className="px-3">
                      <Clock size={16} className="text-[#737373]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Typ / Miestnosť */}
              <div className="flex gap-4">
                <div className="flex w-[288px] flex-none flex-col gap-2">
                  <Label className="text-sm font-medium text-[#414651]">
                    Typ
                  </Label>
                  <Select
                    value={lessonType}
                    onValueChange={(val) => {
                      if (val !== null) setLessonType(val);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {{
                          prednaska: "Prednáška",
                          cvicenie: "Cvičenie",
                          laboratorium: "Laboratórium",
                        }[lessonType] ?? lessonType}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prednaska">Prednáška</SelectItem>
                      <SelectItem value="cvicenie">Cvičenie</SelectItem>
                      <SelectItem value="laboratorium">Laboratórium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label className="text-sm font-medium text-[#414651]">
                    Miestnosť
                  </Label>
                  <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="napr. AB150"
                    className="h-10 w-full rounded-lg border border-[#d5d7da] bg-white px-3 py-2 text-sm shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] outline-none placeholder:text-[#a3a3a3] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]"
                  />
                </div>
              </div>

              {/* Farba */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-[#414651]">
                  Farba
                </Label>
                <div className="flex items-center gap-2 rounded-lg border border-[#d5d7da] px-3 py-2.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`flex h-[24px] w-[24px] items-center justify-center rounded-full ${
                        color === c
                          ? "ring-[1.8px] ring-[#181d27] ring-offset-1"
                          : ""
                      }`}
                    >
                      <div
                        className="h-[19.2px] w-[19.2px] rounded-full"
                        style={{
                          backgroundColor: c,
                          boxShadow: "inset 0 0 0 1.2px rgba(0,0,0,0.1)",
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Scheduling options */}
              <div className="h-px bg-[#e5e5e5]" />

              {activeTab === "recurring" && (
                <>
                  {/* Opakovať každých */}
                  <div className="flex items-end gap-3">
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-medium text-[#414651]">
                        Opakovať každých:
                      </Label>
                      <div className="flex w-[144px] items-center rounded-lg border border-[#d5d7da] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                        <button
                          type="button"
                          onClick={() =>
                            setRecurrenceInterval(
                              Math.max(1, recurrenceInterval - 1),
                            )
                          }
                          className="rounded-l-lg border-r border-[#d5d7da] px-3 py-2.5"
                        >
                          <Minus size={20} className="text-[#171717]" />
                        </button>
                        <div className="flex-1 border-r border-[#d5d7da] py-2.5 text-center text-base text-[#181d27]">
                          {recurrenceInterval}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setRecurrenceInterval(
                              Math.min(52, recurrenceInterval + 1),
                            )
                          }
                          className="rounded-r-lg px-3 py-2.5"
                        >
                          <Plus size={20} className="text-[#171717]" />
                        </button>
                      </div>
                    </div>
                    <div className="flex h-[44px] items-center pb-0.5">
                      <span className="text-sm font-medium text-[#414651]">
                        týždňov
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Day selection */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-[#414651]">
                  {activeTab === "one-time" ? "Deň" : "Opakovanie"}
                </Label>
                <div className="flex gap-2">
                  {DAY_LABELS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      title={d.title}
                      aria-label={d.title}
                      onClick={() => toggleDay(d.value)}
                      className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-sm font-medium transition-colors ${
                        selectedDays.has(d.value)
                          ? "bg-[#1d4ed8] text-white shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]"
                          : "border border-[#d5d7da] bg-white text-[#717680]"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Končí */}
              {activeTab === "recurring" && (
                <div className="flex flex-col gap-3">
                  <Label className="text-sm font-medium text-[#414651]">
                    Končí
                  </Label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        endOption === "semester"
                          ? "border-[#1d4ed8]"
                          : "border-[#d5d7da]"
                      }`}
                    >
                      {endOption === "semester" && (
                        <div className="h-2.5 w-2.5 rounded-full bg-[#1d4ed8]" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEndOption("semester")}
                      className="text-sm text-[#171717]"
                    >
                      Koniec semestra
                    </button>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          endOption === "date"
                            ? "border-[#1d4ed8]"
                            : "border-[#d5d7da]"
                        }`}
                      >
                        {endOption === "date" && (
                          <div className="h-2.5 w-2.5 rounded-full bg-[#1d4ed8]" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEndOption("date")}
                        className="text-sm text-[#171717]"
                      >
                        Dátum
                      </button>
                    </label>
                    {endOption === "date" && (
                      <div className="flex-1">
                        <DatePickerField
                          id="entry-end-date"
                          label=""
                          value={endDate}
                          inputValue={endDateInput}
                          error={endDateInputError}
                          onInputValueChange={setEndDateInput}
                          onDateChange={(val) => setEndDate(val ?? "")}
                          onErrorChange={setEndDateInputError}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="shrink-0 bg-white flex flex-col gap-3 px-6 pb-6 pt-4">
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="flex-1 rounded-lg border border-[#d4d4d4] bg-white py-2.5 text-base font-semibold text-[#404040] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] hover:bg-[#fafafa]"
                >
                  Zrušiť
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#1d4ed8] py-2.5 text-base font-semibold text-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] hover:bg-[#1a44c2] disabled:opacity-50"
                >
                  {submitting
                    ? isEditing
                      ? "Ukladanie..."
                      : "Vytváranie..."
                    : isEditing
                      ? "Uložiť zmeny"
                      : "Vytvoriť"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
