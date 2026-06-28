import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api, AiBot } from './api';

const STORAGE_KEY = 'ai_chat_messages';
const STORAGE_MAX = 100;

export interface AgentAction {
  tool: string;
  args: any;
  result?: any;
  error?: string;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
  isAgent?: boolean;
  actions?: AgentAction[];
  summary?: string;
}

export interface ConfirmRequest {
  sessionId: string;
  tool: string;
  args: any;
  question: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export interface QuickAction {
  label: string;
  icon: string;
  goal: string;
}

interface AiAssistantContextType {
  isOpen: boolean;
  messages: AssistantMessage[];
  selectedBotId: number | null;
  availableBots: AiBot[];
  loading: boolean;
  botLoading: boolean;
  agentMode: boolean;
  confirmRequest: ConfirmRequest | null;
  suggestions: QuickAction[] | null;
  togglePanel: () => void;
  closePanel: () => void;
  openPanel: () => void;
  sendMessage: (text: string) => Promise<void>;
  executeAgentGoal: (goal: string) => Promise<void>;
  getFieldSuggestion: (fieldName: string, description: string, currentValue?: string) => Promise<string>;
  selectBot: (id: number) => void;
  loadBots: () => Promise<void>;
  setAgentMode: (v: boolean) => void;
  clearHistory: () => void;
  dismissConfirm: () => void;
  dismissSuggestions: () => void;
}

const AiAssistantContext = createContext<AiAssistantContextType | undefined>(undefined);

function loadMessages(): AssistantMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw).slice(-STORAGE_MAX);
  } catch { /* ignore */ }
  return [];
}

