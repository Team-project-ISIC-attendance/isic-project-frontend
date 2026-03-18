import { useState } from "react";
import type { components } from "@/api/schema";
import { createSemester } from "@/api/calendar";
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

type SemesterResponse = components["schemas"]["SemesterResponse"];

interface SemesterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (semester: SemesterResponse) => void;
}

export function SemesterFormDialog({
  open,
  onOpenChange,
  onCreated,
}: SemesterFormDialogProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalWeeks, setTotalWeeks] = useState(13);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName("");
    setStartDate("");
    setEndDate("");
    setTotalWeeks(13);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const semester = await createSemester({
        name,
        start_date: startDate,
        end_date: endDate,
        total_weeks: totalWeeks,
      });
      resetForm();
      onOpenChange(false);
      onCreated(semester);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chyba pri vytváraní";
      if (message.includes("409")) {
        setError("Semester s týmto názvom už existuje");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nový semester</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="semester-name">Názov</Label>
            <Input
              id="semester-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="napr. 25/26 LS"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="semester-start">Začiatok</Label>
            <Input
              id="semester-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="semester-end">Koniec</Label>
            <Input
              id="semester-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="semester-weeks">Počet týždňov</Label>
            <Input
              id="semester-weeks"
              type="number"
              min={1}
              max={52}
              value={totalWeeks}
              onChange={(e) => setTotalWeeks(Number(e.target.value))}
              required
            />
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
