import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiError } from './models';

/** Attaches the bearer token when a session is available. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const authorizedRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorizedRequest);
};

/** Normalizes API failures into a shared error shape. */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && auth.isAuthenticated()) {
        auth.logout();
        void router.navigate(['/login'], { queryParams: { expired: true } });
      }

      const problem = error.error as
        | { title?: string; detail?: string; message?: string; errors?: Record<string, string[]> }
        | undefined;

      const validationMessages = problem?.errors
        ? Object.values(problem.errors).flat().filter(Boolean)
        : [];

      const apiError: ApiError = {
        message:
          validationMessages[0] ??
          problem?.detail ??
          problem?.title ??
          problem?.message ??
          (error.status === 0
            ? 'No fue posible conectar con el servidor.'
            : 'Ocurrió un error inesperado. Inténtalo nuevamente.'),
        errors: problem?.errors,
      };
      return throwError(() => apiError);
    }),
  );
};
