import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  private api = inject(ApiService);
  step = signal<1 | 2>(1);
  email = ''; code = ''; newPassword = '';
  loading = signal(false);
  error = signal<string | null>(null);
  devOtp = signal<string | null>(null);

  private emailValid(): boolean {
    return /^[\w.+-]+@[\w-]+\.[\w.-]{2,}$/.test(this.email.trim());
  }

  sendOtp() {
    if (!this.emailValid()) { this.error.set('Enter a valid email'); return; }
    this.loading.set(true); this.error.set(null);
    this.api.post<{ message: string; devOtp?: string }>('auth/forgot-password', { email: this.email.trim().toLowerCase() })
      .subscribe({
        next: r => {
          this.loading.set(false);
          this.devOtp.set(r.devOtp ?? null);   // dev only — shows OTP banner
          this.step.set(2);
        },
        error: e => { this.loading.set(false); this.error.set(e.error?.message ?? 'Something went wrong'); }
      });
  }

  reset() {
    if (this.code.trim().length !== 6) { this.error.set('Enter the 6-digit code'); return; }
    if (this.newPassword.length < 8) { this.error.set('New password must be at least 8 characters'); return; }
    this.loading.set(true); this.error.set(null);
    this.api.post<{ message: string }>('auth/reset-password',
      { email: this.email.trim().toLowerCase(), code: this.code.trim(), newPassword: this.newPassword })
      .subscribe({
        next: () => this.step.set(2), // keep step, show success banner below
        complete: () => this.loading.set(false),
        error: e => { this.loading.set(false); this.error.set(e.error?.message ?? 'Invalid or expired code'); }
      });
  }

  goLogin() {
    window.location.href = '/auth/login';
  }
  success = signal(false);
}
