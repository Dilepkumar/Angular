import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { PopupService } from '../../core/services/popup.service';
import { Notification } from '../shared/models';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.scss']
})
export class NotificationsComponent implements OnInit {
  private api = inject(ApiService);
  push = inject(PushNotificationService);
  private popup = inject(PopupService);

  items = signal<Notification[]>([]);
  loading = signal<boolean>(true);
  sendingTest = signal<boolean>(false);

  ngOnInit(): void {
    this.load();
    this.push.checkSupportAndStatus();
  }

  load(): void {
    this.loading.set(true);
    this.api.get<Notification[]>('notifications').subscribe({
      next: (n) => {
        this.items.set(n || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  async togglePush(): Promise<void> {
    if (this.push.isSubscribed()) {
      const res = await this.push.unsubscribe();
      if (res.success) {
        this.popup.info(res.message);
      } else {
        this.popup.error(res.message);
      }
    } else {
      const res = await this.push.subscribe();
      if (res.success) {
        this.popup.success(res.message);
      } else {
        this.popup.error(res.message);
      }
    }
  }

  async sendTestPush(): Promise<void> {
    this.sendingTest.set(true);
    const res = await this.push.sendTestPush();
    this.sendingTest.set(false);
    if (res.success) {
      this.popup.success(res.message);
    } else {
      this.popup.error(res.message);
    }
  }

  iconClass(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('bill')) return 'fa-solid fa-file-invoice-dollar text-purple-400';
    if (t.includes('pool')) return 'fa-solid fa-wallet text-teal-400';
    if (t.includes('invite') || t.includes('member')) return 'fa-solid fa-user-group text-blue-400';
    if (t.includes('settle')) return 'fa-solid fa-handshake text-emerald-400';
    if (t.includes('reminder') || t.includes('iou')) return 'fa-solid fa-bell text-amber-400';
    if (t.includes('low') || t.includes('balance') || t.includes('alert')) return 'fa-solid fa-triangle-exclamation text-rose-400';
    return 'fa-solid fa-bell text-teal-400';
  }

  hasUnread(): boolean {
    return this.items().some(i => !i.isRead);
  }

  markAllRead(): void {
    this.api.post('notifications/mark-read', {}).subscribe({
      next: () => {
        this.popup.success('All notifications marked read');
        this.items.update(list => list.map(n => ({ ...n, isRead: true })));
      },
      error: () => this.popup.error('Failed to mark notifications read')
    });
  }

  back(): void {
    history.back();
  }
}
