import { forwardRef, InputHTMLAttributes } from 'react';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className = '', label, id, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className={`inline-flex cursor-pointer items-center gap-3 ${
          props.disabled ? 'cursor-not-allowed opacity-50' : ''
        } ${className}`}
      >
        <div className="relative">
          <input ref={ref} type="checkbox" id={id} className="peer sr-only" {...props} />
          <div className="h-6 w-11 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed" />
          <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow-md transition-transform peer-checked:translate-x-5" />
        </div>
        {label && (
          <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </span>
        )}
      </label>
    );
  }
);

Switch.displayName = 'Switch';

export interface EntityStateSwitchProps {
  enabled: boolean;
  disabled?: boolean;
  onChange: (nextEnabled: boolean) => void | Promise<void>;
  idPrefix: string;
  label?: string;
}

export function EntityStateSwitch({ enabled, disabled = false, onChange, idPrefix, label }: EntityStateSwitchProps) {
  return (
    <div className="flex items-center gap-2.5">
      <Switch
        id={`${idPrefix}-enabled`}
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      {label ? (
        <label
          htmlFor={`${idPrefix}-enabled`}
          className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </label>
      ) : null}
    </div>
  );
}
