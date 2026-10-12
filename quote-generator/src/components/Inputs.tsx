import { useState, type InputHTMLAttributes } from "react";
import { formatMoneyInput, formatQuantity, parseDecimal, parseMoney } from "../quote";

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">;

/**
 * Text field for Brazilian money ("1.234,56"). Keeps what the user types while focused and
 * reformats on blur; the parent always receives integer cents.
 */
export function MoneyInput({ cents, onCents, ...rest }: Base & { cents: number; onCents: (c: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const invalid = text !== null && parseMoney(text) === null && text.trim() !== "";
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={text ?? formatMoneyInput(cents)}
      aria-invalid={invalid || undefined}
      onFocus={(e) => {
        setText(formatMoneyInput(cents));
        rest.onFocus?.(e);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parseMoney(e.target.value);
        if (parsed !== null && parsed >= 0) onCents(parsed);
        else if (e.target.value.trim() === "") onCents(0);
      }}
      onBlur={(e) => {
        setText(null);
        rest.onBlur?.(e);
      }}
    />
  );
}

/** Decimal field ("2,5") limited to [min, max]. */
export function DecimalInput({ value, onValue, min = 0, max = Infinity, ...rest }: Base & { value: number; onValue: (n: number) => void; min?: number; max?: number }) {
  const [text, setText] = useState<string | null>(null);
  const parsed = text === null ? value : parseDecimal(text);
  const invalid = text !== null && text.trim() !== "" && (parsed === null || parsed < min || parsed > max);
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={text ?? formatQuantity(value)}
      aria-invalid={invalid || undefined}
      onFocus={(e) => {
        setText(formatQuantity(value));
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseDecimal(e.target.value);
        if (n !== null && n >= min && n <= max) onValue(n);
      }}
      onBlur={() => setText(null)}
    />
  );
}
