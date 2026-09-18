import { create } from 'zustand';
import { uid } from '@/lib/utils';

export type Route = 'chat' | 'characters' | 'personas' | 'lorebooks' | 'memory' | 'generator' | 'settings';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface UiState {
  route: Route;
  navOpen: boolean;
  panelOpen: boolean;
  settingsTab: string;
  editingCharacterId: string | null;
  editingPersonaId: string | null;
  editingLorebookId: string | null;
  toasts: Toast[];
  confirmRequest: { message: string; danger: boolean; resolve: (value: boolean) => void } | null;

  go(route: Route): void;
  setNavOpen(open: boolean): void;
  setPanelOpen(open: boolean): void;
  setSettingsTab(tab: string): void;
  editCharacter(id: string | null): void;
  editPersona(id: string | null): void;
  editLorebook(id: string | null): void;
  toast(message: string, tone?: Toast['tone']): void;
  dismissToast(id: string): void;
  askConfirm(message: string, danger?: boolean): Promise<boolean>;
  resolveConfirm(value: boolean): void;
}

export const useUi = create<UiState>((set, get) => ({
  route: 'chat',
  navOpen: false,
  panelOpen: false,
  settingsTab: 'connection',
  editingCharacterId: null,
  editingPersonaId: null,
  editingLorebookId: null,
  toasts: [],
  confirmRequest: null,

  go(route) {
    set({ route, navOpen: false });
  },
  setNavOpen(navOpen) {
    set({ navOpen });
  },
  setPanelOpen(panelOpen) {
    set({ panelOpen });
  },
  setSettingsTab(settingsTab) {
    set({ settingsTab });
  },
  editCharacter(editingCharacterId) {
    set({ editingCharacterId });
  },
  editPersona(editingPersonaId) {
    set({ editingPersonaId });
  },
  editLorebook(editingLorebookId) {
    set({ editingLorebookId });
  },

  toast(message, tone = 'info') {
    const toast: Toast = { id: uid(), message, tone };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== toast.id) })), 3600);
  },
  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
  },

  askConfirm(message, danger = false) {
    return new Promise<boolean>((resolve) => {
      set({ confirmRequest: { message, danger, resolve } });
    });
  },
  resolveConfirm(value) {
    const request = get().confirmRequest;
    request?.resolve(value);
    set({ confirmRequest: null });
  },
}));
