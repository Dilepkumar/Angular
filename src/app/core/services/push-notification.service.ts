import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private http = inject(HttpClient);

  isSupported = signal<boolean>(false);
  isSubscribed = signal<boolean>(false);
  permission = signal<NotificationPermission>('default');
  loading = signal<boolean>(false);

  constructor() {
    this.checkSupportAndStatus();
  }

  async checkSupportAndStatus(): Promise<void> {
    const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
    this.isSupported.set(supported);

    if (typeof Notification !== 'undefined') {
      this.permission.set(Notification.permission);
    }

    if (supported && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const sub = await registration.pushManager.getSubscription();
          this.isSubscribed.set(!!sub);
        }
      } catch {
        this.isSubscribed.set(false);
      }
    }
  }

  private async getRegistration(): Promise<ServiceWorkerRegistration> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      throw new Error('Service workers are not supported on this browser.');
    }

    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    return reg;
  }

  async subscribe(): Promise<{ success: boolean; message: string }> {
    if (!this.isSupported()) {
      return { success: false, message: 'Web Push is not supported on this browser or platform.' };
    }

    this.loading.set(true);
    try {
      const perm = await Notification.requestPermission();
      this.permission.set(perm);

      if (perm !== 'granted') {
        this.loading.set(false);
        return { success: false, message: 'Notification permission was denied.' };
      }

      const registration = await this.getRegistration();
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapidKey = environment.vapidPublicKey;
        if (!vapidKey) {
          this.loading.set(false);
          return { success: false, message: 'VAPID public key is missing in environment.' };
        }

        const applicationServerKey = this.urlBase64ToUint8Array(vapidKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any
        });
      }

      const subJson = subscription.toJSON();
      await this.http.post(`${environment.apiUrl}notifications/push/subscribe`, {
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys?.['p256dh'],
          auth: subJson.keys?.['auth']
        }
      }).toPromise();

      this.isSubscribed.set(true);
      this.loading.set(false);
      return { success: true, message: 'Device subscribed to RoomLedger push notifications!' };
    } catch (err: any) {
      this.loading.set(false);
      return { success: false, message: err?.message || 'Failed to subscribe to push notifications.' };
    }
  }

  async unsubscribe(): Promise<{ success: boolean; message: string }> {
    this.loading.set(true);
    try {
      const registration = await this.getRegistration();
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const subJson = subscription.toJSON();
        await this.http.post(`${environment.apiUrl}notifications/push/unsubscribe`, {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys?.['p256dh'],
            auth: subJson.keys?.['auth']
          }
        }).toPromise();

        await subscription.unsubscribe();
      }

      this.isSubscribed.set(false);
      this.loading.set(false);
      return { success: true, message: 'Device unsubscribed from push notifications.' };
    } catch (err: any) {
      this.loading.set(false);
      return { success: false, message: err?.message || 'Failed to unsubscribe.' };
    }
  }

  sendTestPush(): Promise<{ success: boolean; message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}notifications/push/test`, {})
      .toPromise()
      .then(res => ({ success: true, message: res?.message || 'Test push notification sent!' }))
      .catch(err => ({ success: false, message: err?.error?.message || 'Failed to send test push' }));
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
