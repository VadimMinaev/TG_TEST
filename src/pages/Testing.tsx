import { useState } from 'react';
import { api } from '../lib/api';
import { AiFieldAssist } from '../components/AIFieldAssist';

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
        message: `Результат: ${result ? 'TRUE ✅' : 'FALSE ❌'}`,
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
        message: '✅ Токен сохранен!',
      });
    } catch (error: any) {
      setTelegramResult({
        success: false,
        message: `❌ Ошибка: ${error.message}`,
      });
    }
  };

  return (
    <div className="card" style={{ overflow: 'clip' }}>
      <div className="card-header">
        <h2 className="text-xl font-semibold">🧪 Тестирование</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
        {/* Левая колонка - Тестирование условий */}
        <div className="panel">
          <h3 className="font-semibold" style={{ marginBottom: '16px' }}>🔍 Тестирование условий</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="form-label">
                <span>Условие (JavaScript)</span>
                <AiFieldAssist fieldName="Условие (JS)" fieldDescription="Напиши на русском условие для проверки. Например: проверь что category = incident и priority = high" currentValue={testCondition} onApply={setTestCondition} />
              </label>
              <input
                type="text"
                value={testCondition}
                onChange={(e) => setTestCondition(e.target.value)}
                placeholder='payload.category === "incident"'
                className="input-field input-field-mono"
              />
            </div>

            <div>
              <label className="form-label">
                <span>Тестовый payload (JSON)</span>
                <AiFieldAssist fieldName="Тестовый payload" fieldDescription="Опиши структуру JSON, которую нужно сгенерировать. Например: заявка с полями team_id, category, impact, subject" currentValue={testPayload} onApply={setTestPayload} />
              </label>
              <textarea
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                rows={6}
                className="textarea-field input-field-mono"
              />
            </div>

            <button onClick={handleTestCondition} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
              🚀 Протестировать
            </button>

            {testResult && (
              <div
                className={`animate-fade-in rounded p-3 text-sm ${
                  testResult.success
                    ? 'border border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                    : 'border border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка - Тест Telegram */}
        <div className="panel">
          <h3 className="font-semibold" style={{ marginBottom: '16px' }}>📤 Тест отправки в Telegram</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="form-label-simple">Токен бота</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={testBotToken}
                  onChange={(e) => setTestBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjkl..."
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleSaveToken}
                  className="btn-secondary"
                  style={{ padding: '10px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                  title="Сохранить как токен аккаунта"
                >
                  💾
                </button>
              </div>
            </div>

            <div>
              <label className="form-label-simple">ID чата</label>
              <input
                type="text"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
                placeholder="-1001234567890"
                className="input-field"
              />
            </div>

            <div>
              <label className="form-label-simple">Тестовое сообщение</label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={3}
                className="textarea-field"
              />
            </div>

            <button onClick={handleTestTelegram} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
              📨 Отправить
            </button>

            {telegramResult && (
              <div
                className={`animate-fade-in rounded p-3 text-sm ${
                  telegramResult.success
                    ? 'border border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                    : 'border border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                }`}
              >
                {telegramResult.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
