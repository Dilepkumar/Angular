import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PopupHostComponent } from './features/shared/components/popup-host/popup-host.component';
import { LoadingService } from './core/services/loading.service';
import { AnalyticsComponent } from './core/components/analytics/analytics.component';
import { SpeedInsightsComponent } from './core/components/speed-insights/speed-insights.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, PopupHostComponent, AnalyticsComponent, SpeedInsightsComponent],
  template: `
    <!-- Cold-Boot Splash Screen Overlay (Runs smoothly on app opening, then fades out) -->
    @if (splashVisible()) {
      <div class="rl-splash-overlay" [class.rl-splash-fadeout]="splashFading()">
        <div class="rl-logo-wrapper">
          <div class="rl-logo-glow"></div>
          <img class="rl-main-logo" src="icons/icon-192x192.png" srcset="icons/icon-512x512.png 2x" alt="RoomLedger Logo" width="96" height="96" />
        </div>
        <div class="rl-tag">Smart Expense Sharing</div>
        <div class="rl-loader-pill">
          <div class="rl-spinner-dot"></div>
          <span>Starting RoomLedger…</span>
        </div>
      </div>
    }

    <!-- Top Glowing Loading Progress Bar -->
    @if (loadingService.isLoading()) {
      <div class="fixed top-0 inset-x-0 h-[3px] z-[99999] pointer-events-none overflow-hidden"
           style="background: rgba(26, 188, 156, 0.2);">
        <div class="h-full loading-bar-runner"
             style="background: linear-gradient(90deg, #1ABC9C, #26D4B2, #10B981, #1ABC9C); box-shadow: 0 0 10px #1ABC9C, 0 0 4px #26D4B2;">
        </div>
      </div>
    }

    <router-outlet />
    <app-popup-host />
    <app-analytics />
    <app-speed-insights />
  `,
  styles: [`
    .rl-splash-overlay {
      position: fixed;
      inset: 0;
      background: #F8FFFE;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      transition: opacity 0.35s ease;
      opacity: 1;
    }
    .rl-splash-overlay.rl-splash-fadeout {
      opacity: 0;
      pointer-events: none;
    }
    .rl-logo-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .rl-logo-glow {
      position: absolute;
      width: 120px;
      height: 120px;
      border-radius: 32px;
      background: radial-gradient(circle, rgba(26, 188, 156, 0.45) 0%, rgba(26, 188, 156, 0) 70%);
      filter: blur(12px);
      z-index: 1;
      opacity: 0;
      animation: rlGlowPulse 1.6s ease-out 0.2s forwards;
    }
    .rl-main-logo {
      position: relative;
      width: 96px;
      height: 96px;
      border-radius: 24px;
      object-fit: cover;
      z-index: 2;
      box-shadow: 
        0 16px 36px -10px rgba(0, 0, 0, 0.22),
        0 6px 16px rgba(26, 188, 156, 0.25);
      animation: rlSpringIn 0.85s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      transform-origin: center center;
    }
    .rl-tag {
      margin-top: 18px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #1ABC9C;
      opacity: 0;
      animation: rlFadeUp 0.55s ease-out 0.28s forwards;
      z-index: 2;
    }
    .rl-loader-pill {
      margin-top: 22px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 999px;
      background: rgba(26, 188, 156, 0.1);
      color: #12826c;
      border: 1px solid rgba(26, 188, 156, 0.2);
      font-size: 11px;
      font-weight: 600;
      opacity: 0;
      animation: rlFadeUp 0.5s ease-out 0.45s forwards;
      z-index: 2;
    }
    .rl-spinner-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #1ABC9C;
      animation: rlPulse 1s infinite ease-in-out;
    }
    @keyframes rlSpringIn {
      0% {
        opacity: 0;
        transform: scale(0.4) translateY(20px) rotate(-3deg);
      }
      60% {
        opacity: 1;
        transform: scale(1.06) translateY(-2px) rotate(0.5deg);
      }
      80% {
        transform: scale(0.97) translateY(1px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0) rotate(0);
      }
    }
    @keyframes rlGlowPulse {
      0% { opacity: 0; transform: scale(0.5); }
      60% { opacity: 0.9; transform: scale(1.15); }
      100% { opacity: 0.6; transform: scale(1); }
    }
    @keyframes rlFadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes rlPulse {
      0%, 100% { opacity: 0.4; transform: scale(0.85); }
      50% { opacity: 1; transform: scale(1.25); }
    }

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
export class AppComponent implements OnInit {
  loadingService = inject(LoadingService);
  splashVisible = signal<boolean>(true);
  splashFading = signal<boolean>(false);

  ngOnInit() {
    // Keep splash animation visible for 1.1s on initial boot so the spring animation plays, then smoothly fade out
    setTimeout(() => {
      this.splashFading.set(true);
      setTimeout(() => {
        this.splashVisible.set(false);
      }, 350);
    }, 1100);
  }
}
