import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CornerDownLeft, Send, Square, Sparkles, WandSparkles } from 'lucide-react';
import type { BuiltPrompt } from '@/types';
import { useT } from '@/lib/useT';
import { useChats, onImpersonate } from '@/store/chats';
import { TokenBar } from './TokenMeter';

const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

export function Composer({
  prompt,
  onDraftChange,
}: {
  prompt: BuiltPrompt | null;
  onDraftChange: (value: string) => void;
}) {
  const t = useT();
  const generating = useChats((state) => state.generating);
  const send = useChats((state) => state.send);
  const stop = useChats((state) => state.stop);
  const generate = useChats((state) => state.generate);

  const [draft, setDraft] = useState('');
  const [impersonating, setImpersonating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, window.innerHeight * 0.34)}px`;
  }, []);

  useEffect(resize, [draft, resize]);

  useEffect(
    () =>
      onImpersonate((text) => {
        setDraft(text);
        onDraftChange(text);
      }),
    [onDraftChange],
  );

  useEffect(() => {
    if (!generating) setImpersonating(false);
  }, [generating]);

  const update = (value: string) => {
    setDraft(value);
    onDraftChange(value);
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text || generating) return;
    update('');
    await send(text);
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <div className="composer-box">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            placeholder={t('chat.placeholder')}
            onChange={(event) => update(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !isCoarsePointer()) {
                event.preventDefault();
                void submit();
              }
            }}
            aria-label={t('chat.placeholder')}
          />

          <div className="composer-actions">
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              title={t('chat.impersonate')}
              disabled={generating}
              onClick={() => {
                setImpersonating(true);
                void generate({ impersonate: true, pendingUserText: draft });
              }}
            >
              <WandSparkles size={17} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              title={t('chat.continue')}
              disabled={generating}
              onClick={() => void generate({ continueLast: true })}
            >
              <ArrowRight size={17} />
            </button>

            {generating ? (
              <button type="button" className="send-btn" data-stop="true" onClick={stop} title={t('common.stop')}>
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                className="send-btn"
                onClick={() => void submit()}
                disabled={!draft.trim()}
                title={t('chat.send')}
              >
                <Send size={17} />
              </button>
            )}
          </div>
        </div>

        <div className="composer-bar">
          <TokenBar prompt={prompt} />
          {impersonating && generating ? (
            <span className="row tiny">
              <Sparkles size={13} /> {t('chat.impersonate')}
            </span>
          ) : (
            <span className="row tiny desktop-only" style={{ opacity: 0.7 }}>
              <span className="kbd">
                <CornerDownLeft size={10} />
              </span>
              {t('chat.send')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
