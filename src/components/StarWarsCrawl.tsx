/**
 * LoginIntro — decorative terminal-style boot sequence animation.
 * Lines appear one by one with a typing cursor effect.
 *
 * Feature flag: set ENABLE_INTRO to false to disable.
 */
import { useState, useEffect } from 'react';

const ENABLE_INTRO = true;

const LINES = [
  { text: '> initializing VadminLink v1.0 …', delay: 300 },
  { text: '> loading webhook router ………… ok', delay: 1200 },
  { text: '> polling scheduler online ……… ok', delay: 2000 },
  { text: '> HTTP integrations ready ……… ok', delay: 2800 },
  { text: '> Telegram bot engine ………………… ok', delay: 3600 },
  { text: '> all systems operational', delay: 4400 },
  { text: '> awaiting authentication_', delay: 5200 },
];

export function LoginIntro() {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!ENABLE_INTRO) return;

    const timers = LINES.map((line, i) =>
      setTimeout(() => setVisibleCount(i + 1), line.delay)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  if (!ENABLE_INTRO) return null;

  return (
    <div className="intro-viewport" aria-hidden="true">
      <div className="intro-lines">
        {LINES.slice(0, visibleCount).map((line, i) => (
          <div
            key={i}
            className={`intro-line ${i === visibleCount - 1 ? 'intro-line-active' : ''}`}
          >
            <span className="intro-text">{line.text}</span>
            {i === visibleCount - 1 && <span className="intro-cursor" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Keep backward compat export name used in Login.tsx
export { LoginIntro as StarWarsCrawl };
