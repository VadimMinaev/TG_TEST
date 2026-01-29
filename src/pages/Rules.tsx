import { useEffect, useState } from 'react';
import { api, Rule } from '../lib/api';
import { Plus, Search, Download } from 'lucide-react';
import { RulesList } from '../components/RulesList';
import { RuleDetails } from '../components/RuleDetails';
import { RuleForm } from '../components/RuleForm';

export function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await api.getRules();
      setRules(data);
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredRules = rules.filter(
    (rule) =>
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.chatId.includes(searchQuery)
  );

  const handleSelectRule = (id: number) => {
    setSelectedRuleId(id);
    setEditingRuleId(null);
  };

  const handleEditRule = (id: number) => {
    setSelectedRuleId(id);
    setEditingRuleId(id);
  };

  const handleCreateNew = () => {
    setSelectedRuleId(null);
    setEditingRuleId(null);
  };

  const handleStartCreate = () => {
    setSelectedRuleId(null);
    setEditingRuleId(-1); // -1 indicates creating new
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить это правило?')) return;

    try {
      await api.deleteRule(id);
      setMessage({ text: 'Правило успешно удалено', type: 'success' });
      setRules(rules.filter((r) => r.id !== id));
      if (selectedRuleId === id) {
        setSelectedRuleId(null);
        setEditingRuleId(null);
      }
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const handleDuplicateRule = async (id: number) => {
    try {
      const original = await api.getRule(id);
      const duplicate = {
        ...original,
        name: `${original.name} (копия)`,
        enabled: false,
      };
      delete (duplicate as any).id;
      
      const created = await api.createRule(duplicate);
      setMessage({ text: 'Правило успешно дублировано', type: 'success' });
      setRules([...rules, created]);
      setSelectedRuleId(created.id);
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const handleSaveRule = async (rule: Partial<Rule>) => {
    try {
      if (editingRuleId && editingRuleId !== -1) {
        const updated = await api.updateRule(editingRuleId, rule);
        setMessage({ text: 'Правило успешно обновлено', type: 'success' });
        setRules(rules.map((r) => (r.id === editingRuleId ? updated : r)));
        setSelectedRuleId(updated.id);
        setEditingRuleId(null);
      } else {
        const created = await api.createRule(rule);
        setMessage({ text: 'Правило успешно создано', type: 'success' });
        setRules([...rules, created]);
        setSelectedRuleId(created.id);
        setEditingRuleId(null);
      }
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
      throw error;
    }
  };

  return (
    <div className="rounded-lg border border-[hsl(var(--border)_/_0.7)] bg-[hsl(var(--card)_/_0.9)] shadow-md backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4">
        <h2 className="text-xl font-semibold">📋 Правила</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Поиск правил..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] py-2 pl-10 pr-3 text-sm transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
            />
          </div>
          <button className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-2 transition-all hover:bg-[hsl(var(--accent))]">
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mx-4 mt-4 animate-fade-in rounded border p-3 text-sm ${
            message.type === 'success'
              ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
              : message.type === 'error'
              ? 'border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
              : 'border-[hsl(var(--info)_/_0.3)] bg-[hsl(var(--info)_/_0.1)] text-[hsl(var(--info))]'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex gap-4 p-4">
        <div className="w-[500px] border-r border-[hsl(var(--border))] pr-4">
          <RulesList
            rules={filteredRules}
            selectedId={selectedRuleId}
            onSelect={handleSelectRule}
            loading={loading}
          />
        </div>

        <div className="flex-1 pl-4">
          {editingRuleId !== null ? (
            <RuleForm
              ruleId={editingRuleId === -1 ? null : editingRuleId}
              onSave={handleSaveRule}
              onCancel={() => {
                if (selectedRuleId) {
                  setEditingRuleId(null);
                } else {
                  handleCreateNew();
                }
              }}
            />
          ) : selectedRuleId ? (
            <RuleDetails
              ruleId={selectedRuleId}
              onEdit={handleEditRule}
              onDelete={handleDeleteRule}
              onDuplicate={handleDuplicateRule}
              onCreateNew={handleStartCreate}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[hsl(var(--muted-foreground))]">
              <p className="mb-4">Выберите правило из списка слева для редактирования или просмотра</p>
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
              >
                <Plus className="h-4 w-4" />
                Создать новое правило
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
