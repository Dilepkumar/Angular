import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { PopupService } from '../../../core/services/popup.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  private popup = inject(PopupService);

  step = signal<1 | 2>(1);
  email = '';
  code = '';
  newPassword = '';
  showPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  private emailValid(): boolean {
    return /^[\w.+-]+@[\w-]+\.[\w.-]{2,}$/.test(this.email.trim());
  }

  sendOtp() {
    const trimmed = this.email.trim();
    if (!trimmed) {
      const msg = 'Please enter your registered email address';
      this.error.set(msg);
      this.popup.warning(msg);
      return;
    }
    if (!this.emailValid()) {
      const msg = 'Please enter a valid email format (e.g. name@domain.com)';
      this.error.set(msg);
      this.popup.warning(msg);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api.post<{ message: string; devOtp?: string }>('auth/forgot-password', { email: trimmed.toLowerCase() })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.step.set(2);
          if (res?.devOtp) {
            this.code = res.devOtp;
            this.popup.success(`Password reset code sent! (Dev Auto-filled: ${res.devOtp})`);
          } else {
            this.code = '';
            this.popup.success(res?.message || 'Password reset code sent to your email. Please check your inbox.');
          }
        },
        error: (e) => {
          this.loading.set(false);
          const msg = e.error?.message || 'This email is not registered in RoomLedger. Please check the email or sign up.';
          this.error.set(msg);
          this.popup.error(msg);
        }
      });
  }

  reset() {
    if (this.code.trim().length !== 6) {
      const msg = 'Please enter the 6-digit code sent to your email';
      this.error.set(msg);
      this.popup.warning(msg);
      return;
    }
    if (this.newPassword.length < 8) {
      const msg = 'New password must be at least 8 characters';
      this.error.set(msg);
      this.popup.warning(msg);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api.post<{ message: string }>('auth/reset-password', {
      email: this.email.trim().toLowerCase(),
      code: this.code.trim(),
      newPassword: this.newPassword
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.success.set(true);
        this.popup.success(res.message || 'Password updated successfully! Redirecting to login...');
        setTimeout(() => this.goLogin(), 1500);
      },
      error: (e) => {
        this.loading.set(false);
        const msg = e.error?.message || 'Invalid or expired code. Please request a new code.';
        this.error.set(msg);
        this.popup.error(msg);
      }
    });
  }

  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  goLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
