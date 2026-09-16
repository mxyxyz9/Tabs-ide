import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClockIcon, SparklesIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "./button";

export interface AppleTimePickerProps {
  value?: Date | undefined;
  onChange?: ((date: Date) => void) | undefined;
  onConfirm?: ((date: Date) => void) | undefined;
  onCancel?: (() => void) | undefined;
  className?: string | undefined;
  minDate?: Date | undefined;
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ITEM_HEIGHT = 36; // px height per drum wheel item
const CONTAINER_HEIGHT = 180; // px height for drum wheel area
const PADDING_Y = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2; // 72px to center active item in lens

/**
 * Parses continuous 3-digit or 4-digit time entry strings (e.g. "120" -> 1:20, "0120" -> 1:20, "1230" -> 12:30, "530" -> 5:30)
 */
export function parseTimeDigits(raw: string): { hour: number; minute: number } | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 4) {
    const h = parseInt(digits.slice(0, 2), 10);
    const m = parseInt(digits.slice(2, 4), 10);
    if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      return { hour: h, minute: m };
    }
  } else if (digits.length === 3) {
    const h = parseInt(digits.slice(0, 1), 10);
    const m = parseInt(digits.slice(1, 3), 10);
    if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      return { hour: h, minute: m };
    }
  }
  return null;
}

/**
 * Normalizes hour string on blur, falling back to current valid hour
 */
export function normalizeHourInput(
  val: string,
  fallbackHour: number,
): { hour: number; text: string } {
  const digits = val.replace(/\D/g, "");
  if (!digits) {
    return { hour: fallbackHour, text: String(fallbackHour) };
  }
  const num = parseInt(digits, 10);
  if (num >= 1 && num <= 12) {
    return { hour: num, text: String(num) };
  }
  return { hour: fallbackHour, text: String(fallbackHour) };
}

/**
 * Normalizes minute string on blur to 2-digit format, falling back to current valid minute
 */
export function normalizeMinuteInput(
  val: string,
  fallbackMinute: number,
): { minute: number; text: string } {
  const digits = val.replace(/\D/g, "");
  if (!digits) {
    return {
      minute: fallbackMinute,
      text: fallbackMinute < 10 ? `0${fallbackMinute}` : String(fallbackMinute),
    };
  }
  const num = parseInt(digits, 10);
  if (num >= 0 && num <= 59) {
    return { minute: num, text: num < 10 ? `0${num}` : String(num) };
  }
  return {
    minute: fallbackMinute,
    text: fallbackMinute < 10 ? `0${fallbackMinute}` : String(fallbackMinute),
  };
}

