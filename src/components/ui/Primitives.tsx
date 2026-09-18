import { useRef, useState, type ReactNode, type TextareaHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { clamp, cn } from '@/lib/utils';

export function Field({
  label,
  hint,
  children,
  action,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <label className="field">
      {(label || action) && (
        <span className="field-label">
          {label}
          {action && <span className="spacer" />}
          {action}
        </span>
      )}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('input', props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('textarea', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('select', props.className)} />;
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="field">
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="switch-track" />
        <span className="switch-label">{label}</span>
      </label>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  hint,
  unit,
  precision = 0,
  maxInput,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  hint?: ReactNode;
  /** Shown after the number, e.g. px or %. */
  unit?: string;
  /** Decimal places for the readout. */
  precision?: number;
  /** Ceiling for typed values, when the track has to stop short of it. */
  maxInput?: number;
}) {
  // The box is text, not <input type="number">: browsers report an empty value
  // for half-typed decimals like "0." and that fights a controlled input.
  const [draft, setDraft] = useState<string | null>(null);
  // Escape blurs the box, and blur normally commits — this skips that one time.
  const cancelled = useRef(false);
  const shown = draft ?? (precision ? value.toFixed(precision) : String(value));

  const commit = (raw: string) => {
    setDraft(null);
    const parsed = Number(raw.replace(',', '.').trim());
    if (!raw.trim() || !Number.isFinite(parsed)) return;
    const next = clamp(parsed, min, maxInput ?? max);
    if (next !== value) onChange(next);
  };

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="slider-row">
        <input
          className="slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            setDraft(null);
            onChange(Number(event.target.value));
          }}
          aria-hidden
          tabIndex={-1}
        />
        <span className="slider-entry">
          <input
            className="slider-number"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={shown}
            size={Math.max(3, shown.length)}
            aria-label={typeof label === 'string' ? label : undefined}
            onChange={(event) => setDraft(event.target.value.replace(/[^0-9.,-]/g, ''))}
            onFocus={(event) => event.target.select()}
            onBlur={(event) => {
              if (cancelled.current) {
                cancelled.current = false;
                setDraft(null);
                return;
              }
              commit(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === 'Escape') {
                cancelled.current = true;
                setDraft(null);
                event.currentTarget.blur();
              } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                const delta = event.key === 'ArrowUp' ? step : -step;
                setDraft(null);
                onChange(clamp(Number((value + delta).toFixed(6)), min, max));
              }
            }}
          />
          {unit && <span className="slider-unit">{unit}</span>}
        </span>
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label?: ReactNode;
}) {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div className="segmented" role="group">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A switch that is a button, not a label-wrapped checkbox — so it can live
 * inside a <summary> without also toggling the disclosure.
 */
export function ToggleButton({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      className="switch-track switch-button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onChange(!checked);
      }}
      data-on={checked ? 'true' : 'false'}
    />
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden />;
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title?: ReactNode; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon}
      {title && <strong>{title}</strong>}
      <span className="small">{body}</span>
      {action}
    </div>
  );
}

export function Section({ title, children, action }: { title?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="section">
      {(title || action) && (
        <header className="row">
          {title && <h3 className="section-title">{title}</h3>}
          <span className="spacer" />
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
