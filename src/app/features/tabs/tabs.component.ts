import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

export interface NavTab {
  path: string;
  label: string;
  iconClass: string;
  isCenter?: boolean;
}

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.scss']
})
export class TabsComponent {
  tabs: NavTab[] = [
    { path: 'dashboard', label: 'Home', iconClass: 'fa-solid fa-house' },
    { path: 'iou', label: 'Settle', iconClass: 'fa-solid fa-handshake' },
    { path: 'log-expense', label: 'Add', iconClass: 'fa-solid fa-plus', isCenter: true },
    { path: 'bills', label: 'Bills', iconClass: 'fa-solid fa-receipt' },
    { path: 'pool', label: 'Pool', iconClass: 'fa-solid fa-wallet' },
  ];
}
