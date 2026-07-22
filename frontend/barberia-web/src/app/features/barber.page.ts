import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ApiError, Appointment, AppointmentStatus } from '../core/models';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="page-header compact"><span class="eyebrow">Espacio profesional</span><h1>Mi agenda</h1></section>
    <section class="section dashboard">
      <div class="panel-heading"><div><h2>Citas programadas</h2><p>Revisa tu jornada y actualiza cada atención.</p></div><div class="filters"><input type="date" [formControl]="dateControl"><button class="button ghost" (click)="load()">Consultar</button></div></div>
      @if (error()) { <div class="alert error">{{ error() }}</div> }
      @if (loading()) { <div class="state"><span class="spinner"></span><p>Cargando agenda…</p></div> }
      @else if (!appointments().length) { <div class="state"><h3>Agenda libre</h3><p>No tienes citas programadas para esta fecha.</p></div> }
      @else { <div class="timeline">
        @for (item of appointments(); track item.id) {
          <article class="timeline-item">
            <time>{{ formatTime(item.startUtc) }}</time>
            <div><span class="status" [attr.data-status]="item.status">{{ statusLabel(item.status) }}</span><h3>{{ item.customerName }}</h3><p>{{ item.serviceName }}</p>@if (item.notes) { <small>Nota: {{ item.notes }}</small> }</div>
            <div class="row-actions">
              @if (item.status === 'Pending') { <button (click)="changeStatus(item, 'Confirmed')">Confirmar</button> }
              @if (item.status === 'Confirmed') { <button (click)="changeStatus(item, 'Completed')">Completar</button> }
              @if (item.status === 'Pending' || item.status === 'Confirmed') { <button class="danger-action" (click)="changeStatus(item, 'Cancelled')">Cancelar</button> }
            </div>
          </article>
        }
      </div> }
    </section>
  `,
})
export class BarberPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  readonly dateControl = this.fb.nonNullable.control(new Date().toISOString().slice(0, 10));
  readonly appointments = signal<Appointment[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.load();
  }

  /** Loads the authenticated barber's appointments for the selected date. */
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getAppointments({ from: this.dateControl.value, to: this.dateControl.value, pageSize: 100 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => this.appointments.set(response.items),
        error: (error: ApiError) => this.error.set(error.message),
      });
  }

  /**
   * Updates appointment status.
   * @param item Appointment to update.
   * @param status Target status.
   */
  changeStatus(item: Appointment, status: AppointmentStatus): void {
    this.api.updateAppointmentStatus(item.id, status).subscribe({
      next: (updated) =>
        this.appointments.update((items) => items.map((value) => (value.id === updated.id ? updated : value))),
      error: (error: ApiError) => this.error.set(error.message),
    });
  }

  /**
   * Formats a UTC timestamp as local time.
   * @param value ISO UTC timestamp.
   */
  formatTime(value: string): string {
    return new Date(value).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
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
}
