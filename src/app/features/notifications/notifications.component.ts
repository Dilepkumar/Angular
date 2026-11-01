import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { PopupService } from '../../core/services/popup.service';
import { Notification } from '../shared/models';
import { PageLoaderComponent } from '../shared/components/page-loader/page-loader.component';

export interface SwipeItemState {
  startX: number;
  startY: number;
  currentX: number;
  swiping: boolean;
  isScrolling: boolean;
  committed: boolean;
  collapsing: boolean;
  action: 'read' | 'delete' | null;
  pointerId?: number;
}

export interface SnackbarState {
  show: boolean;
  message: string;
  icon: string;
  type: 'read' | 'delete';
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, DatePipe, PageLoaderComponent],
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

  // Swipe-to-action state tracking
  private swipeMap = new Map<string | number, SwipeItemState>();
  activeSwipeId = signal<string | number | null>(null);
  activeSwipeOffset = signal<number>(0);
  activeSwipeCommitted = signal<boolean>(false);
  activeSwipeAction = signal<'read' | 'delete' | null>(null);

  // Set of collapsing notification IDs
  collapsingIds = signal<Set<string | number>>(new Set());

  // Bottom action feedback snackbar
  snackbar = signal<SnackbarState>({
    show: false,
    message: '',
    icon: '',
    type: 'read'
  });
  private snackbarTimeout: any = null;

  readonly SWIPE_THRESHOLD = 100;

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

  // ────────────── Swipe Helper Queries ──────────────
  getSwipeOffset(id: string | number): number {
    if (this.activeSwipeId() === id) {
      return this.activeSwipeOffset();
    }
    return 0;
  }

  isSwiping(id: string | number): boolean {
    return this.activeSwipeId() === id && !this.activeSwipeCommitted();
  }

  isCommitted(id: string | number): boolean {
    return this.activeSwipeId() === id && this.activeSwipeCommitted();
  }

  isCollapsing(id: string | number): boolean {
    return this.collapsingIds().has(id);
  }

  getSwipeAction(id: string | number): 'read' | 'delete' | null {
    if (this.activeSwipeId() === id) {
      return this.activeSwipeAction();
    }
    return null;
  }

  isThresholdReached(id: string | number): boolean {
    return Math.abs(this.getSwipeOffset(id)) >= this.SWIPE_THRESHOLD;
  }

  // ────────────── Touch Gesture Handlers ──────────────
  onTouchStart(e: TouchEvent, item: Notification): void {
    if (e.touches.length !== 1 || this.isCollapsing(item.id)) return;
    const touch = e.touches[0];
    this.startSwipe(item.id, touch.clientX, touch.clientY);
  }

  onTouchMove(e: TouchEvent, item: Notification): void {
    const state = this.swipeMap.get(item.id);
    if (!state || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const shouldPrevent = this.moveSwipe(item.id, touch.clientX, touch.clientY);
    if (shouldPrevent && e.cancelable) {
      e.preventDefault();
    }
  }

  onTouchEnd(e: TouchEvent, item: Notification): void {
    this.endSwipe(item);
  }

  onTouchCancel(e: TouchEvent, item: Notification): void {
    this.cancelSwipe(item.id);
  }

  // ────────────── Pointer / Desktop Drag Handlers ──────────────
  onPointerDown(e: PointerEvent, item: Notification): void {
    if (e.button !== 0 || this.isCollapsing(item.id)) return;
    (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    this.startSwipe(item.id, e.clientX, e.clientY, e.pointerId);
  }

  onPointerMove(e: PointerEvent, item: Notification): void {
    const state = this.swipeMap.get(item.id);
    if (!state || (state.pointerId !== undefined && state.pointerId !== e.pointerId)) return;
    this.moveSwipe(item.id, e.clientX, e.clientY);
  }

  onPointerUp(e: PointerEvent, item: Notification): void {
    const state = this.swipeMap.get(item.id);
    if (!state || (state.pointerId !== undefined && state.pointerId !== e.pointerId)) return;
    (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    this.endSwipe(item);
  }

  onPointerCancel(e: PointerEvent, item: Notification): void {
    const state = this.swipeMap.get(item.id);
    if (state && state.pointerId === e.pointerId) {
      this.cancelSwipe(item.id);
    }
  }

  // ────────────── Core Gesture Lifecycle ──────────────
  private startSwipe(id: string | number, clientX: number, clientY: number, pointerId?: number): void {
    this.swipeMap.set(id, {
      startX: clientX,
      startY: clientY,
      currentX: 0,
      swiping: false,
      isScrolling: false,
      committed: false,
      collapsing: false,
      action: null,
      pointerId
    });
  }

  private moveSwipe(id: string | number, clientX: number, clientY: number): boolean {
    const state = this.swipeMap.get(id);
    if (!state || state.committed) return false;

    const deltaX = clientX - state.startX;
    const deltaY = clientY - state.startY;

    if (!state.swiping && !state.isScrolling) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
        state.isScrolling = true;
        return false;
      }
      if (Math.abs(deltaX) > 8) {
        state.swiping = true;
        this.activeSwipeId.set(id);
      }
    }

    if (state.swiping) {
      // Gentle resistance past 140px
      let offset = deltaX;
      const maxDrag = 150;
      if (offset > maxDrag) {
        offset = maxDrag + (offset - maxDrag) * 0.25;
      } else if (offset < -maxDrag) {
        offset = -maxDrag + (offset + maxDrag) * 0.25;
      }

      state.currentX = offset;
      state.action = offset > 0 ? 'read' : 'delete';

      this.activeSwipeOffset.set(offset);
      this.activeSwipeAction.set(state.action);
      return true;
    }

    return false;
  }

  private endSwipe(item: Notification): void {
    const state = this.swipeMap.get(item.id);
    if (!state) return;

    if (!state.swiping) {
      this.swipeMap.delete(item.id);
      return;
    }

    const offset = state.currentX;

    if (offset >= this.SWIPE_THRESHOLD) {
      // Swipe Right -> Mark Read committed
      // Snap card back smoothly to 0 (no hiding or deleting from list)
      this.cancelSwipe(item.id);
      this.executeAction(item, 'read');
    } else if (offset <= -this.SWIPE_THRESHOLD) {
      // Swipe Left -> Delete committed
      state.committed = true;
      this.activeSwipeCommitted.set(true);
      this.activeSwipeOffset.set(-window.innerWidth * 1.1); // Slide card off screen -110%
      this.executeAction(item, 'delete');
    } else {
      // Snap back if threshold not met
      this.cancelSwipe(item.id);
    }
  }

  private cancelSwipe(id: string | number): void {
    this.activeSwipeOffset.set(0);
    this.activeSwipeAction.set(null);
    this.activeSwipeCommitted.set(false);
    setTimeout(() => {
      if (this.activeSwipeId() === id) {
        this.activeSwipeId.set(null);
      }
      this.swipeMap.delete(id);
    }, 250);
  }

  private executeAction(item: Notification, action: 'read' | 'delete'): void {
    if (action === 'read') {
      // 1. Mark as read in memory immediately (card stays visible, updates read style & removes unread dot)
      this.items.update(list => list.map(n => n.id === item.id ? { ...n, isRead: true } : n));

      // 2. Mark as read API call
      this.api.post(`notifications/${item.id}/read`, {}).subscribe({
        next: () => {},
        error: () => {}
      });

      // 3. Small bottom snackbar: "Marked as read" (teal check icon)
      this.showSnackbar('Marked as read', 'fa-solid fa-circle-check', 'read');

      // Note: "Mark as read" does NOT hide or delete the notification; it remains in the list.
    } else {
      // Delete (make inactive) API call
      this.api.delete(`notifications/${item.id}`).subscribe({
        next: () => {},
        error: () => {}
      });

      // Small bottom snackbar: "Notification deleted" (red trash icon)
      this.showSnackbar('Notification deleted', 'fa-solid fa-trash-can', 'delete');

      // Row collapses with height:0 + opacity:0 animation (0.3s ease)
      setTimeout(() => {
        this.collapsingIds.update(set => {
          const next = new Set(set);
          next.add(item.id);
          return next;
        });

        setTimeout(() => {
          this.items.update(list => list.filter(n => n.id !== item.id));
          this.collapsingIds.update(set => {
            const next = new Set(set);
            next.delete(item.id);
            return next;
          });
          this.swipeMap.delete(item.id);
          if (this.activeSwipeId() === item.id) {
            this.activeSwipeId.set(null);
            this.activeSwipeOffset.set(0);
            this.activeSwipeCommitted.set(false);
            this.activeSwipeAction.set(null);
          }
        }, 300);
      }, 150);
    }
  }

  showSnackbar(message: string, icon: string, type: 'read' | 'delete'): void {
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
    }
    this.snackbar.set({ show: true, message, icon, type });
    this.snackbarTimeout = setTimeout(() => {
      this.snackbar.update(s => ({ ...s, show: false }));
    }, 2600);
  }

  // ────────────── Push & Status Helpers ──────────────
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
        this.showSnackbar('All notifications marked read', 'fa-solid fa-circle-check', 'read');
        this.items.update(list => list.map(n => ({ ...n, isRead: true })));
      },
      error: () => this.popup.error('Failed to mark notifications read')
    });
  }

  back(): void {
    history.back();
  }
}
