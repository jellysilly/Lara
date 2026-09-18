import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  GitBranch,
  Pencil,
  RefreshCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { Message as MessageModel } from '@/types';
import { renderMarkdown } from '@/lib/markdown';
import { applyRegexScripts } from '@/lib/regex';
import { copyText, formatTime, formatNumber } from '@/lib/utils';
import { useT, useLocale } from '@/lib/useT';
import { useSettings } from '@/store/settings';
import { useChats, messageText } from '@/store/chats';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { Avatar } from '@/components/ui/Avatar';

interface MessageProps {
  message: MessageModel;
  isLast: boolean;
  streaming: boolean;
  /** Distance from the newest message, so depth-scoped regex scripts can match. */
  depth: number;
}

function Typing() {
  return (
    <span className="typing" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

export const MessageBubble = memo(function MessageBubble({ message, isLast, streaming, depth }: MessageProps) {
  const t = useT();
  const locale = useLocale();
  const avatarSize = useSettings((state) => state.appearance.avatarSize);
  const regexScripts = useSettings((state) => state.regexScripts);
  const characterId = useChats((state) => state.chat?.characterId);
  const character = useLibrary((state) => state.characters.find((item) => item.id === characterId));
  const generating = useChats((state) => state.generating);
  const { editMessage, deleteMessage, toggleHidden, swipe, branchFrom, generate } = useChats.getState();
  const toast = useUi((state) => state.toast);
  const askConfirm = useUi((state) => state.askConfirm);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const text = messageText(message);

  // The transcript shows the rewritten text; edits still work on the original.
  const displayText = useMemo(
    () =>
      applyRegexScripts(text, regexScripts, {
        target: message.role,
        stage: 'display',
        depth,
        characterId,
        macros: { character },
      }),
    [text, regexScripts, message.role, depth, characterId, character],
  );

  const canSwipe = message.role === 'assistant' && (message.swipes.length > 1 || (isLast && !message.isGreeting));

  useEffect(() => {
    if (editing) {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(draft.length, draft.length);
    }
  }, [editing, draft.length]);

  const startEdit = () => {
    setDraft(text);
    setEditing(true);
  };

  const commitEdit = () => {
    editMessage(message.id, draft);
    setEditing(false);
  };

  const copy = async () => {
    const copied = await copyText(displayText);
    toast(copied ? t('toast.copied') : t('toast.error'), copied ? 'success' : 'error');
  };

  const remove = async () => {
    if (await askConfirm(t('chat.deleteMessage'), true)) deleteMessage(message.id);
  };

  return (
    <article
      className="msg"
      data-role={message.role}
      data-hidden={message.hidden ? 'true' : undefined}
      data-touch={revealed ? 'true' : undefined}
    >
      <Avatar className="msg-avatar" name={message.name} src={message.avatar} size={avatarSize} />

      <div className="msg-body">
        <header className="msg-head">
          <span className="msg-name">{message.name}</span>
          <span className="msg-time">{formatTime(message.createdAt, locale)}</span>
          {message.hidden && <span className="chip tiny">{t('chat.hidden')}</span>}
        </header>

        {editing ? (
          <>
            <textarea
              ref={editorRef}
              className="msg-editor"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) commitEdit();
                if (event.key === 'Escape') setEditing(false);
              }}
            />
            <div className="row">
              <button type="button" className="btn btn-sm btn-primary" onClick={commitEdit}>
                <Check size={15} />
                {t('common.save')}
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
                <X size={15} />
                {t('common.cancel')}
              </button>
            </div>
          </>
        ) : (
          <div
            className="msg-content"
            onClick={() => {
              // Touch devices have no hover, so a tap reveals the toolbelt.
              if (window.matchMedia('(pointer: coarse)').matches) setRevealed((value) => !value);
            }}
          >
            {displayText ? (
              <>
                <span dangerouslySetInnerHTML={{ __html: renderMarkdown(displayText) }} />
                {streaming && <span className="caret" />}
              </>
            ) : streaming ? (
              <Typing />
            ) : (
              <span className="muted small">…</span>
            )}
          </div>
        )}

        {!editing && !streaming && (
          <div className="msg-tools">
            {canSwipe && (
              <span className="swipes">
                <button
                  type="button"
                  className="msg-tool"
                  onClick={() => swipe(message.id, -1)}
                  disabled={message.swipeIndex === 0}
                  aria-label={t('chat.swipeLeft')}
                >
                  <ChevronLeft size={15} />
                </button>
                <span>
                  {message.swipeIndex + 1}/{message.swipes.length}
                </span>
                <button
                  type="button"
                  className="msg-tool"
                  onClick={() => swipe(message.id, 1)}
                  disabled={generating || (message.swipeIndex === message.swipes.length - 1 && !isLast)}
                  aria-label={t('chat.swipeRight')}
                >
                  <ChevronRight size={15} />
                </button>
              </span>
            )}

            <button type="button" className="msg-tool" onClick={startEdit} aria-label={t('chat.editMessage')}>
              <Pencil size={15} />
            </button>
            <button type="button" className="msg-tool" onClick={copy} aria-label={t('common.copy')}>
              <Copy size={15} />
            </button>
            {isLast && message.role === 'assistant' && !message.isGreeting && (
              <button
                type="button"
                className="msg-tool"
                onClick={() => generate({ asSwipe: true })}
                disabled={generating}
                aria-label={t('common.regenerate')}
              >
                <RefreshCcw size={15} />
              </button>
            )}
            <button
              type="button"
              className="msg-tool"
              onClick={() => toggleHidden(message.id)}
              aria-label={message.hidden ? t('chat.show') : t('chat.hide')}
            >
              {message.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
            <button
              type="button"
              className="msg-tool"
              onClick={async () => {
                await branchFrom(message.id);
                toast(t('chat.branched'), 'success');
              }}
              aria-label={t('chat.branch')}
            >
              <GitBranch size={15} />
            </button>
            <button type="button" className="msg-tool" data-danger="true" onClick={remove} aria-label={t('common.delete')}>
              <Trash2 size={15} />
            </button>

            {message.usage && (
              <span className="msg-usage" title={t('tokens.title')}>
                {formatNumber(message.usage.completion, locale)} {t('common.tokens')}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
