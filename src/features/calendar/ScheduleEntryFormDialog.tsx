import { useState } from "react";
import type { components } from "@/api/schema";
import { createScheduleEntry, createSubject } from "@/api/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ScheduleEntryResponse = components["schemas"]["ScheduleEntryResponse"];
type SubjectResponse = components["schemas"]["SubjectResponse"];

const DAY_OPTIONS = [
  { value: 0, label: "Po" },
  { value: 1, label: "Ut" },
  { value: 2, label: "St" },
  { value: 3, label: "Št" },
  { value: 4, label: "Pi" },
] as const;

const TIME_OPTIONS = Array.from({ length: 23 }, (_, i) => {
  const hour = 8 + Math.floor(i / 2);
  const min = (i % 2) * 30;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
});

const NEW_SUBJECT_SENTINEL = "__new__";

interface ScheduleEntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: number;
  subjects: SubjectResponse[];
  onCreated: (entry: ScheduleEntryResponse) => void;
  onSubjectCreated: (subject: SubjectResponse) => void;
}

export function ScheduleEntryFormDialog({
  open,
  onOpenChange,
  semesterId,
  subjects,
  onCreated,
  onSubjectCreated,
}: ScheduleEntryFormDialogProps) {
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState("#4CAF50");
  const [dayOfWeek, setDayOfWeek] = useState<number>(0);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [room, setRoom] = useState("");
  const [lessonType, setLessonType] = useState("prednaska");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setSubjectId(null);
    setShowNewSubject(false);
    setNewSubjectName("");
    setNewSubjectCode("");
    setNewSubjectColor("#4CAF50");
    setDayOfWeek(0);
    setStartTime("08:00");
    setEndTime("09:00");
    setRoom("");
    setLessonType("prednaska");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      let resolvedSubjectId = subjectId;

      if (showNewSubject) {
        const newSubject = await createSubject({
          name: newSubjectName,
          code: newSubjectCode,
          color: newSubjectColor,
        });
        resolvedSubjectId = newSubject.id;
        onSubjectCreated(newSubject);
      }

      if (resolvedSubjectId === null) {
        setError("Vyberte predmet");
        setSubmitting(false);
        return;
      }

      const entry = await createScheduleEntry(semesterId, {
        subject_id: resolvedSubjectId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room: room || null,
        lesson_type: lessonType,
      });

      resetForm();
      onOpenChange(false);
      onCreated(entry);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chyba pri vytváraní";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubjectChange(val: string | null) {
    if (val === NEW_SUBJECT_SENTINEL) {
      setShowNewSubject(true);
      setSubjectId(null);
    } else if (val !== null) {
      setShowNewSubject(false);
      setSubjectId(Number(val));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nová rozvrhová jednotka</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Subject */}
          <div className="flex flex-col gap-2">
            <Label>Predmet</Label>
            <Select
              value={
                showNewSubject
                  ? NEW_SUBJECT_SENTINEL
                  : subjectId !== null
                    ? String(subjectId)
                    : undefined
              }
              onValueChange={handleSubjectChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Vyberte predmet">
                  {showNewSubject
                    ? "Nový predmet..."
                    : subjectId !== null
                      ? (() => {
                          const s = subjects.find((sub) => sub.id === subjectId);
                          return s ? `${s.name} (${s.code})` : "Vyberte predmet";
                        })()
                      : "Vyberte predmet"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value={NEW_SUBJECT_SENTINEL}>
                  Nový predmet...
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* New subject inline form */}
          {showNewSubject && (
            <div className="flex flex-col gap-3 rounded-md border border-border-custom p-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-subject-name">Názov predmetu</Label>
                <Input
                  id="new-subject-name"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="napr. Algoritmy"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-subject-code">Kód</Label>
                <Input
                  id="new-subject-code"
                  value={newSubjectCode}
                  onChange={(e) => setNewSubjectCode(e.target.value)}
                  placeholder="napr. ALG"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-subject-color">Farba</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="new-subject-color"
                    type="color"
                    value={newSubjectColor}
                    onChange={(e) => setNewSubjectColor(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-border-custom"
                  />
                  <span className="text-sm text-text-secondary">
                    {newSubjectColor}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Day */}
          <div className="flex flex-col gap-2">
            <Label>Deň</Label>
            <Select value={String(dayOfWeek)} onValueChange={(val) => { if (val !== null) setDayOfWeek(Number(val)); }}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {DAY_OPTIONS.find((d) => d.value === dayOfWeek)?.label ?? "Po"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time range */}
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label>Začiatok</Label>
              <Select value={startTime} onValueChange={(val) => { if (val !== null) setStartTime(val); }}>
                <SelectTrigger className="w-full">
                  <SelectValue>{startTime}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label>Koniec</Label>
              <Select value={endTime} onValueChange={(val) => { if (val !== null) setEndTime(val); }}>
                <SelectTrigger className="w-full">
                  <SelectValue>{endTime}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Room */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-room">Miestnosť</Label>
            <Input
              id="entry-room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="napr. AB150"
            />
          </div>

          {/* Lesson type */}
          <div className="flex flex-col gap-2">
            <Label>Typ</Label>
            <Select value={lessonType} onValueChange={(val) => { if (val !== null) setLessonType(val); }}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {lessonType === "prednaska" ? "Prednáška" : "Cvičenie"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prednaska">Prednáška</SelectItem>
                <SelectItem value="cvicenie">Cvičenie</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Vytváranie..." : "Vytvoriť"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
