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
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Загружаем данные при открытии
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

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" для открытия
      if (e.key === '/' && !isOpen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsOpen(true);
      }
      
      // ESC для закрытия
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Фокус при открытии
  useEffect(() => {
    if (isOpen) {
      loadData();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, loadData]);

  // Навигация по результатам
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
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
    setIsOpen(false);
    setQuery('');
    if (result.type === 'rule') {
      navigate(`/?select=${result.id}`);
    } else {
      navigate(`/polling?select=${result.id}`);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  return (
    <>
      {/* Trigger */}
      <button onClick={handleOpen} className="topbar-search">
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left text-sm text-[hsl(var(--muted-foreground))]">
          Поиск...
        </span>
        <kbd className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
          /
        </kbd>
      </button>

      {/* Modal */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => { setIsOpen(false); setQuery(''); }}
          />
          <div className="fixed left-1/2 top-[15%] z-50 w-full max-w-lg -translate-x-1/2 animate-fade-in">
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">
              {/* Input */}
              <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-3">
                <Search className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Поиск правил и пуллингов..."
                  className="flex-1 bg-transparent text-base outline-none placeholder:text-[hsl(var(--muted-foreground))]"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto p-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
                  </div>
                ) : query && results.length === 0 ? (
                  <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    Ничего не найдено
                  </div>
                ) : !query ? (
                  <div className="space-y-1 py-2">
                    <div className="px-2 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                      Быстрые действия
                    </div>
                    <button
                      onClick={() => { setIsOpen(false); navigate('/?create=true'); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--accent))]"
                    >
                      <ListChecks className="h-4 w-4 text-[hsl(var(--primary))]" />
                      <span className="flex-1 text-sm">Создать правило</span>
                      <ArrowRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </button>
                    <button
                      onClick={() => { setIsOpen(false); navigate('/polling?create=true'); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--accent))]"
                    >
                      <Repeat className="h-4 w-4 text-[hsl(var(--primary))]" />
                      <span className="flex-1 text-sm">Создать пуллинг</span>
                      <ArrowRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </button>
                    <button
                      onClick={() => { setIsOpen(false); navigate('/history'); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--accent))]"
                    >
                      <FileText className="h-4 w-4 text-[hsl(var(--primary))]" />
                      <span className="flex-1 text-sm">Посмотреть историю</span>
                      <ArrowRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {results.filter(r => r.type === 'rule').length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                          Правила
                        </div>
                        {results.filter(r => r.type === 'rule').map((result, idx) => {
                          const globalIdx = results.indexOf(result);
                          return (
                            <button
                              key={`rule-${result.id}`}
                              onClick={() => handleSelect(result)}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                                selectedIndex === globalIdx ? 'bg-[hsl(var(--accent))]' : 'hover:bg-[hsl(var(--accent)_/_0.5)]'
                              }`}
                            >
                              <ListChecks className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium">{result.name}</span>
                                  <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] ${
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
                        <div className="px-2 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                          Пуллинг
                        </div>
                        {results.filter(r => r.type === 'poll').map((result) => {
                          const globalIdx = results.indexOf(result);
                          return (
                            <button
                              key={`poll-${result.id}`}
                              onClick={() => handleSelect(result)}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                                selectedIndex === globalIdx ? 'bg-[hsl(var(--accent))]' : 'hover:bg-[hsl(var(--accent)_/_0.5)]'
                              }`}
                            >
                              <Repeat className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium">{result.name}</span>
                                  <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] ${
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

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-[hsl(var(--muted))] px-1 py-0.5">↑</kbd>
                    <kbd className="rounded bg-[hsl(var(--muted))] px-1 py-0.5">↓</kbd>
                    навигация
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-[hsl(var(--muted))] px-1 py-0.5">Enter</kbd>
                    выбрать
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-[hsl(var(--muted))] px-1 py-0.5">Esc</kbd>
                  закрыть
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
