import type { ReactNode, TextareaHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

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
  format,
  hint,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: ReactNode;
}) {
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
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="slider-value">{format ? format(value) : value}</span>
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
