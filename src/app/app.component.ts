import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PopupHostComponent } from './features/shared/components/popup-host/popup-host.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PopupHostComponent],
  template: `
    <router-outlet />
    <app-popup-host />
  `
})
export class AppComponent {}
