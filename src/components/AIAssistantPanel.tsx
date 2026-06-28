import { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, Send, X, MessageSquare, Loader2 } from 'lucide-react';
import { useAiAssistant } from '../lib/ai-assistant-context';

export function AiAssistantToggle() {
  const { isOpen, togglePanel, botLoading, loadBots } = useAiAssistant();

  useEffect(() => { loadBots(); }, [loadBots]);

  return (
    <>
      <button
        onClick={togglePanel}
        style={{
          position: 'fixed', bottom: '96px', right: '20px', zIndex: 1000,
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'linear-gradient(135deg, hsl(var(--primary)), #7c3aed)',
          color: '#fff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px -6px hsl(var(--primary) / 0.5)',
          transition: 'transform 0.2s ease',
        }}
        title="AI Ассистент"
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        {botLoading ? <Loader2 size={22} className="animate-spin" /> : <Sparkles size={22} />}
      </button>

      {isOpen && <AiAssistantPanel />}
    </>
  );
}

function AiAssistantPanel() {
  const {
    messages, loading, selectedBotId, availableBots,
    sendMessage, closePanel, selectBot,
  } = useAiAssistant();

  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        position: 'fixed', bottom: '156px', right: '20px', zIndex: 1000,
        width: '380px', maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 180px)',
        display: 'flex', flexDirection: 'column',
        borderRadius: '16px', border: '1px solid hsl(var(--border))',
        background: 'hsl(var(--card))',
        boxShadow: '0 20px 60px -12px hsl(var(--foreground) / 0.25)',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '14px 16px', borderBottom: '1px solid hsl(var(--border))',
      }}>
        <Bot size={18} style={{ color: 'hsl(var(--primary))' }} />
        <span style={{ fontWeight: 600, fontSize: '14px', flex: 1 }}>AI Ассистент</span>
        {!selectedBotId && availableBots.length > 0 && (
          <select
            value={selectedBotId || ''}
            onChange={(e) => selectBot(Number(e.target.value))}
            style={{
              fontSize: '12px', padding: '4px 8px', borderRadius: '6px',
              border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))',
              maxWidth: '140px',
            }}
          >
            {availableBots.map((bot) => (
              <option key={bot.id} value={bot.id}>{bot.name}</option>
            ))}
          </select>
        )}
        {!selectedBotId && availableBots.length === 0 && (
          <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
            Нет AI ботов
          </span>
        )}
        <button
          onClick={closePanel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'hsl(var(--muted-foreground))' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '12px',
          display: 'flex', flexDirection: 'column', gap: '10px',
          minHeight: '200px', maxHeight: '400px',
        }}
      >
        {messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '13px', textAlign: 'center', gap: '8px', padding: '20px',
          }}>
            <MessageSquare size={28} strokeWidth={1.5} />
            <span>Спросите у AI ассистента</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>
              Например: «Создай правило для отправки инцидентов»<br />
              или «Помоги заполнить условие»
            </span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            gap: '8px', alignItems: 'flex-start',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700,
              background: msg.role === 'user' ? 'hsl(var(--primary))' : 'hsl(var(--secondary))',
              color: msg.role === 'user' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
            }}>
              {msg.role === 'user' ? 'U' : 'AI'}
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: '12px', fontSize: '13px', lineHeight: '1.5',
              maxWidth: '85%', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: msg.role === 'user' ? 'hsl(var(--primary))' : 'hsl(var(--secondary))',
              color: msg.role === 'user' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 0', color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>
            <Loader2 size={16} className="animate-spin" />
            <span>Думаю...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: '8px', padding: '12px 16px',
        borderTop: '1px solid hsl(var(--border))',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedBotId ? 'Спросите что-нибудь...' : 'Сначала создайте AI бота'}
          disabled={!selectedBotId}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: '10px',
            border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))',
            fontSize: '13px', color: 'hsl(var(--foreground))',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading || !selectedBotId}
          style={{
            padding: '10px 14px', borderRadius: '10px', border: 'none',
            background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))',
            cursor: input.trim() && !loading && selectedBotId ? 'pointer' : 'default',
            opacity: input.trim() && !loading && selectedBotId ? 1 : 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
