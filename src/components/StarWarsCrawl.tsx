/**
 * StarWarsCrawl — decorative intro animation for the login page.
 * Pure CSS perspective crawl inspired by the Star Wars opening.
 *
 * Feature flag: set ENABLE_CRAWL to false to disable.
 */

const ENABLE_CRAWL = true;

export function StarWarsCrawl() {
  if (!ENABLE_CRAWL) return null;

  return (
    <div className="crawl-viewport" aria-hidden="true">
      <div className="crawl-fade" />
      <div className="crawl-perspective">
        <div className="crawl-content">
          <p className="crawl-preamble">Давным-давно, в далёкой-далёкой серверной…</p>

          <h2 className="crawl-episode">
            ЭПИЗОД&nbsp;I
            <br />
            <span>НАЧАЛО ИНТЕГРАЦИИ</span>
          </h2>

          <div className="crawl-body">
            <p>
              В мире, где данные несутся непрерывным потоком
              между сервисами, родилась платформа, способная
              укротить этот хаос.
            </p>
            <p>
              VadminLink объединил вебхуки, пуллинг,
              HTTP-интеграции и умных ботов в единую
              экосистему, подчинив себе Telegram-каналы
              и расписания.
            </p>
            <p>
              Каждый входящий сигнал проходит через правила
              маршрутизации, каждый отклик отслеживается
              в истории, каждое уведомление безошибочно
              находит свой канал.
            </p>
            <p>
              Автоматизация стала неизбежной. Голосования
              уходят по расписанию, интеграции срабатывают
              мгновенно, а ботам не нужен сон.
            </p>
            <p>
              Теперь, когда все системы готовы, пришло время
              войти и взять управление в свои руки…
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
