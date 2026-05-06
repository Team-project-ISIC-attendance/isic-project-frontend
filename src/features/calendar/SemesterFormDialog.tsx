import { useEffect, useState } from "react";
import {
  FolderPlus,
  X,
  Minus,
  Plus,
} from "lucide-react";
import type { components } from "@/api/schema";
import { createSemester } from "@/api/calendar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DatePickerField,
  formatDisplayDateValue,
  parseDisplayDateValue,
} from "@/components/ui/date-picker-field";
import {
  clampWeekCount,
  getEndDateFromWeeks,
  getWeekCountFromRange,
  parseSemesterDate,
} from "@/features/calendar/semesterDates";

type SemesterResponse = components["schemas"]["SemesterResponse"];
const DEFAULT_TOTAL_WEEKS = 13;
const MIN_DATE = "2000-01-01";
const MAX_DATE = "2100-12-31";
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

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
  const [startDateInput, setStartDateInput] = useState("");
  const [startDateInputError, setStartDateInputError] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [endDateInputError, setEndDateInputError] = useState("");
  const [totalWeeks, setTotalWeeks] = useState(DEFAULT_TOTAL_WEEKS);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const hasValidStartDate = startDate !== "";

  function resetForm() {
    setName("");
    setStartDate("");
    setStartDateInput("");
    setStartDateInputError("");
    setEndDate("");
    setEndDateInput("");
    setEndDateInputError("");
    setTotalWeeks(DEFAULT_TOTAL_WEEKS);
    setError("");
  }

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  function handleStartDateChange(nextStartDate: string | null) {
    if (nextStartDate === null) {
      setStartDate("");
      setEndDate("");
      setEndDateInput("");
      setEndDateInputError("");
      return;
    }

    setStartDate(nextStartDate);
    setStartDateInput(nextStartDate ? formatDisplayDateValue(nextStartDate) : "");
    setStartDateInputError("");
    setError("");

    if (!nextStartDate) {
      setEndDate("");
      setEndDateInput("");
      setEndDateInputError("");
      setTotalWeeks(DEFAULT_TOTAL_WEEKS);
      return;
    }

    if (endDate) {
      const nextWeeks = getWeekCountFromRange(nextStartDate, endDate);
      if (nextWeeks !== null) {
        setTotalWeeks(nextWeeks);
        return;
      }
    }

    const computedEndDate = getEndDateFromWeeks(nextStartDate, totalWeeks);
    setEndDate(computedEndDate);
    setEndDateInput(formatDisplayDateValue(computedEndDate));
  }

  function handleEndDateChange(nextEndDate: string | null) {
    if (nextEndDate === null) {
      setEndDate("");
      return;
    }

    setEndDate(nextEndDate);
    setEndDateInput(nextEndDate ? formatDisplayDateValue(nextEndDate) : "");
    setEndDateInputError("");
    setError("");

    if (!startDate || !nextEndDate) return;

    const nextWeeks = getWeekCountFromRange(startDate, nextEndDate);
    if (nextWeeks !== null) {
      setTotalWeeks(nextWeeks);
    }
  }

  function handleTotalWeeksChange(nextWeeks: number) {
    const clampedWeeks = clampWeekCount(nextWeeks);
    setTotalWeeks(clampedWeeks);
    setError("");

    if (!startDate) return;
    const computedEndDate = getEndDateFromWeeks(startDate, clampedWeeks);
    setEndDate(computedEndDate);
    setEndDateInput(formatDisplayDateValue(computedEndDate));
  }

  function validateDateYear(value: string, label: string): string | null {
    const parsedDate = parseSemesterDate(value);
    if (parsedDate === null) {
      return `Neplatný dátum pre pole ${label.toLowerCase()}`;
    }

    const year = parsedDate.getUTCFullYear();
    if (year < MIN_YEAR || year > MAX_YEAR) {
      return `${label} musí mať rok medzi ${MIN_YEAR} a ${MAX_YEAR}`;
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (startDateInputError) {
      setError(startDateInputError);
      return;
    }

    if (endDateInputError) {
      setError(endDateInputError);
      return;
    }

    const parsedStartDateInput = parseDisplayDateValue(startDateInput);
    if (!startDateInput.trim() || parsedStartDateInput === null) {
      setError("Začiatok musí byť vo formáte dd/mm/yyyy");
      return;
    }

    const parsedEndDateInput = parseDisplayDateValue(endDateInput);
    if (!endDateInput.trim() || parsedEndDateInput === null) {
      setError("Koniec musí byť vo formáte dd/mm/yyyy");
      return;
    }

    const submittedStartDate = parsedStartDateInput;
    const submittedEndDate = parsedEndDateInput;
    const computedWeeks = getWeekCountFromRange(
      submittedStartDate,
      submittedEndDate,
    );
    const startDateError = validateDateYear(submittedStartDate, "Začiatok");
    if (startDateError !== null) {
      setError(startDateError);
      return;
    }

    const endDateError = validateDateYear(submittedEndDate, "Koniec");
    if (endDateError !== null) {
      setError(endDateError);
      return;
    }

    if (computedWeeks === null) {
      setError("Dátum začiatku musí byť pred dátumom konca");
      return;
    }

    setSubmitting(true);

    try {
      const semester = await createSemester({
        name,
        start_date: submittedStartDate,
        end_date: submittedEndDate,
        total_weeks: computedWeeks,
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
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="napr. 25/26 LS"
                  required
                  className="h-10 w-full rounded-lg border border-[#d5d7da] bg-white px-3 py-2 text-sm shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] outline-none placeholder:text-[#a3a3a3] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]"
                />
              </div>

              {/* Date row */}
              <div className="grid grid-cols-2 gap-3">
                <DatePickerField
                  id="semester-start"
                  label="Začiatok"
                  value={startDate}
                  inputValue={startDateInput}
                  error={startDateInputError}
                  min={MIN_DATE}
                  max={MAX_DATE}
                  onInputValueChange={setStartDateInput}
                  onDateChange={handleStartDateChange}
                  onErrorChange={setStartDateInputError}
                />
                <DatePickerField
                  id="semester-end"
                  label="Koniec"
                  value={endDate}
                  inputValue={endDateInput}
                  error={endDateInputError}
                  disabled={!hasValidStartDate}
                  min={startDate || MIN_DATE}
                  max={MAX_DATE}
                  onInputValueChange={setEndDateInput}
                  onDateChange={handleEndDateChange}
                  onErrorChange={setEndDateInputError}
                />
              </div>

              {/* Počet týždňov stepper */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-[#414651]">
                  Počet týždňov
                </Label>
                <div className="flex w-[151px] items-center rounded-lg border border-[#d5d7da] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                  <button
                    type="button"
                    onClick={() => handleTotalWeeksChange(totalWeeks - 1)}
                    disabled={!hasValidStartDate}
                    className="rounded-l-lg border-r border-[#d5d7da] px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Minus size={20} className="text-[#171717]" />
                  </button>
                  <div className="flex-1 border-r border-[#d5d7da] py-2.5 text-center text-base text-[#181d27]">
                    {totalWeeks}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTotalWeeksChange(totalWeeks + 1)}
                    disabled={!hasValidStartDate}
                    className="rounded-r-lg px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={20} className="text-[#171717]" />
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>

            {/* Footer */}
            <div className="shrink-0 bg-white flex gap-3 px-6 pb-6 pt-8">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
