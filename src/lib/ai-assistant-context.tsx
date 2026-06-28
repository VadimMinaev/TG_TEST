import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { api, AiBot } from './api';

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

interface AiAssistantContextType {
  isOpen: boolean;
  messages: AssistantMessage[];
  selectedBotId: number | null;
  availableBots: AiBot[];
  loading: boolean;
  botLoading: boolean;
  agentMode: boolean;
  togglePanel: () => void;
  closePanel: () => void;
  openPanel: () => void;
  sendMessage: (text: string) => Promise<void>;
  executeAgentGoal: (goal: string) => Promise<void>;
  getFieldSuggestion: (fieldName: string, description: string, currentValue?: string) => Promise<string>;
  selectBot: (id: number) => void;
  loadBots: () => Promise<void>;
  setAgentMode: (v: boolean) => void;
}

const AiAssistantContext = createContext<AiAssistantContextType | undefined>(undefined);

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);
  const [availableBots, setAvailableBots] = useState<AiBot[]>([]);
  const [loading, setLoading] = useState(false);
  const [botLoading, setBotLoading] = useState(false);
  const [agentMode, setAgentMode] = useState(false);

  const togglePanel = useCallback(() => setIsOpen((v) => !v), []);
  const closePanel = useCallback(() => setIsOpen(false), []);
  const openPanel = useCallback(() => setIsOpen(true), []);

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
      const context = window.location.pathname + window.location.search;
      const result = await api.aiAssist(selectedBotId, text.trim(), context);
      const aiMsg: AssistantMessage = { role: 'assistant', text: result.text };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: AssistantMessage = { role: 'assistant', text: `❌ Ошибка: ${err.message || 'Неизвестная ошибка'}` };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [selectedBotId]);

  const executeAgentGoal = useCallback(async (goal: string) => {
    if (!goal.trim() || !selectedBotId) return;

    const userMsg: AssistantMessage = { role: 'user', text: goal.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await api.aiAgentExecute(selectedBotId, goal.trim());
      const aiMsg: AssistantMessage = {
        role: 'assistant',
        text: result.summary || 'Выполнено',
        isAgent: true,
        actions: result.actions || [],
        summary: result.summary,
      };
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

  return (
    <AiAssistantContext.Provider value={{
      isOpen, messages, selectedBotId, availableBots,
      loading, botLoading, agentMode,
      togglePanel, closePanel, openPanel,
      sendMessage, executeAgentGoal, getFieldSuggestion, selectBot, loadBots, setAgentMode,
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
