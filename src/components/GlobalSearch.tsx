import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Search,
  X,
  ListChecks,
  Repeat,
  FileText,
  Bot as BotIcon,
  Link2,
  Sparkles,
  Clock3,
  Users,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { api, Rule, Poll, Bot, Integration, AiBot, Reminder, User, Account } from '../lib/api';

type SearchResultType =
  | 'rule'
  | 'poll'
  | 'bot'
  | 'integration'
  | 'ai-bot'
  | 'reminder'
  | 'user'
  | 'account';

type SearchResult = {
  id: number;
  type: SearchResultType;
  name: string;
  description: string;
  enabled?: boolean;
};

type TypeMeta = {
  label: string;
  icon: LucideIcon;
};

const RESULT_META: Record<SearchResultType, TypeMeta> = {
  rule: { label: 'Webhook', icon: ListChecks },
  poll: { label: 'Пуллинг', icon: Repeat },
  bot: { label: 'Боты', icon: BotIcon },
  integration: { label: 'Интеграции', icon: Link2 },
  'ai-bot': { label: 'AI-боты', icon: Sparkles },
  reminder: { label: 'Напоминания', icon: Clock3 },
  user: { label: 'Пользователи', icon: Users },
  account: { label: 'Аккаунты', icon: Building2 },
};

const RESULT_ORDER: SearchResultType[] = [
  'rule',
  'poll',
  'integration',
  'bot',
  'ai-bot',
  'reminder',
  'user',
  'account',
];

