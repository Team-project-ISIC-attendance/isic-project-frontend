import { useState } from "react";
import { FolderPlus, X, Minus, Plus, Calendar } from "lucide-react";
import type { components } from "@/api/schema";
import { createSemester } from "@/api/calendar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (startDate && endDate && startDate > endDate) {
      setError("Dátum začiatku musí byť pred dátumom konca");
      return;
    }

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
      const message =
        err instanceof Error ? err.message : "Chyba pri vytváraní";
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] overflow-hidden p-0 gap-0 sm:max-w-[480px]"
      >
        <div className="flex max-h-[90vh] flex-col">
          {/* Header */}
          <div className="shrink-0 bg-white pt-6 px-6 pb-5">
            {/* Custom X close button */}
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="absolute right-4 top-4 rounded-lg p-2.5 text-[#737373] hover:bg-[#f5f5f5]"
            >
              <X size={24} />
            </button>

            <div className="flex flex-col gap-4">
              {/* Featured icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-[#e5e5e5] shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
                <FolderPlus size={22} className="text-[#171717]" />
              </div>

              {/* Title + Subtitle */}
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-[#171717] leading-7">
                  Nový semester
                </h2>
                <p className="text-sm font-normal text-[#525252] leading-5">
                  Vyplňte všetky potrebné polia a následne môžete vytvoriť nový
                  semester.
                </p>
              </div>
            </div>
          </div>

          {/* Form content */}
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6">
              {/* Názov */}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="semester-name"
                  className="text-sm font-medium text-[#414651]"
                >
                  Názov
                </Label>
                <input
                  id="semester-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="napr. 25/26 LS"
                  required
                  className="h-10 w-full rounded-lg border border-[#d5d7da] bg-white px-3 py-2 text-sm shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] outline-none placeholder:text-[#a3a3a3] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]"
                />
              </div>

              {/* Date row */}
              <div className="flex gap-4">
                {/* Začiatok */}
                <div className="flex flex-1 flex-col gap-2">
                  <Label
                    htmlFor="semester-start"
                    className="text-sm font-medium text-[#414651]"
                  >
                    Začiatok
                  </Label>
                  <div className="flex items-center rounded-lg border border-[#d5d7da] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                    <input
                      id="semester-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="h-10 flex-1 appearance-none bg-transparent px-3 py-2 text-sm outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                    <div className="px-3">
                      <Calendar size={16} className="text-[#737373]" />
                    </div>
                  </div>
                </div>

                {/* Koniec */}
                <div className="flex flex-1 flex-col gap-2">
                  <Label
                    htmlFor="semester-end"
                    className="text-sm font-medium text-[#414651]"
                  >
                    Koniec
                  </Label>
                  <div className="flex items-center rounded-lg border border-[#d5d7da] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                    <input
                      id="semester-end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="h-10 flex-1 appearance-none bg-transparent px-3 py-2 text-sm outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                    <div className="px-3">
                      <Calendar size={16} className="text-[#737373]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Počet týždňov stepper */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-[#414651]">
                  Počet týždňov
                </Label>
                <div className="flex w-[151px] items-center rounded-lg border border-[#d5d7da] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                  <button
                    type="button"
                    onClick={() => setTotalWeeks(Math.max(1, totalWeeks - 1))}
                    className="rounded-l-lg border-r border-[#d5d7da] px-3 py-2.5"
                  >
                    <Minus size={20} className="text-[#171717]" />
                  </button>
                  <div className="flex-1 border-r border-[#d5d7da] py-2.5 text-center text-base text-[#181d27]">
                    {totalWeeks}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTotalWeeks(Math.min(52, totalWeeks + 1))}
                    className="rounded-r-lg px-3 py-2.5"
                  >
                    <Plus size={20} className="text-[#171717]" />
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>

            {/* Footer */}
            <div className="shrink-0 bg-white flex justify-end px-6 pt-8 pb-6">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#1d4ed8] px-[18px] py-2.5 text-base font-semibold text-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] hover:bg-[#1a44c2] disabled:opacity-50"
              >
                {submitting ? "Vytváranie..." : "Vytvoriť"}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
