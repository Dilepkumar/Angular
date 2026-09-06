import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  private api = inject(ApiService);
  private router = inject(Router);

  fullName = ''; email = ''; phone = ''; password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  submit() {
    if (this.password.length < 8) { this.error.set('Password must be at least 8 characters'); return; }
    this.loading.set(true); this.error.set(null);
    this.api.post<{ email: string }>('auth/register',
      { fullName: this.fullName, email: this.email, phone: this.phone, password: this.password })
      .subscribe({
        next: () => this.router.navigate(['/auth/verify-otp'],
          { queryParams: { email: this.email, purpose: 'Registration' } }),
        error: e => { this.error.set(e.error?.message ?? 'Registration failed'); this.loading.set(false); }
      });
  }
}
