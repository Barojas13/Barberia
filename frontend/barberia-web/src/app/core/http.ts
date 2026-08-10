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

/** Normalizes API failures into a shared Spanish error shape. */
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
        ? Object.values(problem.errors).flat().filter(Boolean).map(toSpanishMessage)
        : [];

      const apiError: ApiError = {
        message:
          validationMessages[0] ??
          toSpanishMessage(problem?.detail) ??
          toSpanishMessage(problem?.title) ??
          toSpanishMessage(problem?.message) ??
          (error.status === 0
            ? 'No fue posible conectar con el servidor.'
            : 'Ocurrió un error inesperado. Inténtalo nuevamente.'),
        errors: problem?.errors,
      };
      return throwError(() => apiError);
    }),
  );
};

/**
 * Maps known English API/Identity messages into Spanish for Colombian users.
 * @param message Original API message.
 */
function toSpanishMessage(message: string | undefined | null): string | undefined {
  if (!message) return undefined;
  const normalized = message.trim();
  const catalog: Record<string, string> = {
    'One or more validation errors occurred.': 'Hay errores de validación.',
    'Passwords must have at least one non alphanumeric character.':
      'La contraseña debe incluir al menos un símbolo (por ejemplo ! @ # $).',
    'Passwords must have at least one digit (\'0\'-\'9\').':
      'La contraseña debe incluir al menos un número.',
    'Passwords must have at least one lowercase (\'a\'-\'z\').':
      'La contraseña debe incluir al menos una letra minúscula.',
    'Passwords must have at least one uppercase (\'A\'-\'Z\').':
      'La contraseña debe incluir al menos una letra mayúscula.',
    'Email already registered': 'Correo ya registrado',
    'Invalid credentials': 'Credenciales inválidas',
    'The supplied email or password is incorrect.': 'El correo o la contraseña no son correctos.',
    'An account with this email address already exists.':
      'Ya existe una cuenta con este correo electrónico.',
  };
  if (catalog[normalized]) return catalog[normalized];
  if (/passwords must be at least \d+ characters/i.test(normalized)) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  return normalized;
}