function saveMessages(msgs: AssistantMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-STORAGE_MAX)));
  } catch { /* ignore */ }
}

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => loadMessages());
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);
  const [availableBots, setAvailableBots] = useState<AiBot[]>([]);
  const [loading, setLoading] = useState(false);
  const [botLoading, setBotLoading] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [suggestions, setSuggestions] = useState<QuickAction[] | null>(null);

  useEffect(() => { saveMessages(messages); }, [messages]);

  const togglePanel = useCallback(() => {
    setIsOpen((v) => {
      if (!v) {
        setSuggestions(null);
        loadProactiveSuggestions();
      }
      return !v;
    });
  }, []);

  const closePanel = useCallback(() => setIsOpen(false), []);
  const openPanel = useCallback(() => {
    setIsOpen(true);
    setSuggestions(null);
    loadProactiveSuggestions();
  }, []);

  const loadProactiveSuggestions = useCallback(() => {
    const path = window.location.pathname;
    if (path === '/' || path === '/dashboard') {
      setSuggestions([
        { label: 'Создать правило', icon: '⚡', goal: 'Создай простое правило для отправки сообщения в Telegram при payload.status = "error"' },
        { label: 'Аудит системы', icon: '🔍', goal: 'Проверь текущее состояние: сколько правил, пуллингов, интеграций и AI-ботов. Если чего-то не хватает — предложи создать.' },
        { label: 'Проверить пуллинги', icon: '🔄', goal: 'Проверь все пуллинги. Если есть выключенные — включи их.' },
      ]);
    } else if (path.includes('/rules')) {
      setSuggestions([
        { label: 'Список правил', icon: '📋', goal: 'Покажи список всех правил' },
        { label: 'Новое правило', icon: '➕', goal: 'Создай новое правило для отправки сообщения в Telegram при payload.status = "error"' },
      ]);
    } else if (path.includes('/polls')) {
      setSuggestions([
        { label: 'Список пуллингов', icon: '📋', goal: 'Покажи список всех пуллингов' },
        { label: 'Новый пуллинг', icon: '➕', goal: 'Создай новый пуллинг с GET запросом каждые 60 секунд' },
      ]);
    } else if (path.includes('/integrations')) {
      setSuggestions([
        { label: 'Список интеграций', icon: '📋', goal: 'Покажи список всех интеграций' },
        { label: 'Новая интеграция', icon: '➕', goal: 'Создай новую webhook интеграцию' },
      ]);
    }
  }, []);

  const loadBots = useCallback(async () => {
    try {
      setBotLoading(true);
      const bots = await api.getAiBots();
      const enabled = bots.filter((b) => b.enabled);
      setAvailableBots(enabled);
      if (!selectedBotId && enabled.length > 0) {
        setSelectedBotId(enabled[0].id);
      }
    } catch { /* ignore */ }
    finally { setBotLoading(false); }
  }, [selectedBotId]);

  const selectBot = useCallback((id: number) => {
    setSelectedBotId(id);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !selectedBotId) return;

    const userMsg: AssistantMessage = { role: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const ctx = window.location.pathname + window.location.search;
      const result = await api.aiAssist(selectedBotId, text.trim(), ctx);
      const aiMsg: AssistantMessage = { role: 'assistant', text: result.text };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: AssistantMessage = { role: 'assistant', text: `❌ Ошибка: ${err.message || 'Неизвестная ошибка'}` };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [selectedBotId]);

  const getFieldSuggestion = useCallback(async (fieldName: string, description: string, currentValue?: string): Promise<string> => {
    if (!selectedBotId) throw new Error('AI bot not selected');

    const prompt = currentValue
      ? `Поле: ${fieldName}\nТекущее значение: ${currentValue}\n\nЧто нужно сделать: ${description}\n\nОтветь только содержимым для этого поля, без пояснений.`
      : `Поле: ${fieldName}\n\nЧто нужно сгенерировать: ${description}\n\nОтветь только содержимым для этого поля, без пояснений.`;

    const result = await api.aiAssist(selectedBotId, prompt, window.location.pathname);
    return result.text;
  }, [selectedBotId]);

  const handleOneClickApply = useCallback((navigateTo?: string, refreshEntity?: string) => {
    if (navigateTo) {
      window.location.href = navigateTo;
    } else if (refreshEntity) {
      window.dispatchEvent(new CustomEvent('ai-refresh', { detail: { entity: refreshEntity } }));
    }
  }, []);

  const executeAgentGoal = useCallback(async (goal: string) => {
    if (!goal.trim() || !selectedBotId) return;

    const userMsg: AssistantMessage = { role: 'user', text: goal.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setSuggestions(null);

    let accumulatedActions: AgentAction[] = [];
    let summary = '';

    // Build an assistant message that we'll update as streaming progresses
    const streamingMsg: AssistantMessage = {
      role: 'assistant',
      text: '⏳ Выполняю...',
      isAgent: true,
      actions: [],
    };
    setMessages((prev) => [...prev, streamingMsg]);

    const updateStreamingMsg = (text: string, actions: AgentAction[]) => {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.isAgent) {
          copy[copy.length - 1] = { ...last, text, actions };
        }
        return copy;
      });
    };

    try {
      const streamPromise = api.aiAgentExecuteStream(
        selectedBotId,
        goal.trim(),
        (event, data) => {
          if (event === 'step') {
            updateStreamingMsg(`🔧 ${data.tool}...`, accumulatedActions);
          } else if (event === 'step_result') {
            const action: AgentAction = { tool: data.tool, args: data.args, result: data.result, error: data.error };
            accumulatedActions = [...accumulatedActions, action];
            const icon = data.error ? '❌' : '✅';
            updateStreamingMsg(`${icon} ${data.tool}${data.error ? ': ' + data.error : ''}`, accumulatedActions);
          } else if (event === 'confirm_needed') {
            setConfirmRequest({
              sessionId: data.sessionId,
              tool: data.tool,
              args: data.args,
              question: data.question,
              onConfirm: async () => {
                setConfirmRequest(null);
                setLoading(true);
                try {
                  const confirmResult = await api.aiAgentConfirm(selectedBotId, goal.trim(), data.sessionId, { tool: data.tool, args: data.args });
                  summary = confirmResult.summary || 'Выполнено';
                  const allActions = [...accumulatedActions, ...(confirmResult.actions || [])];
                  updateStreamingMsg(`✅ ${confirmResult.summary || 'Подтверждено'}`, allActions);
                  if (confirmResult.navigateTo || confirmResult.refreshEntity) {
                    setTimeout(() => handleOneClickApply(confirmResult.navigateTo, confirmResult.refreshEntity), 500);
                  }
                } catch {
                  updateStreamingMsg('❌ Ошибка подтверждения', accumulatedActions);
                } finally {
                  setLoading(false);
                }
              },
              onCancel: () => {
                setConfirmRequest(null);
                updateStreamingMsg('⏭️ Действие отменено пользователем', accumulatedActions);
              },
            });
          } else if (event === 'thinking') {
            updateStreamingMsg(`💭 Шаг ${data.step}/${data.maxSteps}...`, accumulatedActions);
          } else if (event === 'final' || event === 'done') {
            summary = data.summary || 'Готово';
            accumulatedActions = [...accumulatedActions, ...(data.actions || [])];
            let finalText = summary;
            if (data.navigateTo || data.refreshEntity) {
              setTimeout(() => handleOneClickApply(data.navigateTo, data.refreshEntity), 500);
            }
            if (data.navigateTo) finalText += `\n🔄 Перехожу на ${data.navigateTo}`;
            if (data.refreshEntity) finalText += `\n🔄 Обновляю список ${data.refreshEntity}`;
            updateStreamingMsg(finalText, accumulatedActions);
          } else if (event === 'error') {
            updateStreamingMsg(`❌ ${data.message || 'Ошибка выполнения'}`, accumulatedActions);
          }
        },
      );

      await streamPromise;
    } catch (err: any) {
      updateStreamingMsg(`❌ Ошибка: ${err.message || 'Неизвестная ошибка'}`, accumulatedActions);
    } finally {
      setLoading(false);
    }
  }, [selectedBotId, handleOneClickApply]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const dismissConfirm = useCallback(() => {
    confirmRequest?.onCancel();
  }, [confirmRequest]);

  const dismissSuggestions = useCallback(() => {
    setSuggestions(null);
  }, []);

  return (
    <AiAssistantContext.Provider value={{
      isOpen, messages, selectedBotId, availableBots,
      loading, botLoading, agentMode,
      confirmRequest, suggestions,
      togglePanel, closePanel, openPanel,
      sendMessage, executeAgentGoal, getFieldSuggestion,
      selectBot, loadBots, setAgentMode,
      clearHistory, dismissConfirm, dismissSuggestions,
    }}>
      {children}
    </AiAssistantContext.Provider>
  );
}

export function useAiAssistant() {
  const context = useContext(AiAssistantContext);
  if (context === undefined) {
    throw new Error('useAiAssistant must be used within an AiAssistantProvider');
  }
  return context;
}
