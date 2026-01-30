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
    <div className="max-h-[calc(100vh-350px)] overflow-y-auto rounded-md border border-[hsl(var(--border)_/_0.6)]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-[hsl(var(--border))] text-left text-sm">
            <th className="px-4 py-3 font-semibold">Статус</th>
            <th className="px-4 py-3 font-semibold">Название</th>
            <th className="px-4 py-3 font-semibold">Условие</th>
            <th className="px-4 py-3 font-semibold">Канал</th>
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
              <td className="px-4 py-3">
                <span
                  className={`rounded px-2 py-1 text-xs ${
                    rule.enabled
                      ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                      : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                  }`}
                >
                  {rule.enabled ? '✅ Вкл' : '⏸️ Выкл'}
                </span>
              </td>
              <td className="px-4 py-3 font-medium">{rule.name}</td>
              <td className="px-4 py-3">
                <code className="inline-block max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                  {rule.condition}
                </code>
              </td>
              <td className="px-4 py-3">
                <code className="text-xs">{rule.chatId}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