export const AppleTimePicker = memo(function AppleTimePicker({
  value,
  onChange,
  onConfirm,
  onCancel,
  className,
}: AppleTimePickerProps) {
  const initialDate = useMemo(() => {
    if (value && !Number.isNaN(value.getTime())) return new Date(value);
    const d = new Date();
    // Default to nearest 5 minutes
    d.setMinutes(Math.ceil((d.getMinutes() + 5) / 5) * 5, 0, 0);
    return d;
  }, [value]);

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);

  // Sync when value prop changes externally
  useEffect(() => {
    if (value && !Number.isNaN(value.getTime())) {
      setSelectedDate(new Date(value));
    }
  }, [value]);

  // Derive time components
  const hours24 = selectedDate.getHours();
  const isPM = hours24 >= 12;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = selectedDate.getMinutes();

  // Day mode derivation
  const dayMode = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(selectedDate);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "today";
    if (diffDays === 1) return "tomorrow";
    return "custom";
  }, [selectedDate]);

  // Check if selected time on "today" is already in the past
  const isPastToday = useMemo(() => {
    const now = new Date();
    const todayTarget = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours24,
      minutes,
      0,
      0,
    );
    return todayTarget.getTime() <= now.getTime();
  }, [hours24, minutes]);

  // Effective date: If user has 'today' selected but the time is in the past,
  // roll over to tomorrow so scheduled time is NEVER in the past.
  const effectiveDate = useMemo(() => {
    const d = new Date(selectedDate);
    if (dayMode === "today" && isPastToday) {
      const now = new Date();
      d.setFullYear(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
    return d;
  }, [dayMode, isPastToday, selectedDate]);

  const updateDate = useCallback(
    (newDate: Date) => {
      setSelectedDate(newDate);
      onChange?.(newDate);
    },
    [onChange],
  );

  const setHour = useCallback(
    (h12: number) => {
      const next = new Date(selectedDate);
      const next24 = h12 === 12 ? (isPM ? 12 : 0) : isPM ? h12 + 12 : h12;
      next.setHours(next24);
      updateDate(next);
    },
    [isPM, selectedDate, updateDate],
  );

  const setMinute = useCallback(
    (m: number) => {
      const next = new Date(selectedDate);
      next.setMinutes(m);
      next.setSeconds(0, 0);
      updateDate(next);
    },
    [selectedDate, updateDate],
  );

  const setPeriod = useCallback(
    (pm: boolean) => {
      if (pm === isPM) return;
      const next = new Date(selectedDate);
      const current24 = next.getHours();
      if (pm && current24 < 12) {
        next.setHours(current24 + 12);
      } else if (!pm && current24 >= 12) {
        next.setHours(current24 - 12);
      }
      updateDate(next);
    },
    [isPM, selectedDate, updateDate],
  );

  const setDayPreset = useCallback(
    (preset: "today" | "tomorrow") => {
      const next = new Date(selectedDate);
      const now = new Date();
      if (preset === "today") {
        next.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
      } else {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        next.setFullYear(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      }
      updateDate(next);
    },
    [selectedDate, updateDate],
  );

  // Quick preset buttons
  const applyPreset = useCallback(
    (preset: "30m" | "1h" | "quota5am" | "quota12am") => {
      const now = new Date();
      const next = new Date(now);

      if (preset === "30m") {
        next.setMinutes(now.getMinutes() + 30, 0, 0);
      } else if (preset === "1h") {
        next.setHours(now.getHours() + 1, now.getMinutes(), 0, 0);
      } else if (preset === "quota5am") {
        next.setHours(5, 0, 0, 0);
        if (now.getHours() >= 5) {
          next.setDate(next.getDate() + 1);
        }
      } else if (preset === "quota12am") {
        next.setHours(0, 0, 0, 0);
        next.setDate(next.getDate() + 1);
      }

      updateDate(next);
    },
    [updateDate],
  );

  // Live countdown string (never negative)
  const countdownSummary = useMemo(() => {
    const diffMs = effectiveDate.getTime() - Date.now();
    if (diffMs <= 0) return "Will send as soon as turn finishes";
    const diffMins = Math.round(diffMs / (1000 * 60));
    if (diffMins < 60) {
      return `Will send in ~${diffMins} min${diffMins === 1 ? "" : "s"}`;
    }
    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    if (diffHours < 24) {
      const timeStr = `~${diffHours}h ${remMins > 0 ? `${remMins}m` : ""}`.trim();
      if (dayMode === "today" && isPastToday) {
        return `Will send tomorrow (in ${timeStr})`;
      }
      return `Will send in ${timeStr}`;
    }
    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;
    return `Will send in ~${diffDays}d ${remHours}h`;
  }, [dayMode, effectiveDate, isPastToday]);

  // Formatted day string
  const formattedDay = useMemo(() => {
    if (dayMode === "today" && isPastToday) return "Tomorrow";
    if (dayMode === "today") return "Today";
    if (dayMode === "tomorrow") return "Tomorrow";
    return effectiveDate.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [dayMode, effectiveDate, isPastToday]);

  // ── Keyboard Direct Typing State ───────────────────────────────────────────
  const hourInputRef = useRef<HTMLInputElement>(null);
  const minuteInputRef = useRef<HTMLInputElement>(null);
  const [isHourFocused, setIsHourFocused] = useState(false);
  const [isMinuteFocused, setIsMinuteFocused] = useState(false);
  const [hourTypingValue, setHourTypingValue] = useState<string>(String(hours12));
  const [minuteTypingValue, setMinuteTypingValue] = useState<string>(
    minutes < 10 ? `0${minutes}` : String(minutes),
  );

  // Keep typing values in sync when date changes from drum wheel or presets,
  // but never clobber the field the user is actively typing in.
  useEffect(() => {
    if (!isHourFocused) {
      setHourTypingValue(String(hours12));
    }
    if (!isMinuteFocused) {
      setMinuteTypingValue(minutes < 10 ? `0${minutes}` : String(minutes));
    }
  }, [hours12, minutes, isHourFocused, isMinuteFocused]);

  const handleHourInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawVal = e.target.value.replace(/\D/g, "");
      if (!rawVal) {
        setHourTypingValue("");
        return;
      }

      // Check if user entered 3 or 4 digits continuously (e.g. 120 -> 1:20, 0120 -> 1:20, 1230 -> 12:30, 530 -> 5:30)
      if (rawVal.length >= 3) {
        const parsed = parseTimeDigits(rawVal);
        if (parsed) {
          setHour(parsed.hour);
          setMinute(parsed.minute);
          setHourTypingValue(String(parsed.hour));
          setMinuteTypingValue(parsed.minute < 10 ? `0${parsed.minute}` : String(parsed.minute));
          minuteInputRef.current?.focus();
          minuteInputRef.current?.select();
          return;
        }
      }

      // 1 or 2 digits
      const val = rawVal.slice(0, 2);
      const num = parseInt(val, 10);

      // If user typed 0 as first digit, hold it and wait for second digit (e.g. 01..09)
      if (val === "0") {
        setHourTypingValue("0");
        return;
      }

      if (num >= 1 && num <= 12) {
        setHour(num);
        setHourTypingValue(val);
        // If single digit 2..9 (cannot have a 2nd digit in 12h clock), or 2 digits typed,
        // automatically jump to minute input and select it
        if (num >= 2 || val.length >= 2) {
          minuteInputRef.current?.focus();
          minuteInputRef.current?.select();
        }
      } else if (num > 12) {
        // If user typed into an unselected field (e.g. was 1, typed 3 -> "13"),
        // the last typed digit is the user's intended new hour!
        const lastDigit = parseInt(val.charAt(val.length - 1), 10);
        if (lastDigit >= 1 && lastDigit <= 12) {
          setHour(lastDigit);
          setHourTypingValue(String(lastDigit));
          minuteInputRef.current?.focus();
          minuteInputRef.current?.select();
        }
      }
    },
    [setHour, setMinute],
  );

  const handleMinuteInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawVal = e.target.value.replace(/\D/g, "");
      if (!rawVal) {
        setMinuteTypingValue("");
        return;
      }

      // Handle typing into an unselected field: if length > 2, take the last 2 digits
      let val = rawVal;
      if (val.length > 2) {
        val = val.slice(-2);
      }
      setMinuteTypingValue(val);

      const num = parseInt(val, 10);
      if (num >= 0 && num <= 59) {
        setMinute(num);
      }
    },
    [setMinute],
  );

  const handleHourBlur = useCallback(() => {
    setIsHourFocused(false);
    const { hour, text } = normalizeHourInput(hourTypingValue, hours12);
    setHour(hour);
    setHourTypingValue(text);
  }, [hourTypingValue, hours12, setHour]);

  const handleMinuteBlur = useCallback(() => {
    setIsMinuteFocused(false);
    const { minute, text } = normalizeMinuteInput(minuteTypingValue, minutes);
    setMinute(minute);
    setMinuteTypingValue(text);
  }, [minuteTypingValue, minutes, setMinute]);

  const handleHourKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const nextH = hours12 === 12 ? 1 : hours12 + 1;
        setHour(nextH);
        setHourTypingValue(String(nextH));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextH = hours12 === 1 ? 12 : hours12 - 1;
        setHour(nextH);
        setHourTypingValue(String(nextH));
      } else if (e.key === ":" || e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        minuteInputRef.current?.focus();
        minuteInputRef.current?.select();
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        setPeriod(false);
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setPeriod(true);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm?.(effectiveDate);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
      }
    },
    [effectiveDate, hours12, onCancel, onConfirm, setHour, setPeriod],
  );

  const handleMinuteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const nextM = (minutes + (e.shiftKey ? 5 : 1)) % 60;
        setMinute(nextM);
        setMinuteTypingValue(nextM < 10 ? `0${nextM}` : String(nextM));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextM = (minutes - (e.shiftKey ? 5 : 1) + 60) % 60;
        setMinute(nextM);
        setMinuteTypingValue(nextM < 10 ? `0${nextM}` : String(nextM));
      } else if (e.key === "ArrowLeft" || (e.key === "Backspace" && !minuteTypingValue)) {
        e.preventDefault();
        hourInputRef.current?.focus();
        hourInputRef.current?.select();
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        setPeriod(false);
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setPeriod(true);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm?.(effectiveDate);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
      }
    },
    [effectiveDate, minuteTypingValue, minutes, onCancel, onConfirm, setMinute, setPeriod],
  );

  return (
    <div
      className={cn(
        "flex w-[320px] flex-col rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-2xl overflow-hidden select-none p-4",
        className,
      )}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel?.();
        }
      }}
    >
      {/* Top Header Bar matching Apple layout with interactive typing input */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <ClockIcon className="size-4 text-primary" />
          <span className="text-sm font-semibold tracking-tight text-foreground">Time</span>
        </div>

        {/* Interactive Segmented Time Pill (Apple-style directly editable numbers) */}
        <div className="flex items-center rounded-xl border border-border/70 bg-muted/40 px-2 py-0.5 shadow-xs focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary transition-all">
          <span className="mr-1.5 text-[11px] font-semibold text-muted-foreground select-none">
            {formattedDay},
          </span>

          {/* Hour input */}
          <input
            ref={hourInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={hourTypingValue}
            onChange={handleHourInputChange}
            onKeyDown={handleHourKeyDown}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            onFocus={(e) => {
              setIsHourFocused(true);
              e.target.select();
            }}
            onBlur={handleHourBlur}
            className="w-6 bg-transparent text-center font-mono text-xs font-bold text-foreground outline-none select-all"
            aria-label="Hours"
          />

          <span className="font-mono text-xs font-bold text-muted-foreground select-none">:</span>

          {/* Minute input */}
          <input
            ref={minuteInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={minuteTypingValue}
            onChange={handleMinuteInputChange}
            onKeyDown={handleMinuteKeyDown}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            onFocus={(e) => {
              setIsMinuteFocused(true);
              e.target.select();
            }}
            onBlur={handleMinuteBlur}
            className="w-6 bg-transparent text-center font-mono text-xs font-bold text-foreground outline-none select-all"
            aria-label="Minutes"
          />

          {/* AM / PM switcher pill */}
          <button
            type="button"
            onClick={() => setPeriod(!isPM)}
            className="ml-1 rounded px-1 text-[11px] font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer select-none"
            title="Toggle AM / PM (or press A / P)"
          >
            {isPM ? "PM" : "AM"}
          </button>
        </div>
      </div>

      {/* Day Selector Chips */}
      <div className="mt-3 flex items-center justify-between gap-1 rounded-xl bg-muted/60 p-1">
        <button
          type="button"
          onClick={() => setDayPreset("today")}
          className={cn(
            "flex-1 rounded-lg py-1 text-xs font-medium transition-all cursor-pointer",
            dayMode === "today"
              ? "bg-background text-foreground shadow-xs ring-1 ring-border/50 font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setDayPreset("tomorrow")}
          className={cn(
            "flex-1 rounded-lg py-1 text-xs font-medium transition-all cursor-pointer",
            dayMode === "tomorrow"
              ? "bg-background text-foreground shadow-xs ring-1 ring-border/50 font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Tomorrow
        </button>
      </div>

      {/* Apple-style 3-Column Drum Wheel Container */}
      <div
        className="relative my-3.5 flex items-center justify-center overflow-hidden rounded-xl bg-muted/20 px-2"
        style={{ height: `${CONTAINER_HEIGHT}px` }}
      >
        {/* Central Selection Highlight Lens (Precisely centered) */}
        <div
          className="pointer-events-none absolute inset-x-2 rounded-xl bg-muted/80 ring-1 ring-border/60 shadow-xs"
          style={{
            top: `${PADDING_Y}px`,
            height: `${ITEM_HEIGHT}px`,
          }}
        />

        {/* Top and Bottom Gradient Opacity Mask for authentic Apple drum depth */}
        <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-popover via-transparent to-popover" />

        {/* Column 1: Hours Drum */}
        <div className="relative z-10 flex-1 h-full">
          <WheelColumn
            items={HOURS}
            selectedValue={hours12}
            onSelect={setHour}
            format={(h) => `${h}`}
          />
        </div>

        {/* Separator Colon */}
        <div className="relative z-10 flex items-center px-1 font-mono text-base font-bold text-muted-foreground select-none">
          :
        </div>

        {/* Column 2: Minutes Drum */}
        <div className="relative z-10 flex-1 h-full">
          <WheelColumn
            items={MINUTES}
            selectedValue={minutes}
            onSelect={setMinute}
            format={(m) => (m < 10 ? `0${m}` : `${m}`)}
          />
        </div>

        {/* Column 3: AM / PM Segmented Selector */}
        <div className="relative z-10 flex w-13 flex-col items-center justify-center gap-1 pl-1">
          <button
            type="button"
            onClick={() => setPeriod(false)}
            className={cn(
              "w-full rounded-lg py-1 text-center text-xs font-bold transition-all cursor-pointer",
              !isPM
                ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/60"
                : "text-muted-foreground hover:text-foreground bg-muted/40",
            )}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => setPeriod(true)}
            className={cn(
              "w-full rounded-lg py-1 text-center text-xs font-bold transition-all cursor-pointer",
              isPM
                ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/60"
                : "text-muted-foreground hover:text-foreground bg-muted/40",
            )}
          >
            PM
          </button>
        </div>
      </div>

      {/* Common Presets for AI Coding Workflows */}
      <div className="space-y-1.5 pb-2">
        <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <SparklesIcon className="size-3 text-primary" />
          <span>Quick presets</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset("30m")}
            className="rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors cursor-pointer"
          >
            ⚡ In 30 mins
          </button>
          <button
            type="button"
            onClick={() => applyPreset("1h")}
            className="rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors cursor-pointer"
          >
            ⏰ In 1 hour
          </button>
          <button
            type="button"
            onClick={() => applyPreset("quota5am")}
            className="rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors cursor-pointer"
          >
            🌅 5:00 AM (Quota)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("quota12am")}
            className="rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors cursor-pointer"
          >
            🌙 Midnight (12 AM)
          </button>
        </div>
      </div>

      {/* Countdown summary (Always positive) */}
      <div className="mt-1 rounded-lg bg-muted/40 px-2.5 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
        {countdownSummary}
      </div>

      {/* Bottom Actions */}
      <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-border/50">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => onConfirm?.(effectiveDate)}
          className="h-7 px-3 text-xs font-semibold cursor-pointer"
        >
          Confirm Schedule
        </Button>
      </div>
    </div>
  );
});

interface WheelColumnProps<T extends number> {
  items: readonly T[];
  selectedValue: T;
  onSelect: (val: T) => void;
  format: (val: T) => string;
}

function WheelColumn<T extends number>({
  items,
  selectedValue,
  onSelect,
  format,
}: WheelColumnProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserInteractingRef = useRef(false);
  const userInteractionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = useMemo(() => {
    return items.indexOf(selectedValue);
  }, [items, selectedValue]);

  // Center selected item smoothly in container when NOT user scrolling
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isUserInteractingRef.current) return;
    const targetScrollTop = selectedIndex * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - targetScrollTop) > 1) {
      el.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    }
  }, [selectedIndex]);

  const markUserInteracting = useCallback(() => {
    isUserInteractingRef.current = true;
    if (userInteractionTimerRef.current) {
      clearTimeout(userInteractionTimerRef.current);
    }
  }, []);

  // Handle scroll events with snapping detection
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Only process scroll and call onSelect if the user actually initiated the scroll!
    if (!isUserInteractingRef.current) {
      return;
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      isUserInteractingRef.current = false;
      const nearestIdx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clampedIdx = Math.max(0, Math.min(items.length - 1, nearestIdx));
      const nextVal = items[clampedIdx];
      if (nextVal !== undefined && nextVal !== selectedValue) {
        onSelect(nextVal);
      }
      // Snap exactly to target
      el.scrollTo({ top: clampedIdx * ITEM_HEIGHT, behavior: "smooth" });
    }, 100);
  }, [items, onSelect, selectedValue]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onWheel={markUserInteracting}
      onPointerDown={markUserInteracting}
      onTouchStart={markUserInteracting}
      style={{
        paddingTop: `${PADDING_Y}px`,
        paddingBottom: `${PADDING_Y}px`,
      }}
      className="h-full w-full overflow-y-auto overscroll-contain snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item, idx) => {
        const isSelected = item === selectedValue;
        const dist = Math.abs(idx - selectedIndex);

        return (
          <div
            key={item}
            onClick={() => onSelect(item)}
            style={{ height: `${ITEM_HEIGHT}px` }}
            className={cn(
              "flex items-center justify-center font-mono text-center transition-all cursor-pointer select-none snap-center",
              isSelected
                ? "text-base font-bold text-foreground scale-105"
                : dist === 1
                  ? "text-sm font-medium text-muted-foreground/70 scale-95"
                  : "text-xs text-muted-foreground/40 scale-90",
            )}
          >
            {format(item)}
          </div>
        );
      })}
    </div>
  );
}
