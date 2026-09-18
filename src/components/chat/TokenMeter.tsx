import { useMemo } from 'react';
import type { BuiltPrompt } from '@/types';
import { useT, useLocale } from '@/lib/useT';
import { formatNumber } from '@/lib/utils';
import { useSettings } from '@/store/settings';
import type { TranslationKey } from '@/i18n';

const SECTION_COLORS: Record<string, string> = {
  system: 'var(--brand-4)',
  character: 'var(--brand-2)',
  persona: 'var(--brand-1)',
  lore: 'var(--brand-3)',
  memory: 'var(--accent-ink)',
  examples: 'color-mix(in srgb, var(--text) 30%, transparent)',
  history: 'var(--accent)',
  authorNote: 'color-mix(in srgb, var(--text) 50%, transparent)',
  jailbreak: 'color-mix(in srgb, var(--text) 18%, transparent)',
};

export function useContextBudget(prompt: BuiltPrompt | null) {
  const contextSize = useSettings((state) => state.prompt.contextSize);
  const responseTokens = useSettings((state) => state.prompt.responseTokens);

  return useMemo(() => {
    const used = prompt?.total ?? 0;
    const available = Math.max(1, contextSize - responseTokens);
    return {
      used,
      available,
      contextSize,
      responseTokens,
      left: available - used,
      ratio: Math.min(1, used / available),
      over: used > available,
    };
  }, [prompt, contextSize, responseTokens]);
}

export function TokenBar({ prompt }: { prompt: BuiltPrompt | null }) {
  const t = useT();
  const locale = useLocale();
  const budget = useContextBudget(prompt);

  return (
    <div className="token-meter" data-over={budget.over ? 'true' : 'false'} title={t('tokens.context')}>
      <div className="meter">
        {(prompt?.sections ?? []).map((section) => (
          <span
            key={section.id}
            style={{
              width: `${(section.tokens / budget.available) * 100}%`,
              background: SECTION_COLORS[section.id] ?? 'var(--accent)',
            }}
          />
        ))}
      </div>
      <span className="tiny" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {formatNumber(budget.used, locale)} / {formatNumber(budget.available, locale)}
      </span>
    </div>
  );
}

export function TokenBreakdown({ prompt }: { prompt: BuiltPrompt | null }) {
  const t = useT();
  const locale = useLocale();
  const budget = useContextBudget(prompt);
  const sections = prompt?.sections ?? [];

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="meter" style={{ height: 10 }}>
        {sections.map((section) => (
          <span
            key={section.id}
            style={{
              width: `${(section.tokens / budget.available) * 100}%`,
              background: SECTION_COLORS[section.id] ?? 'var(--accent)',
            }}
          />
        ))}
      </div>

      <div className="row tiny muted">
        <span>
          {formatNumber(budget.used, locale)} {t('tokens.used')}
        </span>
        <span className="spacer" />
        <span style={{ color: budget.over ? 'var(--danger)' : undefined }}>
          {formatNumber(Math.max(0, budget.left), locale)} {t('tokens.left')}
        </span>
      </div>

      <div className="token-legend">
        {sections.map((section) => (
          <div className="token-legend-row" key={section.id}>
            <span
              className="token-legend-dot"
              style={{ background: SECTION_COLORS[section.id] ?? 'var(--accent)' }}
            />
            <span className="truncate">{t(section.label as TranslationKey)}</span>
            <span className="muted tiny" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(section.tokens, locale)}
            </span>
          </div>
        ))}
        <div className="token-legend-row">
          <span className="token-legend-dot" style={{ background: 'transparent', border: '1px dashed var(--border-strong)' }} />
          <span className="truncate muted">{t('tokens.reserved')}</span>
          <span className="muted tiny" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatNumber(budget.responseTokens, locale)}
          </span>
        </div>
      </div>

      {budget.over && <p className="tiny" style={{ color: 'var(--danger)' }}>{t('tokens.overflow')}</p>}
    </div>
  );
}

export function UsageStats() {
  const t = useT();
  const locale = useLocale();
  const total = useSettings((state) => state.totalUsage);
  const session = useSettings((state) => state.sessionUsage);
  const allowance = useSettings((state) => state.tokenAllowance);
  const spent = total.prompt + total.completion;

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="usage-grid">
        <div className="token-stat">
          <b>{formatNumber(session.prompt + session.completion, locale)}</b>
          <span>{t('tokens.session')}</span>
        </div>
        <div className="token-stat">
          <b>{formatNumber(spent, locale)}</b>
          <span>{t('tokens.total')}</span>
        </div>
        <div className="token-stat">
          <b>{formatNumber(total.prompt, locale)}</b>
          <span>{t('tokens.prompt')}</span>
        </div>
        <div className="token-stat">
          <b>{formatNumber(total.completion, locale)}</b>
          <span>{t('tokens.completion')}</span>
        </div>
      </div>

      {allowance > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="meter">
            <span
              style={{
                width: `${Math.min(100, (spent / allowance) * 100)}%`,
                background: spent > allowance ? 'var(--danger)' : 'linear-gradient(90deg, var(--brand-1), var(--brand-2))',
              }}
            />
          </div>
          <span className="tiny muted">
            {t('tokens.allowanceLeft', {
              n: formatNumber(Math.max(0, allowance - spent), locale),
              total: formatNumber(allowance, locale),
            })}
          </span>
        </div>
      )}
    </div>
  );
}
