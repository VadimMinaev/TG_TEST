interface StatusRadioProps {
  enabled: boolean;
  disabled?: boolean;
  onChange: (nextEnabled: boolean) => void;
  idPrefix: string;
}

export function StatusRadio({ enabled, disabled = false, onChange, idPrefix }: StatusRadioProps) {
  return (
    <div className="flex items-center gap-6">
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="radio"
          name={`${idPrefix}-status`}
          checked={enabled}
          disabled={disabled}
          onChange={() => onChange(true)}
        />
        <span>Включено</span>
      </label>
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="radio"
          name={`${idPrefix}-status`}
          checked={!enabled}
          disabled={disabled}
          onChange={() => onChange(false)}
        />
        <span>Отключено</span>
      </label>
    </div>
  );
}
