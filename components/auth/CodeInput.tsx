"use client";

import { useRef } from "react";
import { digitsOnly } from "@/lib/format/code";

const LENGTH = 6;

// Six boxes that behave like one field: typing advances, backspace steps back, and pasting a
// whole code fills every box. The real value goes to the form in one hidden input.
export function CodeInput({
  value,
  onChange,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();

  function setDigit(i: number, raw: string) {
    const digits = digitsOnly(raw, LENGTH - i);
    if (!digits) return;
    const chars = value.padEnd(LENGTH, " ").split("");
    for (let k = 0; k < digits.length; k++) chars[i + k] = digits[k];
    onChange(chars.join("").replace(/ /g, "").slice(0, LENGTH));
    focus(i + digits.length);
  }

  return (
    <div role="group" aria-label="6-digit code" className="flex gap-2">
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="field !px-0 text-center text-xl tabular"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={LENGTH}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={value[i] ?? ""}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (value[i]) onChange(value.slice(0, i) + value.slice(i + 1));
              else if (i > 0) {
                onChange(value.slice(0, i - 1) + value.slice(i));
                focus(i - 1);
              }
            } else if (e.key === "ArrowLeft") focus(i - 1);
            else if (e.key === "ArrowRight") focus(i + 1);
          }}
          onPaste={(e) => {
            e.preventDefault();
            const digits = digitsOnly(e.clipboardData.getData("text"));
            if (digits) {
              onChange(digits);
              focus(digits.length);
            }
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
