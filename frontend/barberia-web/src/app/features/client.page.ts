import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ConfirmDialogService } from '../core/confirm-dialog.service';
import { ApiError, Appointment, AppointmentStatus } from '../core/models';

const LOOKUP_KEY = 'gemelli_booking_lookup';

@Component({
  standalone: true,
  imports: [DatePipe, RouterLink, ReactiveFormsModule],
  template: `
    <section class="booking-hero compact">
      <div class="booking-hero-inner">
        <span class="eyebrow">Tus reservas</span>
        <h1>Mis citas</h1>
        <p>Consulta con el mismo correo y cédula usados al reservar.</p>
      </div>
    </section>
    <section class="section dashboard booking-dashboard">
      <form class="lookup-panel" [formGroup]="lookupForm" (ngSubmit)="load()">
        <div class="lookup-intro">
          <h2>Buscar reservas</h2>
          <p>Introduce tus datos de identificación para ver próximas citas e historial.</p>
        </div>
        <div class="form-grid">
          <label>Correo<input type="email" formControlName="email" autocomplete="email"></label>
          <label>Cédula<input formControlName="documentNumber" inputmode="numeric"></label>
        </div>
        <div class="actions">
          <button class="button primary" [disabled]="loading()">{{ loading() ? 'Buscando…' : 'Consultar citas' }}</button>
          <a class="button ghost" routerLink="/reservar">Nueva reserva</a>
        </div>
      </form>

      @if (error()) { <div class="alert error">{{ error() }}</div> }
      @if (loaded() && !loading()) {
        <div class="dashboard-heading"><div><h2>Próximas reservas</h2><p>Citas activas asociadas a tu correo.</p></div></div>
        @if (!upcoming().length) {
          <div class="state soft empty-panel">
            <h3>No tienes próximas citas</h3>
            <p>Agenda una nueva visita cuando quieras.</p>
            <a class="button ghost" routerLink="/reservar">Reservar ahora</a>
          </div>
        } @else {
          <div class="appointment-list">
            @for (appointment of upcoming(); track appointment.id) {
              <article class="appointment-card">
                <div class="date-badge"><strong>{{ appointment.startUtc | date:'dd' }}</strong><span>{{ appointment.startUtc | date:'MMM' }}</span></div>
                <div>
                  <span class="status" [attr.data-status]="appointment.status">{{ statusLabel(appointment.status) }}</span>
                  <h3>{{ appointment.serviceName }}</h3>
                  <p>{{ appointment.startUtc | date:'shortTime' }} · {{ appointment.barberName }}</p>
                </div>
                @if (appointment.status === 'Pending' || appointment.status === 'Confirmed') {
                  <button class="danger-action" (click)="cancel(appointment)" [disabled]="cancelling() === appointment.id">Cancelar</button>
                }
              </article>
            }
          </div>
        }
        <div class="dashboard-heading secondary"><div><h2>Historial</h2><p>Visitas anteriores o canceladas.</p></div></div>
        @if (!history().length) { <p class="muted">Aún no hay historial para estos datos.</p> }
        <div class="appointment-list compact-list">
          @for (appointment of history(); track appointment.id) {
            <article class="appointment-card">
              <div>
                <span class="status" [attr.data-status]="appointment.status">{{ statusLabel(appointment.status) }}</span>
                <h3>{{ appointment.serviceName }}</h3>
                <p>{{ appointment.startUtc | date:'longDate' }} · {{ appointment.barberName }}</p>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class ClientPage {
  private readonly api = inject(ApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly appointments = signal<Appointment[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly cancelling = signal('');
  readonly upcoming = computed(() =>
    this.appointments().filter((item) => item.status === 'Pending' || item.status === 'Confirmed'),
  );
  readonly history = computed(() =>
    this.appointments().filter((item) => item.status === 'Completed' || item.status === 'Cancelled'),
  );
  readonly lookupForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    documentNumber: ['', [Validators.required, Validators.minLength(5)]],
  });

  constructor() {
    const saved = this.restoreLookup();
    const email = this.route.snapshot.queryParamMap.get('email') ?? saved?.email ?? '';
    const documentNumber =
      this.route.snapshot.queryParamMap.get('documentNumber') ?? saved?.documentNumber ?? '';
    if (email && documentNumber) {
      this.lookupForm.setValue({ email, documentNumber });
      this.load();
    }
  }

  /** Loads appointments for the supplied email and document. */
  load(): void {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }
    const { email, documentNumber } = this.lookupForm.getRawValue();
    this.storeLookup(email, documentNumber);
    this.loading.set(true);
    this.error.set('');
    this.api
      .getGuestAppointments(email.trim().toLowerCase(), documentNumber.trim())
      .pipe(finalize(() => {
        this.loading.set(false);
        this.loaded.set(true);
      }))
      .subscribe({
        next: (response) => this.appointments.set(response.items),
        error: (error: ApiError) => this.error.set(error.message),
      });
  }

  /**
   * Cancels an appointment after confirmation.
   * @param appointment Appointment to cancel.
   */
  async cancel(appointment: Appointment): Promise<void> {
    const confirmed = await this.confirmDialog.ask({
      title: 'Cancelar cita',
      message: `¿Seguro que deseas cancelar tu cita de ${appointment.serviceName}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Cancelar cita',
      danger: true,
    });
    if (!confirmed) return;
    const { email, documentNumber } = this.lookupForm.getRawValue();
    this.cancelling.set(appointment.id);
    this.api
      .cancelGuestAppointment(appointment.id, email.trim().toLowerCase(), documentNumber.trim())
      .pipe(finalize(() => this.cancelling.set('')))
      .subscribe({
        next: (updated) =>
          this.appointments.update((items) => items.map((item) => (item.id === updated.id ? updated : item))),
        error: (error: ApiError) => this.error.set(error.message),
      });
  }

  /**
   * Returns a Spanish label for an appointment status.
   * @param status Appointment status.
   */
  statusLabel(status: AppointmentStatus): string {
    return {
      Pending: 'Pendiente',
      Confirmed: 'Confirmada',
      Completed: 'Completada',
      Cancelled: 'Cancelada',
    }[status];
  }

  private storeLookup(email: string, documentNumber: string): void {
    localStorage.setItem(LOOKUP_KEY, JSON.stringify({ email, documentNumber }));
  }

  private restoreLookup(): { email: string; documentNumber: string } | null {
    try {
      const raw = localStorage.getItem(LOOKUP_KEY);
      return raw ? (JSON.parse(raw) as { email: string; documentNumber: string }) : null;
    } catch {
      return null;
    }
  }
}
