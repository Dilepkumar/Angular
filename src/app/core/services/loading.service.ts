import { Injectable, signal, computed, inject } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private router = inject(Router);

  isNavigating = signal<boolean>(false);
  httpCount = signal<number>(0);
  navMessage = signal<string>('Loading page…');

  httpLoading = computed(() => this.httpCount() > 0);
  isLoading = computed(() => this.isNavigating() || this.httpLoading());

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.isNavigating.set(true);
        this.navMessage.set(this.resolvePageMessage(event.url));
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.isNavigating.set(false);
      }
    });
  }

  private resolvePageMessage(url: string): string {
    if (url.includes('/dashboard')) return 'Loading Dashboard…';
    if (url.includes('/bills')) return 'Loading Bills…';
    if (url.includes('/pool')) return 'Loading Daily Pool…';
    if (url.includes('/iou')) return 'Loading Group Split & IOUs…';
    if (url.includes('/log-expense')) return 'Opening Expense Logger…';
    if (url.includes('/history')) return 'Loading History…';
    if (url.includes('/profile')) return 'Loading Profile…';
    if (url.includes('/groups') || url === '/' || url === '') return 'Loading Flats…';
    if (url.includes('/notifications')) return 'Loading Notifications…';
    if (url.includes('/auth/login')) return 'Signing in…';
    if (url.includes('/auth/register')) return 'Opening Registration…';
    return 'Loading page…';
  }

  startHttp(): void {
    this.httpCount.update(c => c + 1);
  }

  endHttp(): void {
    this.httpCount.update(c => Math.max(0, c - 1));
  }
}
