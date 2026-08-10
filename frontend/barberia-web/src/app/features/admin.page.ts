import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiService } from '../core/api.service';
import {
  ApiError,
  Appointment,
  AppointmentStatus,
  Barber,
  BarberService,
  Customer,
  Page,
  Schedule,
} from '../core/models';

type AdminTab = 'appointments' | 'services' | 'barbers' | 'schedules' | 'clients';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe],
  template: `
    <section class="page-header compact admin-hero">
      <span class="eyebrow">Gestión</span>
      <h1>Panel administrativo</h1>
      <p>Controla citas, equipo, servicios y horarios del estudio.</p>
    </section>
    <section class="admin-shell">
      <nav class="tabs" aria-label="Secciones administrativas">
        @for (item of tabs; track item.id) {
          <button type="button" [class.active]="tab() === item.id" (click)="tab.set(item.id); loadTab()">{{ item.label }}</button>
        }
      </nav>
      @if (message()) { <div class="alert success">{{ message() }}</div> }
      @if (error()) { <div class="alert error">{{ error() }}</div> }
      @if (loading()) { <div class="state"><span class="spinner"></span><p>Cargando información…</p></div> }

      @if (!loading() && tab() === 'appointments') {
        <div class="admin-panel">
          <div class="panel-heading">
            <div><h2>Citas</h2><p>Consulta y actualiza las reservas.</p></div>
            <div class="filters">
              <input type="date" [formControl]="filters.controls.from">
              <select [formControl]="filters.controls.status">
                <option value="">Todos los estados</option>
                <option value="Pending">Pendientes</option>
                <option value="Confirmed">Confirmadas</option>
                <option value="Completed">Completadas</option>
                <option value="Cancelled">Canceladas</option>
              </select>
              <button class="button ghost" (click)="loadAppointments()">Filtrar</button>
            </div>
          </div>
          <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Servicio</th><th>Barbero</th><th>Estado</th></tr></thead><tbody>
            @for (item of appointments(); track item.id) {
              <tr>
                <td>{{ item.startUtc | date:'dd/MM/yyyy HH:mm' }}</td>
                <td>{{ item.customerName }}</td>
                <td>{{ item.serviceName }}</td>
                <td>{{ item.barberName }}</td>
                <td>
                  <select [value]="item.status" (change)="updateStatus(item, $any($event.target).value)">
                    <option value="Pending">Pendiente</option>
                    <option value="Confirmed">Confirmada</option>
                    <option value="Completed">Completada</option>
                    <option value="Cancelled">Cancelada</option>
                  </select>
                </td>
              </tr>
            }
          </tbody></table></div>
          <div class="pagination">
            <button [disabled]="page() <= 1" (click)="changePage(page() - 1)">Anterior</button>
            <span>Página {{ page() }} de {{ totalPages() }}</span>
            <button [disabled]="page() >= totalPages()" (click)="changePage(page() + 1)">Siguiente</button>
          </div>
        </div>
      }

      @if (!loading() && tab() === 'services') {
        <div class="admin-panel">
          <div class="panel-heading">
            <div><h2>Servicios</h2><p>Administra el catálogo y sus precios.</p></div>
            <button class="button primary" type="button" (click)="editService()">Nuevo servicio</button>
          </div>
          @if (showServiceForm()) {
            <form class="inline-form" [formGroup]="serviceForm" (ngSubmit)="saveService()">
              <h3>{{ editingServiceId() ? 'Editar' : 'Nuevo' }} servicio</h3>
              <div class="form-grid">
                <label>Nombre<input formControlName="name"></label>
                <label>Precio<input type="number" min="0" formControlName="price"></label>
                <label>Duración (min)<input type="number" min="5" step="5" formControlName="durationMinutes"></label>
                <label class="wide">Descripción<textarea formControlName="description"></textarea></label>
              </div>
              <div class="actions">
                <button class="button primary" type="submit" [disabled]="saving()">Guardar</button>
                <button type="button" class="button ghost" (click)="showServiceForm.set(false)">Cancelar</button>
              </div>
            </form>
          }
          <div class="card-grid admin-grid">
            @for (item of services(); track item.id) {
              <article class="management-card">
                <div>
                  <span class="card-kicker">Servicio</span>
                  <h3>{{ item.name }}</h3>
                  <p>{{ item.description || 'Sin descripción.' }}</p>
                  <strong>{{ item.price | currency:'COP':'symbol-narrow':'1.0-0' }} · {{ item.durationMinutes }} min</strong>
                </div>
                <div class="row-actions">
                  <button type="button" (click)="editService(item)">Editar</button>
                  <button type="button" class="danger-action" (click)="deleteService(item)">Eliminar</button>
                </div>
              </article>
            } @empty { <div class="state soft">No hay servicios.</div> }
          </div>
        </div>
      }

      @if (!loading() && tab() === 'barbers') {
        <div class="admin-panel">
          <div class="panel-heading">
            <div><h2>Barberos</h2><p>Crea cuentas profesionales para el equipo.</p></div>
            @if (!showBarberForm()) {
              <button class="button primary" type="button" (click)="showBarberForm.set(true)">Nuevo barbero</button>
            }
          </div>
          @if (showBarberForm()) {
            <form class="inline-form barber-form" [formGroup]="barberForm" (ngSubmit)="saveBarber()">
              <div class="form-header">
                <div>
                  <span class="eyebrow">Equipo</span>
                  <h3>Nuevo barbero</h3>
                </div>
              </div>
              <div class="form-grid form-grid-3">
                <label>Nombre
                  <input formControlName="displayName" autocomplete="name" placeholder="Ej. Julián Vargas">
                  <small>{{ fieldError(barberForm, 'displayName') }}</small>
                </label>
                <label>Correo
                  <input type="email" formControlName="email" autocomplete="email" placeholder="correo@ejemplo.com">
                  <small>{{ fieldError(barberForm, 'email') }}</small>
                </label>
                <label>Contraseña
                  <input type="password" formControlName="password" autocomplete="new-password" placeholder="Barber123!">
                  @if (fieldError(barberForm, 'password'); as passwordError) {
                    <small>{{ passwordError }}</small>
                  } @else {
                    <small class="field-hint">Mín. 8 caracteres, con mayúscula, minúscula, número y símbolo.</small>
                  }
                </label>
                <label class="wide">Biografía
                  <textarea formControlName="bio" rows="3" placeholder="Breve descripción profesional (opcional)"></textarea>
                </label>
              </div>
              <div class="actions">
                <button class="button primary" type="submit" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Guardar' }}</button>
                <button type="button" class="button ghost" (click)="showBarberForm.set(false)">Cancelar</button>
              </div>
            </form>
          }
          <div class="card-grid admin-grid">
            @for (item of barbers(); track item.id) {
              <article class="management-card barber-card">
                <div class="barber-card-top">
                  <span class="choice-avatar" aria-hidden="true">{{ initials(item.displayName) }}</span>
                  <div>
                    <span class="card-kicker">{{ item.isActive ? 'Activo' : 'Inactivo' }}</span>
                    <h3>{{ item.displayName }}</h3>
                  </div>
                </div>
                <p>{{ item.bio || 'Barbero profesional' }}</p>
              </article>
            } @empty { <div class="state soft">Aún no hay barberos registrados.</div> }
          </div>
        </div>
      }

      @if (!loading() && tab() === 'schedules') {
        <div class="admin-panel">
          <div class="panel-heading"><div><h2>Horarios</h2><p>Configura la jornada de cada profesional.</p></div></div>
          <form class="inline-form" [formGroup]="scheduleForm" (ngSubmit)="saveSchedule()">
            <div class="form-grid">
              <label>Barbero
                <select formControlName="barberId">
                  <option value="">Selecciona</option>
                  @for (barber of barbers(); track barber.id) { <option [value]="barber.id">{{ barber.displayName }}</option> }
                </select>
              </label>
              <label>Día
                <select formControlName="dayOfWeek">
                  @for (day of days; track $index) { <option [value]="$index">{{ day }}</option> }
                </select>
              </label>
              <label>Inicio<input type="time" formControlName="startTime"></label>
              <label>Fin<input type="time" formControlName="endTime"></label>
            </div>
            <div class="actions">
              <button class="button primary" type="submit">Guardar horario</button>
              <button class="button ghost" type="button" (click)="loadSchedules()">Consultar</button>
            </div>
          </form>
          <div class="table-wrap"><table><thead><tr><th>Barbero</th><th>Día</th><th>Jornada</th><th></th></tr></thead><tbody>
            @for (item of schedules(); track item.id) {
              <tr>
                <td>{{ barberName(item.barberId) }}</td>
                <td>{{ days[item.dayOfWeek] }}</td>
                <td>{{ item.startTime }} – {{ item.endTime }}</td>
                <td><button type="button" class="danger-action" (click)="deleteSchedule(item.id)">Eliminar</button></td>
              </tr>
            }
          </tbody></table></div>
        </div>
      }

      @if (!loading() && tab() === 'clients') {
        <div class="admin-panel">
          <div class="panel-heading">
            <div><h2>Clientes</h2><p>Directorio de clientes registrados.</p></div>
            <div class="filters">
              <input placeholder="Buscar por nombre o teléfono" [formControl]="filters.controls.search">
              <button class="button ghost" (click)="loadClients()">Buscar</button>
            </div>
          </div>
          <div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Cédula</th><th>Teléfono</th></tr></thead><tbody>
            @for (item of clients(); track item.id) {
              <tr>
                <td>{{ item.fullName }}</td>
                <td>{{ item.email }}</td>
                <td>{{ item.documentNumber }}</td>
                <td>{{ item.phone || '—' }}</td>
              </tr>
            }
          </tbody></table></div>
          <div class="pagination">
            <button [disabled]="page() <= 1" (click)="changePage(page() - 1)">Anterior</button>
            <span>Página {{ page() }} de {{ totalPages() }}</span>
            <button [disabled]="page() >= totalPages()" (click)="changePage(page() + 1)">Siguiente</button>
          </div>
        </div>
      }
    </section>
  `,
})
export class AdminPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  readonly tabs: { id: AdminTab; label: string }[] = [
    { id: 'appointments', label: 'Citas' },
    { id: 'services', label: 'Servicios' },
    { id: 'barbers', label: 'Barberos' },
    { id: 'schedules', label: 'Horarios' },
    { id: 'clients', label: 'Clientes' },
  ];
  readonly days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  readonly tab = signal<AdminTab>('appointments');
  readonly services = signal<BarberService[]>([]);
  readonly barbers = signal<Barber[]>([]);
  readonly appointments = signal<Appointment[]>([]);
  readonly schedules = signal<Schedule[]>([]);
  readonly clients = signal<Customer[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly showServiceForm = signal(false);
  readonly showBarberForm = signal(false);
  readonly editingServiceId = signal<string | null>(null);
  readonly filters = this.fb.nonNullable.group({ from: [''], status: [''], search: [''] });
  readonly serviceForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    price: [0, [Validators.required, Validators.min(0.01)]],
    durationMinutes: [30, [Validators.required, Validators.min(5)]],
    isActive: [true],
  });
  readonly barberForm = this.fb.nonNullable.group({
    displayName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    bio: [''],
  });
  readonly scheduleForm = this.fb.nonNullable.group({
    barberId: ['', Validators.required],
    dayOfWeek: [1, Validators.required],
    startTime: ['09:00', Validators.required],
    endTime: ['18:00', Validators.required],
    isActive: [true],
  });

  constructor() {
    this.loadAppointments();
  }

  /** Reloads the currently selected admin tab. */
  loadTab(): void {
    this.page.set(1);
    this.error.set('');
    ({
      appointments: () => this.loadAppointments(),
      services: () => this.loadServices(),
      barbers: () => this.loadBarbers(),
      schedules: () => this.loadSchedules(),
      clients: () => this.loadClients(),
    })[this.tab()]();
  }

  private begin(): void {
    this.loading.set(true);
    this.error.set('');
    this.message.set('');
  }

  private setPaged<T>(response: Page<T>, target: { set(value: T[]): void }): void {
    target.set(response.items);
    this.totalPages.set(Math.max(1, Math.ceil(response.totalCount / response.pageSize)));
  }

  /** Loads appointments with optional filters. */
  loadAppointments(): void {
    this.begin();
    const { from, status } = this.filters.getRawValue();
    this.api
      .getAppointments({
        page: this.page(),
        pageSize: 10,
        ...(from && { from, to: from }),
        ...(status && { status }),
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => this.setPaged(response, this.appointments),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  /** Loads the service catalog. */
  loadServices(): void {
    this.begin();
    this.api
      .getServices()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (items) => this.services.set(items),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  /** Loads active barbers. */
  loadBarbers(): void {
    this.begin();
    this.api
      .getBarbers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (items) => this.barbers.set(items),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  /** Loads schedules for the selected barber or the first available one. */
  loadSchedules(): void {
    this.begin();
    this.api.getBarbers().subscribe({
      next: (barbers) => {
        this.barbers.set(barbers);
        const barberId = this.scheduleForm.controls.barberId.value || barbers[0]?.id;
        if (!barberId) {
          this.schedules.set([]);
          this.loading.set(false);
          return;
        }
        this.scheduleForm.controls.barberId.setValue(barberId);
        this.api
          .getSchedules(barberId)
          .pipe(finalize(() => this.loading.set(false)))
          .subscribe({
            next: (items) => this.schedules.set(items),
            error: (e: ApiError) => this.error.set(e.message),
          });
      },
      error: (e: ApiError) => {
        this.loading.set(false);
        this.error.set(e.message);
      },
    });
  }

  /** Loads registered customers. */
  loadClients(): void {
    this.begin();
    this.api
      .getClients({ page: this.page(), pageSize: 10, search: this.filters.controls.search.value })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => this.setPaged(response, this.clients),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  /**
   * Changes the current page for paginated tabs.
   * @param page Target page number.
   */
  changePage(page: number): void {
    this.page.set(page);
    this.tab() === 'clients' ? this.loadClients() : this.loadAppointments();
  }

  /**
   * Opens the service form for create or edit.
   * @param item Optional existing service.
   */
  editService(item?: BarberService): void {
    this.editingServiceId.set(item?.id ?? null);
    this.serviceForm.reset({
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: item?.price ?? 0,
      durationMinutes: item?.durationMinutes ?? 30,
      isActive: item?.isActive ?? true,
    });
    this.showServiceForm.set(true);
  }

  /** Saves the current service form. */
  saveService(): void {
    if (this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api
      .saveService(this.editingServiceId(), this.serviceForm.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.showServiceForm.set(false);
          this.message.set('Servicio guardado.');
          this.loadServices();
        },
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  /**
   * Soft-deletes a service.
   * @param item Service to delete.
   */
  deleteService(item: BarberService): void {
    if (confirm(`¿Eliminar "${item.name}"?`)) {
      this.api.deleteService(item.id).subscribe({
        next: () => this.loadServices(),
        error: (e: ApiError) => this.error.set(e.message),
      });
    }
  }

  /** Creates a barber account. */
  saveBarber(): void {
    this.error.set('');
    this.message.set('');
    if (this.barberForm.invalid) {
      this.barberForm.markAllAsTouched();
      this.error.set('Revisa nombre, correo y contraseña antes de guardar.');
      return;
    }
    this.saving.set(true);
    const value = this.barberForm.getRawValue();
    this.api
      .createBarber({
        displayName: value.displayName.trim(),
        email: value.email.replace(/\s+/g, '').toLowerCase(),
        password: value.password,
        bio: value.bio.trim() || undefined,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.showBarberForm.set(false);
          this.barberForm.reset({ displayName: '', email: '', password: '', bio: '' });
          this.message.set('Barbero creado.');
          this.loadBarbers();
        },
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  /**
   * Returns a validation message for an admin form control.
   * @param form Form group.
   * @param name Control name.
   */
  fieldError(form: FormGroup, name: string): string {
    const field = form.get(name);
    if (!field?.touched || !field.errors) return '';
    if (field.hasError('required')) return 'Este campo es obligatorio.';
    if (field.hasError('email')) return 'Ingresa un correo válido, sin espacios.';
    if (field.hasError('minlength')) return 'Usa al menos 8 caracteres.';
    return 'Revisa este dato.';
  }

  /** Creates a weekly schedule entry. */
  saveSchedule(): void {
    if (this.scheduleForm.invalid) {
      this.scheduleForm.markAllAsTouched();
      return;
    }
    const value = this.scheduleForm.getRawValue();
    this.api
      .saveSchedule(value.barberId, {
        dayOfWeek: Number(value.dayOfWeek),
        startTime: value.startTime,
        endTime: value.endTime,
        isActive: value.isActive,
      })
      .subscribe({
        next: () => {
          this.message.set('Horario guardado.');
          this.loadSchedules();
        },
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  /**
   * Deletes a schedule entry.
   * @param id Schedule identifier.
   */
  deleteSchedule(id: string): void {
    this.api.deleteSchedule(id).subscribe({
      next: () => this.loadSchedules(),
      error: (e: ApiError) => this.error.set(e.message),
    });
  }

  /**
   * Updates appointment status from the admin table.
   * @param item Appointment to update.
   * @param status Target status.
   */
  updateStatus(item: Appointment, status: AppointmentStatus): void {
    this.api.updateAppointmentStatus(item.id, status).subscribe({
      next: (updated) =>
        this.appointments.update((all) => all.map((value) => (value.id === updated.id ? updated : value))),
      error: (e: ApiError) => this.error.set(e.message),
    });
  }

  /**
   * Resolves a barber display name by identifier.
   * @param id Barber identifier.
   */
  barberName(id: string): string {
    return this.barbers().find((item) => item.id === id)?.displayName ?? 'Barbero';
  }

  /**
   * Builds short initials for admin barber cards.
   * @param name Display name.
   */
  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
