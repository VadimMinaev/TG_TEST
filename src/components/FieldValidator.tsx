import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

interface ValidationRule {
  condition: (value: any) => boolean;
  message: string;
  level?: 'error' | 'warning' | 'success';
}

interface FieldValidatorProps {
  value: any;
  rules: ValidationRule[];
  fieldName?: string;
  children: React.ReactNode;
}

export function FieldValidator({ value, rules, fieldName, children }: FieldValidatorProps) {
  const [validationResults, setValidationResults] = useState<{ isValid: boolean; messages: { message: string; level: 'error' | 'warning' | 'success' }[] }>({ 
    isValid: true, 
    messages: [] 
  });

  useEffect(() => {
    const results = rules.map(rule => ({
      isValid: rule.condition(value),
      message: rule.message,
      level: rule.level || 'error'
    }));

    const isValid = results.every(result => result.isValid);
    const messages = results
      .filter(result => !result.isValid)
      .map(result => ({ message: result.message, level: result.level }));

    setValidationResults({ isValid, messages });
  }, [value, rules]);

  return (
    <div className="space-y-2">
      {children}
      {validationResults.messages.length > 0 && (
        <div className="space-y-1">
          {validationResults.messages.map((msg, index) => (
            <div 
              key={index} 
              className={cn(
                'flex items-start gap-2 text-sm',
                msg.level === 'error' && 'text-destructive',
                msg.level === 'warning' && 'text-yellow-600 dark:text-yellow-400',
                msg.level === 'success' && 'text-success'
              )}
            >
              {msg.level === 'error' && <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
              {msg.level === 'warning' && <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
              {msg.level === 'success' && <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />}
              <span>{msg.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Валидаторы для общего использования
export const validators = {
  required: (message = 'Поле обязательно для заполнения'): ValidationRule => ({
    condition: (value) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    },
    message,
    level: 'error'
  }),
  
  minLength: (min: number, message?: string): ValidationRule => ({
    condition: (value) => {
      if (typeof value === 'string') return value.length >= min;
      if (Array.isArray(value)) return value.length >= min;
      return true;
    },
    message: message || `Минимальная длина: ${min} символов`,
    level: 'error'
  }),
  
  maxLength: (max: number, message?: string): ValidationRule => ({
    condition: (value) => {
      if (typeof value === 'string') return value.length <= max;
      if (Array.isArray(value)) return value.length <= max;
      return true;
    },
    message: message || `Максимальная длина: ${max} символов`,
    level: 'warning'
  }),
  
  pattern: (regex: RegExp, message: string): ValidationRule => ({
    condition: (value) => {
      if (typeof value !== 'string') return true;
      return regex.test(value);
    },
    message,
    level: 'error'
  }),
  
  email: (message = 'Некорректный email'): ValidationRule => ({
    condition: (value) => {
      if (typeof value !== 'string') return true;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
    message,
    level: 'error'
  }),
  
  url: (message = 'Некорректный URL'): ValidationRule => ({
    condition: (value) => {
      if (typeof value !== 'string') return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message,
    level: 'error'
  }),
  
  custom: (validator: (value: any) => boolean, message: string, level: 'error' | 'warning' | 'success' = 'error'): ValidationRule => ({
    condition: validator,
    message,
    level
  })
};