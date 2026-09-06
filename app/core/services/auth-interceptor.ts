import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { environment } from '../../environment/environment';

let refreshing = false;
const refreshSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const http = inject(HttpClient);
  const token = localStorage.getItem('rl_access_token');
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || req.url.includes('/auth/')) return throwError(() => err);

      const refresh = localStorage.getItem('rl_refresh_token');
      if (!refresh) { localStorage.clear(); return throwError(() => err); }

      if (!refreshing) {
        refreshing = true;
        http.post<any>(`${environment.apiUrl}auth/refresh`, { refreshToken: refresh })
          .subscribe({
            next: res => {
              localStorage.setItem('rl_access_token', res.accessToken);
              localStorage.setItem('rl_refresh_token', res.refreshToken);
              refreshing = false;
              refreshSubject.next(res.accessToken);
            },
            error: () => {
              refreshing = false;
              localStorage.clear();
              refreshSubject.next(null);
            }
          });
      }

      return refreshSubject.pipe(
        filter(t => t !== null),
        take(1),
        switchMap(newToken => next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })))
      );
    })
  );
};
