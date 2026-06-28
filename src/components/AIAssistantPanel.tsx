import { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, Send, X, MessageSquare, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight, Cpu } from 'lucide-react';
import { useAiAssistant } from '../lib/ai-assistant-context';

export function AiAssistantToggle() {
  const { isOpen, togglePanel, botLoading, loadBots, agentMode } = useAiAssistant();

  useEffect(() => { loadBots(); }, [loadBots]);

  return (
    <>
      <button
        onClick={togglePanel}
        style={{
          position: 'fixed', bottom: '96px', right: '20px', zIndex: 1000,
          width: '52px', height: '52px', borderRadius: '50%',
          background: agentMode
            ? 'linear-gradient(135deg, #7c3aed, #ec4899)'
            : 'linear-gradient(135deg, hsl(var(--primary)), #7c3aed)',
          color: '#fff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: agentMode
            ? '0 8px 24px -6px #ec4899 / 0.5'
            : '0 8px 24px -6px hsl(var(--primary) / 0.5)',
          transition: 'transform 0.2s ease',
        }}
        title={agentMode ? 'AI Агент' : 'AI Ассистент'}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        {botLoading ? <Loader2 size={22} className="animate-spin" /> : agentMode ? <Cpu size={22} /> : <Sparkles size={22} />}
      </button>

      {isOpen && <AiAssistantPanel />}
    </>
  );
}

function AiAssistantPanel() {
  const {
    messages, loading, selectedBotId, availableBots,
    sendMessage, executeAgentGoal, closePanel, selectBot,
    agentMode, setAgentMode,
  } = useAiAssistant();

  const [input, setInput] = useState('');
  const [expandedActions, setExpandedActions] = useState<Set<number>>(new Set());
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
    if (agentMode) {
      executeAgentGoal(input.trim());
    } else {
      sendMessage(input.trim());
    }
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleExpand = (idx: number) => {
    setExpandedActions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
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
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px 16px', borderBottom: '1px solid hsl(var(--border))',
      }}>
        {agentMode ? <Cpu size={16} style={{ color: '#ec4899' }} /> : <Bot size={16} style={{ color: 'hsl(var(--primary))' }} />}
        <span style={{ fontWeight: 600, fontSize: '14px', flex: 1 }}>{agentMode ? 'AI Агент' : 'AI Ассистент'}</span>
        <div style={{
          display: 'flex', background: 'hsl(var(--secondary))', borderRadius: '8px', padding: '2px', gap: '2px',
        }}>
          <button
            onClick={() => setAgentMode(false)}
            style={{
              padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px',
              fontWeight: 600, transition: 'all 0.15s',
              background: !agentMode ? 'hsl(var(--background))' : 'transparent',
              color: !agentMode ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              boxShadow: !agentMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Чат
          </button>
          <button
            onClick={() => setAgentMode(true)}
            style={{
              padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px',
              fontWeight: 600, transition: 'all 0.15s',
              background: agentMode ? 'hsl(var(--background))' : 'transparent',
              color: agentMode ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              boxShadow: agentMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Агент
          </button>
        </div>
        <button
          onClick={closePanel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'hsl(var(--muted-foreground))' }}
        >
          <X size={16} />
        </button>
      </div>
      {/* Bot selector */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 16px', borderBottom: '1px solid hsl(var(--border))',
        fontSize: '12px',
      }}>
        <span style={{ color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>Бот:</span>
        {availableBots.length > 0 ? (
          <select
            value={selectedBotId || ''}
            onChange={(e) => selectBot(Number(e.target.value))}
            style={{
              fontSize: '12px', padding: '3px 6px', borderRadius: '6px', flex: 1,
              border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))',
            }}
          >
            {availableBots.map((bot) => (
              <option key={bot.id} value={bot.id}>{bot.name} ({bot.provider})</option>
            ))}
          </select>
        ) : (
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Нет AI ботов. Создайте в AiBots</span>
        )}
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
            display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
            <div style={{
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
                {msg.role === 'user' ? 'U' : msg.isAgent ? <Cpu size={14} /> : 'AI'}
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

            {/* Agent actions */}
            {msg.isAgent && msg.actions && msg.actions.length > 0 && (
              <div style={{ paddingLeft: '36px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button
                  onClick={() => toggleExpand(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px',
                    color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none',
                    cursor: 'pointer', padding: '4px 0',
                  }}
                >
                  {expandedActions.has(i) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{msg.actions.length} {msg.actions.length === 1 ? 'действие' : 'действий'}</span>
                </button>
                {expandedActions.has(i) && msg.actions.map((act, ai) => (
                  <div key={ai} style={{
                    padding: '8px 10px', borderRadius: '8px', fontSize: '12px',
                    background: 'hsl(var(--accent))',
                    border: '1px solid hsl(var(--border))',
                    lineHeight: '1.5',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: act.error || act.result ? '4px' : '0' }}>
                      {act.error ? (
                        <XCircle size={14} style={{ color: 'hsl(var(--destructive))', flexShrink: 0 }} />
                      ) : (
                        <CheckCircle2 size={14} style={{ color: 'hsl(142 76% 36%)', flexShrink: 0 }} />
                      )}
                      <strong>{act.tool}</strong>
                    </div>
                    {act.args && Object.keys(act.args).length > 0 && (
                      <details style={{ marginTop: '4px' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '11px', color: 'hsl(var(--muted-foreground))', userSelect: 'none' }}>
                          Аргументы
                        </summary>
                        <pre style={{ fontSize: '11px', marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {JSON.stringify(act.args, null, 2)}
                        </pre>
                      </details>
                    )}
                    {act.error && (
                      <div style={{ color: 'hsl(var(--destructive))', fontSize: '11px', marginTop: '2px' }}>
                        {act.error}
                      </div>
                    )}
                    {act.result && (
                      <details style={{ marginTop: '4px' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '11px', color: 'hsl(var(--muted-foreground))', userSelect: 'none' }}>
                          Результат
                        </summary>
                        <pre style={{ fontSize: '11px', marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflowY: 'auto' }}>
                          {typeof act.result === 'object' ? JSON.stringify(act.result, null, 2).slice(0, 2000) : String(act.result).slice(0, 2000)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
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
          placeholder={
            !selectedBotId
              ? 'Сначала создайте AI бота'
              : agentMode
                ? 'Опишите задачу для агента...'
                : 'Спросите что-нибудь...'
          }
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
            background: agentMode ? '#7c3aed' : 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            cursor: input.trim() && !loading && selectedBotId ? 'pointer' : 'default',
            opacity: input.trim() && !loading && selectedBotId ? 1 : 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {agentMode ? <Cpu size={16} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
