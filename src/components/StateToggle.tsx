import { useState, useEffect } from 'react';

export interface EntityStateSwitchProps {
  enabled: boolean;
  disabled?: boolean;
  onChange: (nextEnabled: boolean) => void;
  idPrefix: string;
  size?: 'sm' | 'md' | 'lg';
  showStateText?: boolean;
}

export function EntityStateSwitch({
  enabled,
  disabled = false,
  onChange,
  idPrefix,
  size = 'md',
  showStateText = true,
}: EntityStateSwitchProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(enabled);

  // Sync local state with prop changes
  useEffect(() => {
    setLocalEnabled(enabled);
  }, [enabled]);

  const handleChange = async () => {
    if (disabled || isLoading) return;
    
    const nextEnabled = !localEnabled;
    setLocalEnabled(nextEnabled);
    setIsLoading(true);
    
    try {
      await onChange(nextEnabled);
    } catch (error) {
      // Rollback on error
      setLocalEnabled(!nextEnabled);
      console.error('Failed to update status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'w-10 h-5',
    md: 'w-12 h-6',
    lg: 'w-14 h-7',
  };

  const thumbSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const hitAreaClasses = {
    sm: 'min-w-10 min-h-8',
    md: 'min-w-11 min-h-9',
    lg: 'min-w-12 min-h-10',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 ${disabled ? 'opacity-60' : ''}`}>
      <div className="relative inline-block">
        <button
          type="button"
          id={`${idPrefix}-state-toggle`}
          role="switch"
          aria-checked={localEnabled}
          aria-disabled={disabled || isLoading}
          disabled={disabled || isLoading}
          onClick={handleChange}
          className={`relative inline-flex items-center justify-center rounded-md p-1 ${hitAreaClasses[size]} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div 
            className={`relative ${sizeClasses[size]} rounded-full border border-[hsl(var(--border)_/_0.7)] transition-colors duration-300 ease-in-out ${
              localEnabled 
                ? 'bg-[hsl(var(--success))]' 
                : 'bg-[hsl(var(--muted-foreground))]'
            } ${isLoading ? 'opacity-70' : ''}`}
          >
            <div
              className={`absolute top-0.5 left-0.5 transform transition-transform duration-300 ease-in-out ${
                localEnabled ? 'translate-x-full' : 'translate-x-0'
              } ${thumbSizeClasses[size]} rounded-full bg-white shadow-md flex items-center justify-center`}
            >
              {isLoading ? (
                <div className="h-2 w-2 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent"></div>
              ) : null}
            </div>
          </div>
        </button>
        
        {localEnabled && (
          <div className="absolute inset-0 rounded-full pointer-events-none">
            <div className="absolute inset-0 rounded-full bg-[hsl(var(--success)_/_0.3)] opacity-0 animate-[pulse_2s_ease-in-out_infinite]"></div>
          </div>
        )}
      </div>
      {showStateText && (
        <label
          htmlFor={`${idPrefix}-state-toggle`}
          className={`cursor-pointer text-sm font-semibold ${localEnabled ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--muted-foreground))]'}`}
        >
          {localEnabled ? 'Включено' : 'Выключено'}
        </label>
      )}
    </div>
  );
}
