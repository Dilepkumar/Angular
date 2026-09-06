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
  error = signal<string | null>(null);

  sendOtp() {
    this.api.post('auth/forgot-password', { email: this.email }).subscribe({
      next: () => this.step.set(2),
      error: e => this.error.set(e.error?.message)
    });
  }
  reset() {
    this.api.post('auth/reset-password',
      { email: this.email, code: this.code, newPassword: this.newPassword })
      .subscribe({
        next: () => alert('Password reset! Sign in with your new password.'),
        error: e => this.error.set(e.error?.message)
      });
  }
}
