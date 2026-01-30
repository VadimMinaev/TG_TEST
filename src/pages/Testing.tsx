import { useState } from 'react';
import { api } from '../lib/api';

export function Testing() {
  const [testCondition, setTestCondition] = useState('payload.category === "incident"');
  const [testPayload, setTestPayload] = useState(`{
  "team_id": 40,
  "category": "incident",
  "impact": "medium",
  "subject": "Тестовая заявка"
}`);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testBotToken, setTestBotToken] = useState('');
  const [testChatId, setTestChatId] = useState('');
  const [testMessage, setTestMessage] = useState('Тестовое сообщение из webhook интеграции');
  const [telegramResult, setTelegramResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestCondition = () => {
    try {
      const payload = JSON.parse(testPayload);
      const fn = new Function('payload', `return ${testCondition}`);
      const result = fn(payload);
      setTestResult({
        success: true,
        message: `Результат: ${result ? 'TRUE' : 'FALSE'}`,
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Ошибка: ${error.message}`,
      });
    }
  };

  const handleTestTelegram = async () => {
    try {
      const result = await api.testSend(testChatId, testMessage, testBotToken || undefined);
      if (result.success) {
        setTelegramResult({
          success: true,
          message: `✅ Отправлено! Сообщение доставлено в чат ${testChatId}`,
        });
      } else {
        setTelegramResult({
          success: false,
          message: `❌ Ошибка: ${result.error?.description || result.error || 'Unknown error'}`,
        });
      }
    } catch (error: any) {
      setTelegramResult({
        success: false,
        message: `❌ Ошибка: ${error.message}`,
      });
    }
  };

  const handleSaveToken = async () => {
    try {
      await api.saveBotToken(testBotToken);
      setTelegramResult({
        success: true,
        message: '✅ Токен сохранен! Глобальный токен бота успешно сохранен.',
      });
    } catch (error: any) {
      setTelegramResult({
        success: false,
        message: `❌ Ошибка: ${error.message}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">🧪 Тестирование условий</h2>
        </div>
        <div className="card-body">

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">Условие</label>
          <input
            type="text"
            value={testCondition}
            onChange={(e) => setTestCondition(e.target.value)}
            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-sm"
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">Тестовый payload (JSON)</label>
          <textarea
            value={testPayload}
            onChange={(e) => setTestPayload(e.target.value)}
            rows={8}
            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-sm"
          />
        </div>

        <button
          onClick={handleTestCondition}
          className="rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
        >
          Протестировать условие
        </button>

        {testResult && (
          <div
            className={`mt-4 rounded border p-3 ${
              testResult.success
                ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                : 'border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
            }`}
          >
            {testResult.message}
          </div>
        )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">📤 Тест отправки в Telegram</h2>
        </div>
        <div className="card-body">

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">Токен бота для тестирования</label>
          <input
            type="password"
            value={testBotToken}
            onChange={(e) => setTestBotToken(e.target.value)}
            placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
          />
          <button
            onClick={handleSaveToken}
            className="mt-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-1 text-sm transition-all hover:bg-[hsl(var(--accent))]"
          >
            💾 Сохранить как глобальный токен
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">ID чата</label>
          <input
            type="text"
            value={testChatId}
            onChange={(e) => setTestChatId(e.target.value)}
            placeholder="-1001234567890"
            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">Тестовое сообщение</label>
          <textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            rows={4}
            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
          />
        </div>

        <button
          onClick={handleTestTelegram}
          className="rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
        >
          Отправить тестовое сообщение
        </button>

        {telegramResult && (
          <div
            className={`mt-4 rounded border p-3 ${
              telegramResult.success
                ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                : 'border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
            }`}
          >
            {telegramResult.message}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
