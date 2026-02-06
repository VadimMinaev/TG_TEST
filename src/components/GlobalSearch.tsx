import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Search, X, ListChecks, Repeat, FileText, ArrowRight } from 'lucide-react';
import { api, Rule, Poll } from '../lib/api';

type SearchResult = {
  id: number;
  type: 'rule' | 'poll';
  name: string;
  description: string;
  enabled: boolean;
};

export function GlobalSearch() {
  const [isFocused, setIsFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Загружаем данные при фокусе
  const loadData = useCallback(async () => {
    if (rules.length === 0 || polls.length === 0) {
      setLoading(true);
      try {
        const [rulesData, pollsData] = await Promise.all([
          api.getRules(),
          api.getPolls(),
        ]);
        setRules(rulesData);
        setPolls(pollsData);
      } catch (error) {
        console.error('Failed to load search data:', error);
      } finally {
        setLoading(false);
      }
    }
  }, [rules.length, polls.length]);

  // Фильтруем результаты
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const filteredRules: SearchResult[] = rules
      .filter(r => 
        r.name?.toLowerCase().includes(q) || 
        r.condition?.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map(r => ({
        id: r.id,
        type: 'rule',
        name: r.name,
        description: r.condition,
        enabled: r.enabled,
      }));

    const filteredPolls: SearchResult[] = polls
      .filter(p => 
        p.name?.toLowerCase().includes(q) || 
        p.url?.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        type: 'poll',
        name: p.name,
        description: p.url,
        enabled: p.enabled,
      }));

    setResults([...filteredRules, ...filteredPolls]);
    setSelectedIndex(0);
  }, [query, rules, polls]);

  // Горячая клавиша "/" для фокуса
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !isFocused && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocused]);

  // Закрытие при клике вне
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Загрузка данных при фокусе
  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, loadData]);

  // Навигация по результатам
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsFocused(false);
      setQuery('');
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const handleSelect = (result: SearchResult) => {
    setIsFocused(false);
    setQuery('');
    if (result.type === 'rule') {
      navigate(`/?select=${result.id}`);
    } else {
      navigate(`/polling?select=${result.id}`);
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
          onChange={(e) => setQuery(e.target.value)}
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
        ) : (
          <kbd className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
            /
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {isFocused && (
        <div className="topbar-search-dropdown">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
            </div>
          ) : query && results.length === 0 ? (
            <div className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Ничего не найдено
            </div>
          ) : !query ? (
            <div className="p-2">
              <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Быстрые действия
              </div>
              <button
                onClick={() => handleQuickAction('/?create=true')}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-[hsl(var(--accent))]"
              >
                <ListChecks className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span>Создать Webhook</span>
              </button>
              <button
                onClick={() => handleQuickAction('/polling?create=true')}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-[hsl(var(--accent))]"
              >
                <Repeat className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span>Создать пуллинг</span>
              </button>
              <button
                onClick={() => handleQuickAction('/history')}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-[hsl(var(--accent))]"
              >
                <FileText className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span>История вебхуков</span>
              </button>
            </div>
          ) : (
            <div className="p-2">
              {results.filter(r => r.type === 'rule').length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Webhook
                  </div>
                  {results.filter(r => r.type === 'rule').map((result) => {
                    const globalIdx = results.indexOf(result);
                    return (
                      <button
                        key={`rule-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                          selectedIndex === globalIdx ? 'bg-[hsl(var(--accent))]' : 'hover:bg-[hsl(var(--accent)_/_0.5)]'
                        }`}
                      >
                        <ListChecks className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{result.name}</span>
                            <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${
                              result.enabled 
                                ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                                : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                            }`}>
                              {result.enabled ? 'Вкл' : 'Выкл'}
                            </span>
                          </div>
                          <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {result.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
              {results.filter(r => r.type === 'poll').length > 0 && (
                <>
                  <div className="mt-1 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Пуллинг
                  </div>
                  {results.filter(r => r.type === 'poll').map((result) => {
                    const globalIdx = results.indexOf(result);
                    return (
                      <button
                        key={`poll-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                          selectedIndex === globalIdx ? 'bg-[hsl(var(--accent))]' : 'hover:bg-[hsl(var(--accent)_/_0.5)]'
                        }`}
                      >
                        <Repeat className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{result.name}</span>
                            <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${
                              result.enabled 
                                ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                                : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                            }`}>
                              {result.enabled ? 'Вкл' : 'Выкл'}
                            </span>
                          </div>
                          <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {result.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
