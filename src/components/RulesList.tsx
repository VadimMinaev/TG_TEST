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
      <div className="flex items-center justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Правила не найдены
      </p>
    );
  }

  return (
    <div className="max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin">
      <table className="table-basic w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
            <th className="px-2 py-2">Название</th>
            <th className="px-2 py-2">Условие</th>
            <th className="px-2 py-2">Статус</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr
              key={rule.id}
              onClick={() => onSelect(rule.id)}
              className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                selectedId === rule.id ? 'bg-[hsl(var(--accent))]' : ''
              }`}
            >
              <td className="px-2 py-2 font-medium">{rule.name}</td>
              <td className="px-2 py-2">
                <code className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-1">
                  {rule.condition}
                </code>
              </td>
              <td className="px-2 py-2 whitespace-nowrap">{rule.enabled ? '✅ Вкл' : '⏸️ Выкл'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
