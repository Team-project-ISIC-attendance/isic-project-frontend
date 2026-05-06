import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  parseSemesterDate,
  formatSemesterDate,
} from "@/features/calendar/semesterDates";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MASK_TEMPLATE = "dd/mm/yyyy";

const WEEKDAY_LABELS = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"] as const;
const MONTH_LABELS = [
  "Január", "Február", "Marec", "Apríl", "Máj", "Jún",
  "Júl", "August", "September", "Október", "November", "December",
] as const;

function getCalendarMonthStart(value: Date): Date {
  const firstDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  const dayOfWeek = firstDay.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  firstDay.setUTCDate(firstDay.getUTCDate() + mondayOffset);
  return firstDay;
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
}

export function formatDisplayDateValue(value: string): string {
  const parsedDate = parseSemesterDate(value);
  if (parsedDate === null) return value;
  const day = String(parsedDate.getUTCDate()).padStart(2, "0");
  const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
  const year = parsedDate.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function parseDisplayDateValue(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match === null) return null;
  const [, dayValue, monthValue, yearValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }
  return formatSemesterDate(parsedDate);
}

export function maskDisplayDateValue(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "";
  if (digits.length < 2) return digits;
  if (digits.length === 2) return `${digits}/`;
  if (digits.length < 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}/${digits.slice(2)}/`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

export interface DatePickerFieldProps {
  id: string;
  label: string;
  value: string;
  inputValue: string;
  error?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  onInputValueChange: (nextValue: string) => void;
  onDateChange: (nextValue: string | null) => void;
  onErrorChange: (nextValue: string) => void;
}

export function DatePickerField({
  id,
  label,
  value,
  inputValue,
  error,
  disabled = false,
  min,
  max,
  onInputValueChange,
  onDateChange,
  onErrorChange,
}: DatePickerFieldProps) {
  const selectedDate = parseSemesterDate(value);
  const minDate = parseSemesterDate(min ?? "");
  const maxDate = parseSemesterDate(max ?? "");
  const [open, setOpen] = useState(false);
  const yearOptions = useMemo(
    () => Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i),
    [],
  );
  const [visibleMonth, setVisibleMonth] = useState<Date>(() =>
    selectedDate
      ? new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1))
      : todayUTC(),
  );

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth(new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1)));
    }
  }, [selectedDate?.getTime()]);

  const cells = useMemo(() => {
    const start = getCalendarMonthStart(visibleMonth);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + i);
      return date;
    });
  }, [visibleMonth]);

  function stepMonth(delta: number) {
    setVisibleMonth((prev) => {
      const next = new Date(prev);
      next.setUTCMonth(prev.getUTCMonth() + delta);
      return next;
    });
  }

  function isDisabledDate(date: Date) {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  }

  function getValidationMessage(nextInputValue: string): string {
    if (nextInputValue.trim() === "") return "";
    if (nextInputValue.length !== 10) return `${label} musí byť vo formáte dd/mm/yyyy`;
    const parsedValue = parseDisplayDateValue(nextInputValue);
    if (parsedValue === null) return `${label} musí byť platný dátum`;
    const parsedDate = parseSemesterDate(parsedValue);
    if (parsedDate === null) return `${label} musí byť platný dátum`;
    const year = parsedDate.getUTCFullYear();
    if (year < MIN_YEAR || year > MAX_YEAR) return `${label} musí mať rok medzi ${MIN_YEAR} a ${MAX_YEAR}`;
    if (minDate && parsedDate < minDate) return `${label} nemôže byť skôr`;
    if (maxDate && parsedDate > maxDate) return `${label} nemôže byť neskôr`;
    return "";
  }

  function handleChange(raw: string) {
    // When backspacing through an auto-inserted slash, also remove the digit before it
    let effective = raw;
    if (
      raw.length < inputValue.length &&
      inputValue.endsWith("/") &&
      raw === inputValue.slice(0, -1)
    ) {
      effective = raw.slice(0, -1);
    }
    const nextValue = maskDisplayDateValue(effective);
    onInputValueChange(nextValue);
    onErrorChange("");
    if (nextValue.trim() === "") { onDateChange(""); return; }
    const parsedValue = parseDisplayDateValue(nextValue);
    onDateChange(parsedValue !== null ? parsedValue : null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      if (!value) {
        // No valid date — navigate calendar to today and clear any partial input
        setVisibleMonth(todayUTC());
        if (inputValue) {
          onInputValueChange("");
          onErrorChange("");
          onDateChange("");
        }
      }
    }
    setOpen(nextOpen);
  }

  // Mask overlay: typed part (dark) + remaining template (light)
  const maskTyped = inputValue;
  const maskRemaining = MASK_TEMPLATE.slice(inputValue.length);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {label && (
        <Label htmlFor={id} className="text-sm font-medium text-[#414651]">
          {label}
        </Label>
      )}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <div
          className={`flex h-10 w-full items-center rounded-lg border bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] transition-colors ${
            disabled
              ? "border-[#e4e7ec] bg-[#f9fafb]"
              : error
              ? "border-[#d92d20] focus-within:border-[#d92d20] focus-within:ring-1 focus-within:ring-[#d92d20]"
              : "border-[#d5d7da] hover:border-[#bfc5d0] focus-within:border-[#1d4ed8] focus-within:ring-1 focus-within:ring-[#1d4ed8]"
          }`}
        >
          {/* Input wrapper with mask overlay */}
          <div className="relative min-w-0 flex-1 self-stretch">
            <input
              id={id}
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={inputValue}
              disabled={disabled}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={() => {
                if (inputValue.trim() === "") { onErrorChange(""); onDateChange(""); return; }
                const validationMessage = getValidationMessage(inputValue);
                onErrorChange(validationMessage);
                if (validationMessage) return;
                const parsedValue = parseDisplayDateValue(inputValue);
                if (parsedValue !== null) {
                  onInputValueChange(formatDisplayDateValue(parsedValue));
                  onDateChange(parsedValue);
                }
              }}
              className={`absolute inset-0 h-full w-full bg-transparent px-3 text-sm outline-none ${
                disabled ? "cursor-not-allowed" : ""
              }`}
              style={{
                color: "transparent",
                caretColor: disabled ? "transparent" : "#181d27",
              }}
            />
            {/* Visible mask overlay (pointer-events:none so input receives clicks) */}
            <div
              className="pointer-events-none absolute inset-0 flex select-none items-center px-3 text-sm"
              aria-hidden
            >
              <span className={`whitespace-pre font-[inherit] ${disabled ? "text-[#98a2b3]" : "text-[#181d27]"}`}>
                {maskTyped}
              </span>
              <span className="whitespace-pre font-[inherit] text-[#bdbdbd]">
                {maskRemaining}
              </span>
            </div>
          </div>

          <PopoverTrigger
            type="button"
            disabled={disabled}
            className={`flex h-full shrink-0 items-center px-2.5 transition-colors ${
              disabled ? "cursor-not-allowed text-[#98a2b3]" : "text-[#737373] hover:bg-[#fafafa]"
            }`}
          >
            <Calendar className="h-4 w-4" />
          </PopoverTrigger>
        </div>

        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-[272px] rounded-2xl border border-[#eaecf0] bg-white p-3 shadow-[0_16px_40px_-18px_rgba(15,23,42,0.24)]"
        >
          {/* Native selects + prev/next buttons — avoids portal collision */}
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#737373] hover:bg-[#f2f4f7]"
            >
              <ChevronLeft size={16} />
            </button>
            <select
              value={String(visibleMonth.getUTCMonth())}
              onChange={(e) =>
                setVisibleMonth(new Date(Date.UTC(visibleMonth.getUTCFullYear(), Number(e.target.value), 1)))
              }
              className="h-8 min-w-0 flex-1 cursor-pointer rounded border border-[#d5d7da] bg-white px-1.5 text-sm text-[#181d27] outline-none focus:border-[#1d4ed8]"
            >
              {MONTH_LABELS.map((month, index) => (
                <option key={month} value={String(index)}>{month}</option>
              ))}
            </select>
            <select
              value={String(visibleMonth.getUTCFullYear())}
              onChange={(e) =>
                setVisibleMonth(new Date(Date.UTC(Number(e.target.value), visibleMonth.getUTCMonth(), 1)))
              }
              className="h-8 w-[76px] cursor-pointer rounded border border-[#d5d7da] bg-white px-1.5 text-sm text-[#181d27] outline-none focus:border-[#1d4ed8]"
            >
              {yearOptions.map((year) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#737373] hover:bg-[#f2f4f7]"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((day) => (
              <div key={day} className="flex h-8 items-center justify-center text-xs font-medium text-[#667085]">
                {day}
              </div>
            ))}
            {cells.map((date) => {
              const outsideMonth = date.getUTCMonth() !== visibleMonth.getUTCMonth();
              const selected = selectedDate ? isSameDay(date, selectedDate) : false;
              const dis = isDisabledDate(date);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  disabled={dis}
                  onClick={() => {
                    const nextValue = formatSemesterDate(date);
                    onInputValueChange(formatDisplayDateValue(nextValue));
                    onErrorChange("");
                    onDateChange(nextValue);
                    setOpen(false);
                  }}
                  className={`flex h-9 items-center justify-center rounded-lg text-sm transition-colors ${
                    outsideMonth ? "text-[#98a2b3]" : ""
                  } ${selected ? "bg-[#1d4ed8] text-white hover:bg-[#1a44c2]" : "text-[#181d27] hover:bg-[#f2f4f7]"} ${
                    dis ? "cursor-not-allowed opacity-35 hover:bg-transparent" : ""
                  }`}
                >
                  {date.getUTCDate()}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
