import { Power, PowerOff } from 'lucide-react';

interface ToolbarToggleProps {
  enabled: boolean;
  disabled?: boolean;
  onChange: (nextEnabled: boolean) => void;
  title?: string;
}

export function ToolbarToggle({ 
  enabled, 
  disabled = false, 
  onChange, 
  title = enabled ? 'Выключить' : 'Включить'
}: ToolbarToggleProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className="icon-button"
    >
      {enabled ? (
        <Power className="h-4 w-4 text-[hsl(var(--success))]" />
      ) : (
        <PowerOff className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      )}
    </button>
  );
}
