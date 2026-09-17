import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PopupService, ToastPopup, ActiveConfirmDialog } from '../../../../core/services/popup.service';

@Component({
  selector: 'app-popup-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- ═══════════════════════════════════════════
         FLOATING TOAST POPUPS (TOP-CENTER)
    ═══════════════════════════════════════════ -->
    <div class="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2.5 max-w-[92vw] sm:max-w-md w-full pointer-events-none px-3">
      @for (toast of popup.toasts(); track toast.id) {
        <div class="pointer-events-auto w-full p-3.5 sm:p-4 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-xs sm:text-sm font-bold transition-all transform animate-pop"
             [ngClass]="getToastClasses(toast.type)"
             style="background: var(--card); border-color: var(--border);">
          <div class="flex items-center gap-2.5 min-w-0">
            <i [class]="getToastIcon(toast.type)" class="text-base shrink-0"></i>
            <span class="break-words leading-tight" style="color: var(--text);">{{ toast.message }}</span>
          </div>
          <button type="button"
                  (click)="popup.closeToast(toast.id)"
                  class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black cursor-pointer hover:bg-white/20 transition shrink-0 opacity-70 hover:opacity-100"
                  style="color: var(--t2);"
                  title="Dismiss">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      }
    </div>

    <!-- ═══════════════════════════════════════════
         CONFIRMATION POPUP MODAL DIALOG
    ═══════════════════════════════════════════ -->
    @if (popup.confirmDialog(); as dialog) {
      <div class="fixed inset-0 bg-black/65 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-fade"
           (click)="popup.resolveConfirm(false)">
        <div class="w-full max-w-sm rounded-3xl p-6 border shadow-2xl relative overflow-hidden animate-scale"
             style="background: var(--card); border-color: var(--border);"
             (click)="$event.stopPropagation()">
          
          <!-- Header Icon & Title -->
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 shadow-sm"
                 [style.background]="getDialogIconBg(dialog.type)">
              <i [class]="getDialogIcon(dialog.type)" [style.color]="getDialogIconColor(dialog.type)"></i>
            </div>
            <div>
              <h3 class="text-base font-black tracking-tight" style="color: var(--text);">
                {{ dialog.title }}
              </h3>
            </div>
          </div>

          <!-- Message -->
          <p class="text-xs sm:text-[13px] font-medium leading-relaxed mb-6" style="color: var(--t2);">
            {{ dialog.message }}
          </p>

          <!-- Actions -->
          <div class="grid grid-cols-2 gap-2.5">
            <button type="button"
                    (click)="popup.resolveConfirm(false)"
                    class="py-2.5 px-4 rounded-xl text-xs font-black border transition cursor-pointer hover:bg-white/10"
                    style="background: var(--bg2); border-color: var(--border); color: var(--t2);">
              {{ dialog.cancelText }}
            </button>
            <button type="button"
                    (click)="popup.resolveConfirm(true)"
                    class="py-2.5 px-4 rounded-xl text-xs font-black text-white transition cursor-pointer shadow-md hover:brightness-110 active:scale-95"
                    [style.background]="getConfirmBtnBg(dialog.type)">
              {{ dialog.confirmText }}
            </button>
          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    .animate-pop {
      animation: popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .animate-scale {
      animation: scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .animate-fade {
      animation: fadeIn 0.2s ease-out forwards;
    }
    @keyframes popIn {
      from {
        opacity: 0;
        transform: translateY(-16px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.92);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `]
})
export class PopupHostComponent {
  popup = inject(PopupService);

  getToastClasses(type: string): string {
    switch (type) {
      case 'success':
        return 'border-emerald-500/30';
      case 'error':
        return 'border-rose-500/30';
      case 'warning':
        return 'border-amber-500/30';
      default:
        return 'border-teal-500/30';
    }
  }

  getToastIcon(type: string): string {
    switch (type) {
      case 'success':
        return 'fa-solid fa-circle-check text-emerald-400';
      case 'error':
        return 'fa-solid fa-circle-xmark text-rose-400';
      case 'warning':
        return 'fa-solid fa-triangle-exclamation text-amber-400';
      default:
        return 'fa-solid fa-circle-info text-teal-400';
    }
  }

  getDialogIcon(type: string): string {
    switch (type) {
      case 'danger':
        return 'fa-solid fa-trash-can';
      case 'warning':
        return 'fa-solid fa-triangle-exclamation';
      default:
        return 'fa-solid fa-circle-question';
    }
  }

  getDialogIconColor(type: string): string {
    switch (type) {
      case 'danger':
        return 'rgb(244 63 94)';
      case 'warning':
        return 'rgb(245 158 11)';
      default:
        return 'rgb(99, 230, 190)';
    }
  }

  getDialogIconBg(type: string): string {
    switch (type) {
      case 'danger':
        return 'color-mix(in srgb, rgb(244 63 94) 16%, transparent)';
      case 'warning':
        return 'color-mix(in srgb, rgb(245 158 11) 16%, transparent)';
      default:
        return 'color-mix(in srgb, rgb(99, 230, 190) 16%, transparent)';
    }
  }

  getConfirmBtnBg(type: string): string {
    switch (type) {
      case 'danger':
        return 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';
      case 'warning':
        return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      default:
        return 'linear-gradient(135deg, #10B981 0%, #047857 100%)';
    }
  }
}
