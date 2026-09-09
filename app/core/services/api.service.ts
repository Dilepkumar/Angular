import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  // Helper method to safely join base URL and path without duplicate or missing slashes
  private getUrl(path: string): string {
    const cleanBase = this.base.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  }

  get<T>(path: string) {
    return this.http.get<T>(this.getUrl(path));
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(this.getUrl(path), body);
  }

  put<T>(path: string, body: unknown) {
    return this.http.put<T>(this.getUrl(path), body);
  }

  delete<T>(path: string, body?: unknown) {
    return this.http.delete<T>(this.getUrl(path), { body });
  }

  postForm<T>(path: string, formData: FormData) {
    return this.http.post<T>(this.getUrl(path), formData);
  }
}