import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PopupHostComponent } from './features/shared/components/popup-host/popup-host.component';
import { LoadingService } from './core/services/loading.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, PopupHostComponent],
  template: `
    <!-- Top Glowing Loading Progress Bar -->
    @if (loadingService.isLoading()) {
      <div class="fixed top-0 inset-x-0 h-[3px] z-[99999] pointer-events-none overflow-hidden"
           style="background: rgba(26, 188, 156, 0.2);">
        <div class="h-full loading-bar-runner"
             style="background: linear-gradient(90deg, #1ABC9C, #26D4B2, #10B981, #1ABC9C); box-shadow: 0 0 10px #1ABC9C, 0 0 4px #26D4B2;">
        </div>
      </div>
    }

    <!-- Floating Page Transition Indicator on Route Change -->
    @if (loadingService.isNavigating()) {
      <div class="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-2xl backdrop-blur-md border pointer-events-none select-none animate-in fade-in zoom-in-95 duration-150"
           style="background: rgba(20, 35, 33, 0.92); border-color: rgba(38, 212, 178, 0.3); color: #ffffff; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 16px rgba(26, 188, 156, 0.35);">
        <i class="fa-solid fa-circle-notch fa-spin text-sm" style="color: #26D4B2;"></i>
        <span class="text-[11px] sm:text-xs font-black tracking-wide">{{ loadingService.navMessage() }}</span>
      </div>
    }

    <router-outlet />
    <app-popup-host />
  `,
  styles: [`
    @keyframes loadingRunner {
      0% {
        transform: translateX(-100%);
      }
      50% {
        transform: translateX(0%);
      }
      100% {
        transform: translateX(100%);
      }
    }
    .loading-bar-runner {
      width: 100%;
      animation: loadingRunner 1.2s infinite ease-in-out;
    }
  `]
})
export class AppComponent {
  loadingService = inject(LoadingService);
}
