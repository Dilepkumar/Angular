import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  private api = inject(ApiService);
  private router = inject(Router);

  fullName = ''; email = ''; phone = ''; password = ''; confirmPassword = '';
  loading = signal(false);
  error = signal<string | null>(null);
  touched = signal(false);
  showPw = false;
  showCpw = false;

  // ── per-field validators ──
  nameError(): string | null {
    const v = this.fullName.trim();
    if (!v) return 'Full name is required';
    if (v.length < 2) return 'Name is too short';
    if (!/^[a-zA-Z][a-zA-Z\s]*$/.test(v)) return 'Name can only contain letters and spaces';
    return null;
  }

  emailError(): string | null {
    const v = this.email.trim();
    if (!v) return 'Email is required';
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]{2,}$/.test(v)) return 'Enter a valid email (e.g. name@mail.com)';
    return null;
  }

  phoneError(): string | null {
    const v = this.phone.replace(/[\s-]/g, '');
    if (!v) return 'Mobile number is required';
    if (!PHONE_RE.test(this.phone)) return 'Enter a valid 10-digit Indian mobile (starts 6-9)';
    return null;
  }

  passwordError(): string | null {
    const v = this.password;
    if (!v) return 'Password is required';
    if (v.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(v)) return 'Add at least one UPPERCASE letter';
    if (!/[a-z]/.test(v)) return 'Add at least one lowercase letter';
    if (!/\d/.test(v)) return 'Add at least one number';
    if (!/[^A-Za-z0-9]/.test(v)) return 'Add at least one special character (!@#…)';
    return null;
  }

  confirmPasswordError(): string | null {
    if (!this.confirmPassword) return 'Please confirm your password';
    if (this.confirmPassword !== this.password) return 'Passwords do not match';
    return null;
  }

  // ── password strength meter ──
  get score(): number {
    const v = this.password; let s = 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
    if (/\d/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    return s;
  }
  get scoreLabel() { return ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'][this.score]; }
  get scoreColor() { return ['bg-red-500', 'bg-red-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500'][this.score]; }

  get formValid(): boolean {
    return !this.nameError() && !this.emailError() && !this.phoneError()
        && !this.passwordError() && !this.confirmPasswordError();
  }

  submit() {
    this.touched.set(true);
    this.error.set(null);
    if (!this.formValid || this.loading()) return;

    this.loading.set(true);
    this.api.post<{ message: string }>('auth/register', {
      fullName: this.fullName.trim(),
      email: this.email.trim().toLowerCase(),
      phone: this.phone.replace(/[\s-]/g, ''),
      password: this.password
    }).subscribe({
      next: () => this.router.navigate(['/auth/verify-otp'],
        { queryParams: { email: this.email.trim().toLowerCase(), purpose: 'Registration' } }),
      error: e => {
        this.error.set(e.error?.message ?? 'Registration failed');
        this.loading.set(false);
      }
    });
  }
}
