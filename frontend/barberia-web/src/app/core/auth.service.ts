import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthResponse, LoginRequest, RegisterRequest, User, UserRole } from './models';

const SESSION_KEY = 'barberia_session';

interface StoredSession {
  token: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly session = signal<StoredSession | null>(this.restoreSession());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isAuthenticated = computed(() => Boolean(this.token()));

  /**
   * Signs in with email and password.
   * @param payload Login credentials.
   */
  login(payload: LoginRequest) {
    return this.api.login(payload).pipe(map((response) => this.toSession(response)), tap((session) => this.storeSession(session)));
  }

  /**
   * Registers a customer and stores the resulting session.
   * @param payload Registration payload.
   */
  register(payload: RegisterRequest) {
    return this.api
      .register(payload)
      .pipe(map((response) => this.toSession(response)), tap((session) => this.storeSession(session)));
  }

  /**
   * Determines whether the signed-in user belongs to any of the supplied roles.
   * @param roles Allowed roles.
   */
  hasRole(roles: UserRole[]): boolean {
    const role = this.user()?.role;
    return Boolean(role && roles.includes(role));
  }

  /** Clears the local session and navigates home. */
  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    this.session.set(null);
    void this.router.navigate(['/']);
  }

  private toSession(response: AuthResponse): StoredSession {
    const role = this.mapRole(response.roles);
    return {
      token: response.accessToken,
      user: {
        id: response.userId,
        name: response.fullName,
        email: response.email,
        role,
      },
    };
  }

  private mapRole(roles: string[]): UserRole {
    if (roles.includes('Admin')) return 'Admin';
    if (roles.includes('Barber')) return 'Barber';
    return 'Customer';
  }

  private storeSession(session: StoredSession): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.session.set(session);
  }

  private restoreSession(): StoredSession | null {
    try {
      const value = localStorage.getItem(SESSION_KEY);
      if (!value) return null;
      const session = JSON.parse(value) as StoredSession;
      return session.token && session.user ? session : null;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}
