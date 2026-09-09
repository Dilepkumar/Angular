import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, LoginResponse } from '../../../core/services/auth.service';

const EMAIL_RE = /^[\w.+-]+@[\w-]+\.[\w.-]{2,}$/;
const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  identifier = '';      // ← email OR phone, single field
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);
  touched = signal(false);

  get isPhone(): boolean {
    const v = this.identifier.replace(/[\s-]/g, '');
    return /^(\+91)?[6-9]\d{9}$/.test(v);
  }

  get identifierError(): string | null {
    const v = this.identifier.trim();
    if (!v) return 'Email or mobile number is required';
    if (!EMAIL_RE.test(v) && !PHONE_RE.test(v)) return 'Enter a valid email or 10-digit mobile (starts 6-9)';
    return null;
  }

  get passwordError(): string | null {
    if (!this.password) return 'Password is required';
    return null;
  }

  submit() {
    console.log('[Login] submit called with identifier:', this.identifier);
    this.touched.set(true);

    if (this.identifierError || this.passwordError || this.loading()) {
      console.warn('[Login] validation blocked submit:', {
        identifierError: this.identifierError,
        passwordError: this.passwordError,
        loading: this.loading()
      });
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    console.log('[Login] sending request to API...');
    this.auth.login(this.identifier.trim(), this.password)
      .subscribe({
        next: (res: LoginResponse) => {
          console.log('[Login] success response:', res);
          this.auth.saveSession(res);
          this.router.navigate(['/']);
        },
        error: e => {
          console.error('[Login] API error occurred:', e);
          this.error.set(e.error?.message ?? 'Invalid email/phone or password');
          this.loading.set(false);
        }
      });
  }
}
