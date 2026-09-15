import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { Notification } from '../shared/models';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './notifications.component.html'
})
export class NotificationsComponent implements OnInit {
  private api = inject(ApiService);
  items = signal<Notification[]>([]);

  ngOnInit() { this.load(); }
  load() { this.api.get<Notification[]>('notifications').subscribe(n => this.items.set(n)); }

  icon(type: string) {
    return type.includes('Bill') ? '📋' : type.includes('Pool') ? '💰'
         : type.includes('Invite') || type.includes('Member') ? '👥'
         : type.includes('Settle') ? '🤝' : '🔔';
  }
  hasUnread() { return this.items().some(i => !i.isRead); }

  markAllRead() {
    const ids = this.items().filter(i => !i.isRead).map(i => i.id);
    this.api.post('notifications/mark-read', ids).subscribe(() => this.load());
  }
  back() { history.back(); }
}
