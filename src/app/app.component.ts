import { Component, inject } from '@angular/core';
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
