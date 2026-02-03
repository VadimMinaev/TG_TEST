import { Rule } from '../lib/api';

interface RulesListProps {
  rules: Rule[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  loading: boolean;
}

export function RulesList({ rules, selectedId, onSelect, loading }: RulesListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <p className="py-20 text-center text-[hsl(var(--muted-foreground))]">
        Правила не найдены
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 scrollbar-thin">
      {rules.map((rule) => (
        <div
          key={rule.id}
          onClick={() => onSelect(rule.id)}
          className={`group cursor-pointer rounded-lg border p-3 transition-all ${
            selectedId === rule.id
              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)_/_0.08)] shadow-sm'
              : 'border-[hsl(var(--border)_/_0.6)] hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--accent)_/_0.5)]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                rule.enabled
                  ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                  : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
              }`}
            >
              {rule.enabled ? 'Вкл' : 'Выкл'}
            </span>
            <span className="font-medium truncate">{rule.name}</span>
          </div>
          <code className="block text-xs text-[hsl(var(--muted-foreground))] truncate">
            {rule.condition}
          </code>
        </div>
      ))}
    </div>
  );
}
