import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuthResult } from '../../shared/models';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './verify-otp.component.html'
})
export class VerifyOtpComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  email = this.route.snapshot.queryParamMap.get('email') ?? '';
  purpose = this.route.snapshot.queryParamMap.get('purpose') ?? 'Registration';
  code = '';
  loading = signal(false);
  error = signal<string | null>(null);

  submit() {
    this.loading.set(true); this.error.set(null);
    this.api.post<AuthResult>('auth/verify-otp', { email: this.email, code: this.code })
      .subscribe({
        next: res => { this.auth.saveSession(res); this.router.navigate(['/']); },
        error: e => { this.error.set(e.error?.message ?? 'Invalid or expired code'); this.loading.set(false); }
      });
  }

  resend() {
    this.api.post('auth/request-otp', { email: this.email, purpose: this.purpose })
      .subscribe(() => this.error.set('New code sent — check your email ✓'));
  }
}
