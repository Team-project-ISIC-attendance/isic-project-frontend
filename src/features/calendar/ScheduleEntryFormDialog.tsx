import { useState } from "react";
import { CalendarPlus, X, Clock, Minus, Plus, Calendar, ChevronDown } from "lucide-react";
import { createScheduleEntry, createSubject } from "@/api/calendar";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
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
  { value: 0, label: "M" },
  { value: 1, label: "T" },
  { value: 2, label: "W" },
  { value: 3, label: "T" },
  { value: 4, label: "F" },
  { value: 5, label: "S" },
  { value: 6, label: "S" },
] as const;

interface ScheduleEntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: number;
  totalWeeks: number;
  onCreated: () => void;
}

export function ScheduleEntryFormDialog({
  open,
  onOpenChange,
  semesterId,
  totalWeeks,
  onCreated,
}: ScheduleEntryFormDialogProps) {
  const [activeTab, setActiveTab] = useState<"recurring" | "one-time">("recurring");
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [lessonType, setLessonType] = useState("prednaska");
  const [room, setRoom] = useState("");
  const [color, setColor] = useState<string>(COLOR_PRESETS[0]);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [recurrenceInterval, setRecurrenceInterval] = useState(totalWeeks);
  const [endOption, setEndOption] = useState<"semester" | "date">("semester");
  const [endDate, setEndDate] = useState("");
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
    setRecurrenceInterval(totalWeeks);
    setEndOption("semester");
    setEndDate("");
    setError("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  function toggleDay(day: number) {
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

    setSubmitting(true);

    try {
      // Auto-create subject from name + color
      const autoCode = name.trim().slice(0, 3).toUpperCase() || name.trim();
      const subject = await createSubject({
        name: name.trim(),
        code: autoCode,
        color,
      });

      const isOneTime = activeTab === "one-time";
      const computedEndDate = endOption === "date" && endDate ? endDate : null;

      if (isOneTime) {
        // One-time: create a single entry for day 0 (Monday by default)
        await createScheduleEntry(semesterId, {
          subject_id: subject.id,
          day_of_week: 0,
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
      onCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chyba pri vytváraní";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[640px] max-w-[calc(100%-2rem)] p-0 gap-0"
      >
        {/* Header */}
        <div className="pt-6 px-6 pb-5">
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
                Pridať rozvrhovú jednotku
              </h2>
              <p className="text-sm font-normal text-[#525252] leading-5">
                Vyplňte všetky polia a následne môžete vytvoriť rozvrhovú jednotku.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-6 flex flex-col gap-4">
            {/* Tabs */}
            <div className="flex rounded-lg border border-[#d5d7da] bg-[#fafafa] p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("recurring")}
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
                onClick={() => setActiveTab("one-time")}
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
              <Label className="text-sm font-medium text-[#414651]">Názov</Label>
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
                <Label className="text-sm font-medium text-[#414651]">Začiatok</Label>
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
                <Label className="text-sm font-medium text-[#414651]">Koniec</Label>
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
                <Label className="text-sm font-medium text-[#414651]">Typ</Label>
                <Select value={lessonType} onValueChange={(val) => { if (val !== null) setLessonType(val); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {{ prednaska: "Prednáška", cvicenie: "Cvičenie", laboratorium: "Laboratórium" }[lessonType] ?? lessonType}
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
                <Label className="text-sm font-medium text-[#414651]">Miestnosť</Label>
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
              <Label className="text-sm font-medium text-[#414651]">Farba</Label>
              <div className="flex items-center gap-2 rounded-lg border border-[#d5d7da] px-3 py-2.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`flex h-[24px] w-[24px] items-center justify-center rounded-full ${
                      color === c ? "ring-[1.8px] ring-[#181d27] ring-offset-1" : ""
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

            {/* Recurrence section (recurring tab only) */}
            {activeTab === "recurring" && (
              <>
                <div className="h-px bg-[#e5e5e5]" />

                {/* Opakovať každých */}
                <div className="flex items-end gap-3">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium text-[#414651]">Opakovať každých:</Label>
                    <div className="flex w-[144px] items-center rounded-lg border border-[#d5d7da] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                      <button
                        type="button"
                        onClick={() => setRecurrenceInterval(Math.max(1, recurrenceInterval - 1))}
                        className="rounded-l-lg border-r border-[#d5d7da] px-3 py-2.5"
                      >
                        <Minus size={20} className="text-[#171717]" />
                      </button>
                      <div className="flex-1 border-r border-[#d5d7da] py-2.5 text-center text-base text-[#181d27]">
                        {recurrenceInterval}
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecurrenceInterval(Math.min(52, recurrenceInterval + 1))}
                        className="rounded-r-lg px-3 py-2.5"
                      >
                        <Plus size={20} className="text-[#171717]" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center rounded-lg border border-[#d5d7da] h-[44px] px-3 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                      <span className="flex-1 text-sm text-[#171717]">týždňov</span>
                      <ChevronDown size={16} className="text-[#737373]" />
                    </div>
                  </div>
                </div>

                {/* Opakovanie (day toggles) */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-[#414651]">Opakovanie</Label>
                  <div className="flex gap-2">
                    {DAY_LABELS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
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
                <div className="flex flex-col gap-3">
                  <Label className="text-sm font-medium text-[#414651]">Končí</Label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        endOption === "semester" ? "border-[#1d4ed8]" : "border-[#d5d7da]"
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
                          endOption === "date" ? "border-[#1d4ed8]" : "border-[#d5d7da]"
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
                      <div className="flex flex-1 items-center rounded-lg border border-[#d5d7da] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-10 flex-1 appearance-none bg-transparent px-3 py-2 text-sm outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                        <div className="px-3">
                          <Calendar size={16} className="text-[#737373]" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 pb-6 pt-8">
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
              {submitting ? "Vytváranie..." : "Vytvoriť"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