export function GlobalSearch() {
  const [isFocused, setIsFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  const [rules, setRules] = useState<Rule[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [aiBots, setAiBots] = useState<AiBot[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    if (hasLoadedData) return;

    setLoading(true);
    try {
      const responses = await Promise.allSettled([
        api.getRules(),
        api.getPolls(),
        api.getBots(),
        api.getIntegrations(),
        api.getAiBots(),
        api.getReminders(),
        api.getUsers(),
        api.getAccounts(),
      ]);

      setRules(responses[0].status === 'fulfilled' ? responses[0].value : []);
      setPolls(responses[1].status === 'fulfilled' ? responses[1].value : []);
      setBots(responses[2].status === 'fulfilled' ? responses[2].value : []);
      setIntegrations(responses[3].status === 'fulfilled' ? responses[3].value : []);
      setAiBots(responses[4].status === 'fulfilled' ? responses[4].value : []);
      setReminders(responses[5].status === 'fulfilled' ? responses[5].value : []);
      setUsers(responses[6].status === 'fulfilled' ? responses[6].value : []);
      setAccounts(responses[7].status === 'fulfilled' ? responses[7].value : []);

      setHasLoadedData(true);
    } catch (error) {
      console.error('Failed to load search data:', error);
    } finally {
      setLoading(false);
    }
  }, [hasLoadedData]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.trim().toLowerCase();
    const limitPerType = 5;

    const filteredRules: SearchResult[] = rules
      .filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.condition?.toLowerCase().includes(q) ||
          String(r.chatId || '').toLowerCase().includes(q)
      )
      .slice(0, limitPerType)
      .map((r) => ({
        id: r.id,
        type: 'rule',
        name: r.name,
        description: r.condition || String(r.chatId || ''),
        enabled: r.enabled,
      }));

    const filteredPolls: SearchResult[] = polls
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.url?.toLowerCase().includes(q) ||
          String(p.chatId || '').toLowerCase().includes(q)
      )
      .slice(0, limitPerType)
      .map((p) => ({
        id: p.id,
        type: 'poll',
        name: p.name,
        description: p.url || String(p.chatId || ''),
        enabled: p.enabled,
      }));

    const filteredIntegrations: SearchResult[] = integrations
      .filter((i) => {
        return [
          i.name,
          i.triggerType,
          i.triggerCondition,
          i.pollingUrl,
          i.actionUrl,
          i.chatId,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .slice(0, limitPerType)
      .map((i) => ({
        id: i.id,
        type: 'integration',
        name: i.name,
        description: i.triggerType === 'polling' ? i.pollingUrl || 'Polling' : i.triggerCondition || 'Webhook',
        enabled: i.enabled,
      }));

    const filteredBots: SearchResult[] = bots
      .filter((b) => {
        return [b.name, b.pollQuestion, b.messageText, b.chatId]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .slice(0, limitPerType)
      .map((b) => ({
        id: b.id,
        type: 'bot',
        name: b.name,
        description:
          b.messageType === 'poll'
            ? `📊 ${b.pollQuestion || ''}`
            : `💬 ${(b.messageText || '').slice(0, 80)}`,
        enabled: b.enabled,
      }));

    const filteredAiBots: SearchResult[] = aiBots
      .filter((b) => {
        return [b.name, b.provider, b.model, b.systemPrompt]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .slice(0, limitPerType)
      .map((b) => ({
        id: b.id,
        type: 'ai-bot',
        name: b.name,
        description: `${b.provider} / ${b.model}`,
        enabled: b.enabled,
      }));

    const filteredReminders: SearchResult[] = reminders
      .filter((r) => {
        const owner = [r.username, r.first_name, r.last_name, r.telegram_id, r.telegram_user_id]
          .filter(Boolean)
          .join(' ');
        return [r.message, owner, r.repeat_type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .slice(0, limitPerType)
      .map((r) => ({
        id: r.id,
        type: 'reminder',
        name: r.message || `Reminder #${r.id}`,
        description: r.username ? `@${r.username}` : `User ${r.telegram_user_id}`,
        enabled: r.is_active,
      }));

    const filteredUsers: SearchResult[] = users
      .filter((u) => {
        return [u.username, u.name, u.account_name, u.role, u.id]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .slice(0, limitPerType)
      .map((u) => ({
        id: u.id,
        type: 'user',
        name: u.name?.trim() ? u.name : u.username,
        description: `@${u.username}${u.account_name ? ` • ${u.account_name}` : ''}`,
      }));

    const filteredAccounts: SearchResult[] = accounts
      .filter((a) => {
        return [a.name, a.slug, a.id]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .slice(0, limitPerType)
      .map((a) => ({
        id: a.id,
        type: 'account',
        name: a.name,
        description: a.slug || `account_${a.id}`,
      }));

    setResults([
      ...filteredRules,
      ...filteredPolls,
      ...filteredIntegrations,
      ...filteredBots,
      ...filteredAiBots,
      ...filteredReminders,
      ...filteredUsers,
      ...filteredAccounts,
    ]);

    setSelectedIndex(0);
  }, [query, rules, polls, integrations, bots, aiBots, reminders, users, accounts]);

  const groupedResults = useMemo(() => {
    return RESULT_ORDER.map((type) => ({
      type,
      items: results.filter((item) => item.type === type),
    })).filter((group) => group.items.length > 0);
  }, [results]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        !isFocused &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFocused]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, loadData]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsFocused(false);
      setQuery('');
      inputRef.current?.blur();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, results.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter' && results[selectedIndex]) {
      event.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const handleSelect = (result: SearchResult) => {
    setIsFocused(false);
    setQuery('');

    switch (result.type) {
      case 'rule':
        navigate(`/?select=${result.id}`);
        return;
      case 'poll':
        navigate(`/polling?select=${result.id}`);
        return;
      case 'integration':
        navigate(`/integrations?select=${result.id}`);
        return;
      case 'bot':
        navigate(`/telegram?tab=automation&select=${result.id}`);
        return;
      case 'ai-bot':
        navigate(`/telegram?tab=ai-bots&select=${result.id}`);
        return;
      case 'reminder':
        navigate(`/telegram?tab=reminders&select=${result.id}`);
        return;
      case 'user':
        navigate(`/users?select=${result.id}`);
        return;
      case 'account':
        navigate(`/accounts?select=${result.id}`);
        return;
      default:
        return;
    }
  };

  const handleQuickAction = (path: string) => {
    setIsFocused(false);
    setQuery('');
    navigate(path);
  };

  return (
    <div ref={containerRef} className="topbar-search-container">
      <div className={`topbar-search ${isFocused ? 'topbar-search-focused' : ''}`}>
        <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Поиск..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
        />
        {query ? (
          <button
            onClick={() => setQuery('')}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isFocused && (
        <div className="topbar-search-dropdown" role="listbox" aria-label="Global search results">
          {loading ? (
            <div className="flex items-center justify-center px-3 py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
            </div>
          ) : query && results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Ничего не найдено</div>
          ) : !query ? (
            <div className="p-3">
              <div className="topbar-search-section-title px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Быстрые действия
              </div>
              <button
                onClick={() => handleQuickAction('/?create=true')}
                className="topbar-search-item flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[hsl(var(--accent))]"
              >
                <ListChecks className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span>Создать Webhook</span>
              </button>
              <button
                onClick={() => handleQuickAction('/polling?create=true')}
                className="topbar-search-item flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[hsl(var(--accent))]"
              >
                <Repeat className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span>Создать пуллинг</span>
              </button>
              <button
                onClick={() => handleQuickAction('/integrations?create=true')}
                className="topbar-search-item flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[hsl(var(--accent))]"
              >
                <Link2 className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span>Создать интеграцию</span>
              </button>
              <button
                onClick={() => handleQuickAction('/telegram?tab=automation&create=true')}
                className="topbar-search-item flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[hsl(var(--accent))]"
              >
                <BotIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span>Создать бота</span>
              </button>
              <button
                onClick={() => handleQuickAction('/telegram?tab=ai-bots&create=true')}
                className="topbar-search-item flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[hsl(var(--accent))]"
              >
                <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span>Создать AI-бота</span>
              </button>
              <button
                onClick={() => handleQuickAction('/history')}
                className="topbar-search-item flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[hsl(var(--accent))]"
              >
                <FileText className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span>История вебхуков</span>
              </button>
            </div>
          ) : (
            <div className="p-3">
              {groupedResults.map((group) => {
                const meta = RESULT_META[group.type];
                return (
                  <div key={group.type}>
                    <div className="topbar-search-section-title mt-1 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      {meta.label}
                    </div>
                    {group.items.map((result) => {
                      const globalIdx = results.indexOf(result);
                      const Icon = meta.icon;
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSelect(result)}
                          className={`topbar-search-item flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors ${
                            selectedIndex === globalIdx
                              ? 'bg-[hsl(var(--accent))]'
                              : 'hover:bg-[hsl(var(--accent)_/_0.5)]'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{result.name}</span>
                              {typeof result.enabled === 'boolean' && (
                                <span
                                  className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${
                                    result.enabled
                                      ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                                      : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                                  }`}
                                >
                                  {result.enabled ? 'Вкл' : 'Выкл'}
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">{result.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
