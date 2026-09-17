import { Injectable, signal } from '@angular/core';

export type PopupType = 'success' | 'error' | 'warning' | 'info';

export interface ToastPopup {
  id: number;
  message: string;
  type: PopupType;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'primary' | 'warning';
}

export interface ActiveConfirmDialog {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: 'danger' | 'primary' | 'warning';
  resolve: (value: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class PopupService {
  private counter = 0;
  toasts = signal<ToastPopup[]>([]);
  confirmDialog = signal<ActiveConfirmDialog | null>(null);

  show(message: string, type: PopupType = 'info', durationMs = 3500): void {
    const id = ++this.counter;
    const toast: ToastPopup = { id, message, type };

    this.toasts.update(list => [...list, toast]);

    if (durationMs > 0) {
      setTimeout(() => {
        this.closeToast(id);
      }, durationMs);
    }
  }

  success(message: string, durationMs = 3500): void {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 4000): void {
    this.show(message, 'error', durationMs);
  }

  warning(message: string, durationMs = 4000): void {
    this.show(message, 'warning', durationMs);
  }

  info(message: string, durationMs = 3500): void {
    this.show(message, 'info', durationMs);
  }

  closeToast(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  confirm(optionsOrMessage: ConfirmDialogOptions | string, title = 'Confirmation'): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let options: ConfirmDialogOptions;
      if (typeof optionsOrMessage === 'string') {
        options = {
          title,
          message: optionsOrMessage,
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          type: 'primary'
        };
      } else {
        options = optionsOrMessage;
      }

      this.confirmDialog.set({
        title: options.title || 'Confirmation',
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        type: options.type || 'primary',
        resolve: (result: boolean) => {
          this.confirmDialog.set(null);
          resolve(result);
        }
      });
    });
  }

  resolveConfirm(result: boolean): void {
    const active = this.confirmDialog();
    if (active) {
      active.resolve(result);
    }
  }
}
