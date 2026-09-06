import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Dashboard, DashCard } from '../shared/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  groupId = '';
  data = signal<Dashboard | null>(null);
  unreadCount = signal(0);
  me = this.auth.user;
  private timer?: number;

  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('groupId')!;
    this.load();
    this.api.get<{ count: number }>('notifications/unread-count')
      .subscribe(r => this.unreadCount.set(r.count));
    this.timer = window.setInterval(() => this.load(), 60_000);
  }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }

  load() {
    this.api.get<Dashboard>(`groups/${this.groupId}/dashboard`)
      .subscribe(d => this.data.set(d));
  }
  openNotifications() { this.router.navigate(['/notifications']); }
  abs(n: number) { return Math.abs(n); }

  bucketCards = computed(() => {
    const d = this.data();
    if (!d) return [];
    return [d.iou, d.bills, d.pool]
  .filter((b): b is DashCard => !!b)
  .map((b, i) => ({
    title: b.title ?? '',
    amount: b.primaryNumber ?? 0,
    badge: b.status === 'ok' ? 'OK' : b.status === 'attention' ? 'Pending' : 'Due',
    amountClass: (b.primaryNumber ?? 0) < 0 ? 'text-red-600' :
                 b.status === 'danger' ? 'text-amber-600' : 'text-slate-800',
    badgeClass: b.status === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                b.status === 'attention' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
    link: ['/', 'iou', 'bills', 'pool'][i + 1] ?? '/',
    bg: ['bg-blue-100', 'bg-emerald-100', 'bg-amber-100'][i] ?? 'bg-slate-100',
    icon: ['🤝', '📋', '💰'][i] ?? '💳',
    subtitle: b.title ?? ''
  }));

  });

  avatarColors(i: number) {
    const c = ['bg-violet-500', 'bg-emerald-500', 'bg-orange-500', 'bg-sky-500',
               'bg-pink-500', 'bg-teal-500', 'bg-amber-500', 'bg-indigo-500'];
    return c[i % c.length];
  }
}
