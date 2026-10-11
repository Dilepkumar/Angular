import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-speed-insights',
  standalone: true,
  template: '',
  styles: []
})
export class SpeedInsightsComponent implements OnInit {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const insights = injectSpeedInsights({
        framework: 'angular'
      });

      if (insights?.setRoute) {
        // Initial route
        insights.setRoute(window.location.pathname);

        // Update route on SPA navigation
        this.router.events
          .pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe(event => {
            insights.setRoute(event.urlAfterRedirects || event.url);
          });
      }
    }
  }
}
