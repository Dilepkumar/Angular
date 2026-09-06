import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router'; 
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuthResult } from '../../shared/models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink], 
  templateUrl: './login.component.html'
})

export class LoginComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  email = ''; password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  submit() {
    this.loading.set(true); this.error.set(null);
    this.api.post<AuthResult>('auth/login', { email: this.email, password: this.password })
      .subscribe({
        next: res => { this.auth.saveSession(res); this.router.navigate(['/']); },
        error: e => { this.error.set(e.error?.message ?? 'Login failed'); this.loading.set(false); }
      });
  }
}
