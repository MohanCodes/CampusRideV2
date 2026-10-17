import { FLEXIBILITY, FLEXIBILITY_LABEL, type Flexibility } from "@/lib/schemas/request";

// "How flexible are you": exactly, plus or minus 30 minutes, plus or minus 1 hour, or any time that day.
export function FlexibilityField({ value, onChange, error }: { value: Flexibility; onChange: (v: Flexibility) => void; error?: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">How flexible are you?</legend>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FLEXIBILITY.map((f) => (
          <li key={f}>
            <label className={`card flex min-h-[48px] cursor-pointer items-center gap-3 px-4 py-2 ${value === f ? "!border-green !bg-mint" : ""}`}>
              <input type="radio" name="flexibility" value={f} checked={value === f} onChange={() => onChange(f)} className="size-4 accent-[var(--green)]" />
              {FLEXIBILITY_LABEL[f]}
            </label>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="field-error">{error}</p>}
    </fieldset>
  );
}
