import { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, Send, X, MessageSquare, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight, Cpu, Trash2 } from 'lucide-react';
import { useAiAssistant, QuickAction } from '../lib/ai-assistant-context';

export function AiAssistantToggle() {
  const { isOpen, togglePanel, botLoading, loadBots, agentMode } = useAiAssistant();

  useEffect(() => { loadBots(); }, [loadBots]);

  return (
    <>
      <button
        onClick={togglePanel}
        className={`ai-fab ${agentMode ? 'agent-mode' : ''}`}
        title={agentMode ? 'AI Агент' : 'AI Ассистент'}
      >
        {botLoading ? <Loader2 size={22} className="animate-spin" /> : agentMode ? <Cpu size={22} /> : <Sparkles size={22} />}
      </button>

      {isOpen && <AiAssistantPanel />}
    </>
  );
}

function QuickActionChips({ actions, onSelect }: { actions: QuickAction[]; onSelect: (goal: string) => void }) {
  return (
    <div className="ai-action-chips">
      {actions.map((a, i) => (
        <button key={i} onClick={() => onSelect(a.goal)} className="ai-action-chip">
          {a.icon} {a.label}
        </button>
      ))}
    </div>
  );
}

function AiAssistantPanel() {
  const {
    messages, loading, selectedBotId, availableBots,
    sendMessage, executeAgentGoal, closePanel, selectBot,
    agentMode, setAgentMode, suggestions, dismissSuggestions,
    confirmRequest, clearHistory,
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

  const handleQuickAction = (goal: string) => {
    if (agentMode) {
      executeAgentGoal(goal);
    } else {
      setInput(goal);
      inputRef.current?.focus();
    }
    dismissSuggestions();
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
    <>
      {confirmRequest && (
        <div className="ai-confirm-overlay">
          <div className="ai-confirm-dialog">
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <strong>Подтвердите действие</strong>
              <div style={{ marginTop: '8px', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
                {confirmRequest.question}
              </div>
            </div>
            <div className="ai-confirm-actions">
              <button
                onClick={confirmRequest.onCancel}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Отмена
              </button>
              <button
                onClick={confirmRequest.onConfirm}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px', background: 'hsl(var(--destructive))' }}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ai-panel">
        <div className="ai-panel-header">
          {agentMode ? <Cpu size={16} style={{ color: '#ec4899' }} /> : <Bot size={16} style={{ color: 'hsl(var(--primary))' }} />}
          <span className="ai-panel-title">{agentMode ? 'AI Агент' : 'AI Ассистент'}</span>
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              title="Очистить историю"
              className="icon-button"
              style={{ width: '28px', height: '28px', border: 'none' }}
            >
              <Trash2 size={14} />
            </button>
          )}
          <div className="ai-mode-switch">
            <button
              onClick={() => setAgentMode(false)}
              className={`ai-mode-btn ${!agentMode ? 'active' : ''}`}
            >
              Чат
            </button>
            <button
              onClick={() => setAgentMode(true)}
              className={`ai-mode-btn ${agentMode ? 'active' : ''}`}
            >
              Агент
            </button>
          </div>
          <button
            onClick={closePanel}
            className="icon-button"
            style={{ width: '28px', height: '28px', border: 'none' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="ai-bot-selector">
          <span style={{ color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>Бот:</span>
          {availableBots.length > 0 ? (
            <select
              value={selectedBotId || ''}
              onChange={(e) => selectBot(Number(e.target.value))}
            >
              {availableBots.map((bot) => (
                <option key={bot.id} value={bot.id}>{bot.name} ({bot.provider})</option>
              ))}
            </select>
          ) : (
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Нет AI ботов. Создайте в AiBots</span>
          )}
        </div>

        {suggestions && suggestions.length > 0 && (
          <QuickActionChips actions={suggestions} onSelect={handleQuickAction} />
        )}

        <div ref={listRef} className="ai-messages">
          {messages.length === 0 && (
            <div className="ai-empty-state">
              <MessageSquare size={28} strokeWidth={1.5} />
              <span>{agentMode ? 'Опишите задачу для агента' : 'Спросите у AI ассистента'}</span>
              <span className="ai-empty-hint">
                {agentMode
                  ? 'Агент сам создаст правила, пуллинги и интеграции'
                  : 'Например: «Помоги заполнить условие»'}
              </span>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className="ai-msg">
              <div className={`ai-msg-row ${msg.role === 'user' ? 'user' : ''}`}>
                <div className={`ai-msg-avatar ${msg.role === 'user' ? 'user' : 'bot'}`}>
                  {msg.role === 'user' ? 'U' : msg.isAgent ? <Cpu size={14} /> : 'AI'}
                </div>
                <div className={`ai-msg-bubble ${msg.role === 'user' ? 'user' : 'bot'}`}>
                  {msg.text}
                </div>
              </div>

              {msg.isAgent && msg.actions && msg.actions.length > 0 && (
                <div className="ai-agent-actions">
                  <button
                    onClick={() => toggleExpand(i)}
                    className="ai-agent-toggle"
                  >
                    {expandedActions.has(i) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>{msg.actions.length} {msg.actions.length === 1 ? 'действие' : 'действий'}</span>
                  </button>
                  {expandedActions.has(i) && msg.actions.map((act, ai) => (
                    <div key={ai} className="ai-action-detail">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: act.error || act.result ? '4px' : '0' }}>
                        {act.error ? (
                          <XCircle size={14} style={{ color: 'hsl(var(--destructive))', flexShrink: 0 }} />
                        ) : (
                          <CheckCircle2 size={14} style={{ color: 'hsl(var(--success))', flexShrink: 0 }} />
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

          {loading && !messages[messages.length - 1]?.text.startsWith('🔧') && !messages[messages.length - 1]?.text.startsWith('💭') && (
            <div className="ai-typing">
              <Loader2 size={16} className="animate-spin" />
              <span>Думаю...</span>
            </div>
          )}
        </div>

        <div className="ai-input-row">
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
            className="ai-input"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading || !selectedBotId}
            className="ai-send-btn"
          >
            {agentMode ? <Cpu size={16} /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </>
  );
}
