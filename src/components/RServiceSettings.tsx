import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, RefreshCw, Server, ShieldCheck, Trash2 } from 'lucide-react';
import { api, RServiceSettings as Settings } from '../lib/api';
import { useToast } from './ToastNotification';

interface Props {
  canEdit: boolean;
  onOpenHttp: () => void;
}

export function RServiceSettings({ canEdit, onOpenHttp }: Props) {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<Settings>({ configured: false });
  const [portalUrl, setPortalUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const value = await api.getRServiceSettings();
      setSettings(value);
      setPortalUrl(value.portalUrl || '');
    } catch (error: any) {
      addToast(error.message || 'Не удалось загрузить R-Service', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      const value = await api.saveRServiceSettings({ portalUrl: portalUrl.trim(), accessToken: accessToken.trim() || undefined });
      setSettings(value);
      setPortalUrl(value.portalUrl || portalUrl);
      setAccessToken('');
      addToast(`R-Service подключён${value.user?.name ? `: ${value.user.name}` : ''}`, 'success');
    } catch (error: any) {
      addToast(error.message || 'Подключение не удалось', 'error');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    try {
      setSaving(true);
      const result = await api.testRServiceSettings();
      addToast(`Соединение работает${result.user?.name ? `: ${result.user.name}` : ''}`, 'success');
    } catch (error: any) {
      addToast(error.message || 'Проверка не пройдена', 'error');
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Отключить R-Service и удалить сохранённый токен?')) return;
    try {
      await api.deleteRServiceSettings();
      setSettings({ configured: false });
      setPortalUrl('');
      setAccessToken('');
      addToast('R-Service отключён', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось отключить R-Service', 'error');
    }
  };

  return (
    <div className="card r-service-page">
      <div className="integration-mode-tabs" role="tablist" aria-label="Тип интеграции">
        <button type="button" className="integration-mode-tab" onClick={onOpenHttp}>HTTP-интеграции</button>
        <button type="button" className="integration-mode-tab active" role="tab" aria-selected="true">R-Service</button>
      </div>

      <div className="card-header r-service-header">
        <div>
          <div className="r-service-eyebrow">Внешняя ITSM-система</div>
          <h2 className="text-xl font-semibold">R-Service</h2>
          <p>Подключение для голосовых и текстовых запросов AI-бота</p>
        </div>
        <div className={`r-service-status ${settings.configured ? 'connected' : ''}`}>
          {settings.configured ? <CheckCircle2 size={16} /> : <Server size={16} />}
          {settings.configured ? 'Подключено' : 'Не настроено'}
        </div>
      </div>

      <div className="r-service-content">
        {loading ? <div className="fp-loading"><div className="fp-spinner" /></div> : (
          <form className="r-service-form" onSubmit={save}>
            <div className="r-service-security-note">
              <ShieldCheck size={20} />
              <div><strong>Безопасный read-only доступ</strong><span>Токен хранится на сервере и никогда не передаётся AI-модели. Бот может только читать запросы.</span></div>
            </div>

            {settings.configured && (
              <div className="r-service-connection-grid">
                <div><span>Пользователь</span><strong>{settings.user?.name || 'Не определён'}</strong></div>
                <div><span>Account ID</span><strong>{settings.account}</strong></div>
                <div><span>Токен</span><strong>{settings.tokenMask}</strong></div>
                <div><span>API</span><strong>{settings.apiBaseUrl}</strong></div>
              </div>
            )}

            <div className="r-service-fields">
              <div>
                <label className="form-label-simple" htmlFor="r-service-url">URL портала R-Service</label>
                <input id="r-service-url" className="fp-input" type="url" value={portalUrl} onChange={e => setPortalUrl(e.target.value)} placeholder="https://pro-product.r-service.tech" required disabled={!canEdit} />
                <p className="r-service-help">По адресу портала система сама определит окружение, API URL и обязательный account ID.</p>
              </div>
              <div>
                <label className="form-label-simple" htmlFor="r-service-token">Personal Access Token</label>
                <div className="r-service-token-field">
                  <input id="r-service-token" className="fp-input" type={showToken ? 'text' : 'password'} value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder={settings.configured ? 'Оставьте пустым, чтобы не менять токен' : 'Вставьте токен'} required={!settings.configured} disabled={!canEdit} autoComplete="new-password" />
                  <button type="button" className="icon-button" onClick={() => setShowToken(value => !value)} aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}>{showToken ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </div>
              </div>
            </div>

            <div className="r-service-examples">
              <strong>После подключения AI-бот понимает свободные формулировки</strong>
              <span>«Покажи запросы, назначенные на меня»</span>
              <span>«Какие запросы у команды Service Desk?»</span>
              <span>«Что назначено на Вадима Минаева?»</span>
              <span>«Где срок решения истекает меньше чем через сутки?»</span>
              <span>«Покажи запрос № 70470»</span>
            </div>

            <div className="r-service-actions">
              {settings.configured && <button type="button" className="btn-secondary" onClick={test} disabled={saving}><RefreshCw size={15} /> Проверить</button>}
              {canEdit && <button type="submit" className="btn-primary" disabled={saving || !portalUrl.trim()}>{saving ? 'Проверяем…' : 'Сохранить и проверить'}</button>}
              {canEdit && settings.configured && <button type="button" className="fp-btn fp-btn-danger" onClick={disconnect} disabled={saving}><Trash2 size={15} /> Отключить</button>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
