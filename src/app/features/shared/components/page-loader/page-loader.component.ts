import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="py-20 sm:py-24 text-center flex flex-col items-center justify-center fade-up" style="color: var(--t3);">
      <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-md transition hover:scale-105"
           style="background: color-mix(in srgb, var(--p1) 15%, transparent); color: var(--p1); border: 1.5px solid color-mix(in srgb, var(--p1) 30%, transparent);">
        <i class="fa-solid fa-circle-notch fa-spin text-2xl"></i>
      </div>
      <div class="text-base font-black tracking-tight" style="color: var(--text);">{{ title }}</div>
      @if (subtitle) {
        <div class="text-xs font-medium mt-1 max-w-xs sm:max-w-md mx-auto" style="color: var(--t3);">{{ subtitle }}</div>
      }
    </div>
  `
})
export class PageLoaderComponent {
  @Input() title: string = 'Loading…';
  @Input() subtitle?: string;
}
