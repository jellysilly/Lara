import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useUi } from '@/store/ui';
import { useT } from '@/lib/useT';
import { Modal } from './Modal';

export function Toasts() {
  const toasts = useUi((state) => state.toasts);
  const dismiss = useUi((state) => state.dismissToast);
  if (!toasts.length) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} type="button" className="toast" data-tone={toast.tone} onClick={() => dismiss(toast.id)}>
          {toast.tone === 'error' ? (
            <AlertTriangle size={16} />
          ) : toast.tone === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <Info size={16} />
          )}
          <span className="truncate">{toast.message}</span>
        </button>
      ))}
    </div>
  );
}

export function ConfirmHost() {
  const request = useUi((state) => state.confirmRequest);
  const resolve = useUi((state) => state.resolveConfirm);
  const t = useT();

  return (
    <Modal
      open={Boolean(request)}
      title={t('common.confirm')}
      onClose={() => resolve(false)}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => resolve(false)}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={request?.danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => resolve(true)}
            autoFocus
          >
            {request?.danger ? t('common.delete') : t('common.confirm')}
          </button>
        </>
      }
    >
      <p>{request?.message}</p>
    </Modal>
  );
}
