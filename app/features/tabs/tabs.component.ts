import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './tabs.component.html'
})
export class TabsComponent {
  tabs = [
    { path: 'dashboard', icon: '🏠', label: 'Home' },
    { path: 'iou', icon: '🤝', label: 'Settle' },
    { path: 'bills', icon: '📋', label: 'Bills' },
    { path: 'pool', icon: '🛒', label: 'Pool' },
  ];
}
