import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Star, Trash2 } from 'lucide-react';
import { useT } from '@/lib/useT';
import { renderMarkdown } from '@/lib/markdown';
import { estimateTokens } from '@/lib/tokenizer';
import { useUi } from '@/store/ui';
import { Field, TextArea } from '@/components/ui/Primitives';

interface OpeningMessagesProps {
  /** The default opening first, then the alternates. */
  openings: string[];
  onChange: (openings: string[]) => void;
}

function OpeningCard({
  value,
  index,
  total,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
}: {
  value: string;
  index: number;
  total: number;
  onChange: (value: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const t = useT();
  const [preview, setPreview] = useState(false);

  return (
    <article className="opening-card">
      <header className="row">
        {index === 0 ? (
          <span className="chip tiny chip-accent">
            <Star size={11} />
            {t('greetings.default')}
          </span>
        ) : (
          <span className="chip tiny">{t('greetings.nth', { n: index + 1 })}</span>
        )}
        <span className="chip tiny">
          {estimateTokens(value)} {t('common.tokens')}
        </span>
        <span className="spacer" />
        <button
          type="button"
          className="msg-tool"
          onClick={() => setPreview((shown) => !shown)}
          aria-label={t('greetings.preview')}
          title={t('greetings.preview')}
        >
          {preview ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button
          type="button"
          className="msg-tool"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={index === 1 ? t('greetings.makeDefault') : t('regex.order')}
          title={index === 1 ? t('greetings.makeDefault') : t('regex.order')}
        >
          <ArrowUp size={15} />
        </button>
        <button
          type="button"
          className="msg-tool"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label={t('regex.order')}
        >
          <ArrowDown size={15} />
        </button>
        <button type="button" className="msg-tool" onClick={onDuplicate} aria-label={t('common.duplicate')}>
          <Copy size={15} />
        </button>
        <button
          type="button"
          className="msg-tool"
          data-danger="true"
          onClick={onDelete}
          aria-label={t('common.delete')}
        >
          <Trash2 size={15} />
        </button>
      </header>

      {preview ? (
        <div
          className="opening-preview msg-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value || '—') }}
        />
      ) : (
        <TextArea
          value={value}
          placeholder={t('greetings.placeholder')}
          style={{ minHeight: index === 0 ? 150 : 110 }}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </article>
  );
}

export function OpeningMessages({ openings, onChange }: OpeningMessagesProps) {
  const t = useT();
  const askConfirm = useUi((state) => state.askConfirm);

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= openings.length) return;
    const reordered = [...openings];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    onChange(reordered);
  };

  return (
    <Field
      label={t('greetings.title')}
      hint={t('greetings.subtitle')}
      action={
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...openings, ''])}>
          <Plus size={14} />
          {t('greetings.add')}
        </button>
      }
    >
      <div className="stack" style={{ gap: 'var(--space-3)' }}>
        {openings.map((opening, index) => (
          <OpeningCard
            key={index}
            value={opening}
            index={index}
            total={openings.length}
            onChange={(next) => onChange(openings.map((item, position) => (position === index ? next : item)))}
            onDuplicate={() => onChange([...openings.slice(0, index + 1), opening, ...openings.slice(index + 1)])}
            onMove={(direction) => move(index, direction)}
            onDelete={async () => {
              if (opening.trim() && !(await askConfirm(t('greetings.deleteConfirm'), true))) return;
              onChange(openings.filter((_, position) => position !== index));
            }}
          />
        ))}

        {!openings.length && (
          <p className="tiny muted">{t('greetings.empty')}</p>
        )}
      </div>
    </Field>
  );
}
