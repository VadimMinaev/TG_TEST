import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Check, Loader2 } from 'lucide-react';
import { useAiAssistant } from '../lib/ai-assistant-context';

interface Props {
  fieldName: string;
  fieldDescription: string;
  currentValue?: string;
  onApply: (value: string) => void;
}

export function AiFieldAssist({ fieldName, fieldDescription, currentValue, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getFieldSuggestion, selectedBotId } = useAiAssistant();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const result = await getFieldSuggestion(fieldName, prompt.trim(), currentValue);
      setSuggestion(result);
    } catch (err: any) {
      setError(err.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (suggestion) {
      onApply(suggestion);
      setOpen(false);
      setSuggestion(null);
      setPrompt('');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSuggestion(null);
    setPrompt('');
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`AI помочь с полем "${fieldName}"`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '26px', height: '26px', borderRadius: '6px',
          border: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary))',
          cursor: selectedBotId ? 'pointer' : 'default',
          opacity: selectedBotId ? 1 : 0.4, flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => { if (selectedBotId) e.currentTarget.style.borderColor = 'hsl(var(--primary))'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'hsl(var(--border))'; }}
      >
        <Sparkles size={13} style={{ color: 'hsl(var(--primary))' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: '80px', background: 'rgba(0,0,0,0.4)',
          }}
          onClick={handleClose}
        >
          <div
            style={{
              width: '100%', maxWidth: '520px', margin: '0 16px',
              borderRadius: '16px', border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))', padding: '20px',
              boxShadow: '0 20px 60px -12px rgba(0,0,0,0.4)',
              animation: 'fadeIn 0.12s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Sparkles size={18} style={{ color: 'hsl(var(--primary))' }} />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>AI: {fieldName}</span>
              <button onClick={handleClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'hsl(var(--muted-foreground))' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '10px' }}>
              {fieldDescription}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              placeholder="Опишите, что нужно сгенерировать..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))',
                fontSize: '13px', color: 'hsl(var(--foreground))', outline: 'none',
                marginBottom: '10px',
              }}
            />

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              style={{
                padding: '8px 16px', borderRadius: '10px', border: 'none',
                background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))',
                fontSize: '13px', fontWeight: 500, cursor: prompt.trim() && !loading ? 'pointer' : 'default',
                opacity: prompt.trim() && !loading ? 1 : 0.5,
                display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loading ? 'Генерация...' : 'Сгенерировать'}
            </button>

            {error && (
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}>
                {error}
              </div>
            )}

            {suggestion !== null && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'hsl(var(--foreground))' }}>Результат:</div>
                <div style={{
                  padding: '10px 14px', borderRadius: '10px', fontSize: '13px', lineHeight: '1.5',
                  border: '1px solid hsl(var(--border))', background: 'hsl(var(--muted) / 0.3)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace',
                  maxHeight: '200px', overflowY: 'auto', marginBottom: '10px',
                }}>
                  {suggestion}
                </div>
                <button
                  type="button"
                  onClick={handleApply}
                  style={{
                    padding: '8px 16px', borderRadius: '10px', border: 'none',
                    background: 'hsl(var(--success))', color: '#fff',
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <Check size={14} />
                  Применить
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
