"use client";

import { useEffect, useRef, useState } from "react";

// Brojčano polje koje se ponaša normalno i na mobitelu: može se potpuno obrisati (ne ostaje "0" pa ne nastaje "0500"),
// prihvaća i zarez i točku, a broj prema van šalje tek kad je ispravan.
export function NumberField({
  value,
  onChange,
  className = "",
  ...rest
}: { value: number; onChange: (n: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const fmt = (n: number) => (Number.isFinite(n) ? String(n).replace(".", ",") : "");
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  // vanjska promjena (½, 2×, Max, preset) → osvježi tekst
  useEffect(() => {
    const parsed = Number(text.replace(",", "."));
    if (text === "" && focused.current) return;
    if (parsed !== value) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={className}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        if (text.trim() === "" || !Number.isFinite(Number(text.replace(",", ".")))) setText(fmt(value));
        rest.onBlur?.(e);
      }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, "");
        setText(t);
        const n = Number(t.replace(",", "."));
        if (t.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
    />
  );
}
