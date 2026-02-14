import { useState, useEffect } from 'react';

interface StateToggleProps {
  enabled: boolean;
  disabled?: boolean;
  onChange: (nextEnabled: boolean) => void;
  idPrefix: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StateToggle({ enabled, disabled = false, onChange, idPrefix, size = 'md' }: StateToggleProps) {
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
    sm: 'w-10 h-5 rounded-full',
    md: 'w-12 h-6 rounded-full',
    lg: 'w-14 h-7 rounded-full',
  };

  const thumbSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="relative inline-block">
      <label 
        htmlFor={`${idPrefix}-state-toggle`} 
        className={`relative inline-flex cursor-pointer items-center ${sizeClasses[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          type="checkbox"
          id={`${idPrefix}-state-toggle`}
          checked={localEnabled}
          disabled={disabled || isLoading}
          onChange={handleChange}
          className="sr-only"
        />
        <div 
          className={`absolute inset-0 rounded-full transition-colors duration-300 ease-in-out ${
            localEnabled 
              ? 'bg-[hsl(var(--success)_/_0.3)]' 
              : 'bg-[hsl(var(--destructive)_/_0.2)]'
          } ${isLoading ? 'opacity-70' : ''}`}
        ></div>
        <div 
          className={`absolute top-0.5 left-0.5 transform transition-transform duration-300 ease-in-out ${
            localEnabled ? 'translate-x-full' : 'translate-x-0'
          } ${thumbSizeClasses[size]} rounded-full bg-white shadow-md flex items-center justify-center`}
        >
          {isLoading ? (
            <div className="h-2 w-2 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent"></div>
          ) : (
            <span className={`text-xs font-bold ${localEnabled ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>
              {localEnabled ? 'ON' : 'OFF'}
            </span>
          )}
        </div>
      </label>
      
      {/* Subtle animation effect when enabled */}
      {localEnabled && (
        <div className="absolute inset-0 rounded-full pointer-events-none">
          <div className="absolute inset-0 rounded-full bg-[hsl(var(--success)_/_0.1)] animate-pulse rounded-full opacity-0 animate-[pulse_2s_ease-in-out_infinite]"></div>
        </div>
      )}
    </div>
  );
}