import { Component, OnInit, isDevMode } from '@angular/core';
import { inject as injectAnalytics } from '@vercel/analytics';

@Component({
  selector: 'app-analytics',
  standalone: true,
  template: '',
  styles: []
})
export class AnalyticsComponent implements OnInit {
  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      injectAnalytics({
        mode: isDevMode() ? 'development' : 'production',
        framework: 'angular'
      });
    }
  }
}
