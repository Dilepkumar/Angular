import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = '/api'; // proxied to your .NET backend

  get<T>(url: string, params?: HttpParams): Observable<T> {
    return this.http.get<T>(`this.baseUrl{this.baseUrl}this.baseUrl{url}`, { params });
  }

  post<T>(url: string, body: unknown): Observable<T> {
    return this.http.post<T>(`this.baseUrl{this.baseUrl}this.baseUrl{url}`, body);
  }

  put<T>(url: string, body: unknown): Observable<T> {
    return this.http.put<T>(`this.baseUrl{this.baseUrl}this.baseUrl{url}`, body);
  }

  delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(`this.baseUrl{this.baseUrl}this.baseUrl{url}`);
  }
}
