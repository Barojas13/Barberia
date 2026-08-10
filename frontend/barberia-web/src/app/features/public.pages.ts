import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ApiError, Appointment, Barber, BarberService, TimeSlot } from '../core/models';

interface ServiceGroup {
  name: string;
  items: BarberService[];
}

interface SlotGroup {
  label: string;
  items: TimeSlot[];
}

interface DayOption {
  value: string;
  weekday: string;
  day: string;
  month: string;
}

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero">
      <div class="hero-content">
        <img class="hero-logo" src="/brand/gemelli-logo.png" width="220" height="220" alt="Logo Gemelli Studio" />
        <p class="brand-title">Gemelli Studio</p>
        <h1>Estilo definido. <em>Asesoría real.</em></h1>
        <p>Barbería premium con asesoría de imagen incluida. Reserva tu cita y sal con un look pensado para ti.</p>
        <div class="actions">
          <a class="button primary" routerLink="/reservar">Reservar cita</a>
          <a class="button ghost" routerLink="/servicios">Ver servicios</a>
        </div>
      </div>
    </section>
    <section class="section benefits">
      <article><b>01</b><h3>Asesoría gratis</h3><p>Te guiamos en el estilo ideal según tu rostro, cabello y estilo de vida.</p></article>
      <article><b>02</b><h3>Técnica precisa</h3><p>Cortes limpios, fades y barba con detalle de estudio profesional.</p></article>
      <article><b>03</b><h3>Reserva fácil</h3><p>Elige servicio, barbero y horario en minutos desde la web.</p></article>
    </section>
    <section class="section centered">
      <span class="eyebrow">La experiencia</span>
      <h2>Más que un corte</h2>
      <p class="lead">Un espacio negro y plata, sobrio y moderno, para renovar tu imagen con intención.</p>
      <a class="button primary" routerLink="/reservar">Agenda tu visita</a>
    </section>
  `,
})
export class HomePage {}

@Component({
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  template: `
    <section class="page-header"><span class="eyebrow">Nuestro oficio</span><h1>Servicios</h1><p>Selecciona la experiencia que mejor encaja contigo.</p></section>
    <section class="section">
      @if (loading()) { <div class="state"><span class="spinner"></span><p>Cargando servicios…</p></div> }
      @else if (error()) { <div class="state error"><p>{{ error() }}</p><button class="button ghost" (click)="load()">Reintentar</button></div> }
      @else if (!services().length) { <div class="state"><p>No hay servicios disponibles por el momento.</p></div> }
      @else {
        <div class="card-grid">
          @for (service of services(); track service.id) {
            <article class="service-card">
              <span class="service-icon" aria-hidden="true">✂</span>
              <h2>{{ service.name }}</h2><p>{{ service.description }}</p>
              <div class="service-meta"><strong>{{ service.price | currency:'COP':'symbol-narrow':'1.0-0' }}</strong><span>{{ service.durationMinutes }} min</span></div>
              <a class="button ghost full" [routerLink]="['/reservar']" [queryParams]="{ serviceId: service.id }">Elegir servicio</a>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class ServicesPage {
  private readonly api = inject(ApiService);
  readonly services = signal<BarberService[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.load();
  }

  /** Loads the public service catalog. */
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getServices()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (items) => this.services.set(items.filter((item) => item.isActive)),
        error: (error: ApiError) => this.error.set(error.message),
      });
  }
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="auth-page">
      <div class="form-card">
        <span class="eyebrow">{{ registerMode() ? 'Únete a nosotros' : 'Bienvenido' }}</span>
        <h1>{{ registerMode() ? 'Crear cuenta' : 'Iniciar sesión' }}</h1>
        <p>{{ registerMode() ? 'Regístrate para reservar y gestionar tus citas.' : 'Accede para gestionar tus reservas.' }}</p>
        @if (route.snapshot.queryParamMap.has('expired')) { <div class="alert">Tu sesión expiró. Ingresa nuevamente.</div> }
        @if (error()) { <div class="alert error">{{ error() }}</div> }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (registerMode()) {
            <label>Nombre completo<input formControlName="fullName" autocomplete="name"><small>{{ fieldError('fullName') }}</small></label>
            <label>Teléfono<input formControlName="phone" autocomplete="tel" inputmode="tel"><small>{{ fieldError('phone') }}</small></label>
          }
          <label>Correo electrónico<input type="email" formControlName="email" autocomplete="email"><small>{{ fieldError('email') }}</small></label>
          <label>Contraseña<input type="password" formControlName="password" [autocomplete]="registerMode() ? 'new-password' : 'current-password'"><small>{{ fieldError('password') }}</small></label>
          <button class="button primary full" [disabled]="loading()">{{ loading() ? 'Procesando…' : (registerMode() ? 'Crear cuenta' : 'Ingresar') }}</button>
        </form>
        <button class="text-action" type="button" (click)="toggleMode()">{{ registerMode() ? '¿Ya tienes cuenta? Inicia sesión' : '¿Aún no tienes cuenta? Regístrate' }}</button>
      </div>
    </section>
  `,
})
export class AuthPage {
  readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly registerMode = signal(this.route.snapshot.url[0]?.path === 'registro');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    fullName: [''],
    phone: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /** Switches between login and registration modes. */
  toggleMode(): void {
    this.registerMode.update((value) => !value);
    this.error.set('');
    void this.router.navigate([this.registerMode() ? '/registro' : '/login']);
  }

  /**
   * Returns a validation message for a form control.
   * @param name Control name.
   */
  fieldError(name: string): string {
    const field = this.form.get(name);
    if (!field?.touched || !field.errors) return '';
    if (field.hasError('required')) return 'Este campo es obligatorio.';
    if (field.hasError('email')) return 'Ingresa un correo válido.';
    if (field.hasError('minlength')) return 'Usa al menos 8 caracteres.';
    return '';
  }

  /** Submits login or registration. */
  submit(): void {
    if (this.registerMode()) {
      this.form.controls.fullName.addValidators(Validators.required);
      this.form.controls.phone.addValidators([Validators.required, Validators.pattern(/^[0-9+()\s-]{7,20}$/)]);
    }
    this.form.updateValueAndValidity();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');
    const { fullName, phone, email, password } = this.form.getRawValue();
    const request = this.registerMode()
      ? this.auth.register({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password,
        })
      : this.auth.login({ email: email.trim().toLowerCase(), password });

    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => {
        const role = this.auth.user()?.role;
        const destination =
          this.route.snapshot.queryParamMap.get('returnUrl') ??
          (role === 'Admin' ? '/admin' : role === 'Barber' ? '/barbero' : '/mi-cuenta');
        void this.router.navigateByUrl(destination);
      },
      error: (error: ApiError) => this.error.set(error.message),
    });
  }
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, RouterLink],
  template: `
    <section class="booking-hero">
      <div class="booking-hero-inner">
        <span class="eyebrow">Reserva en línea</span>
        <h1>Agenda tu cita</h1>
        <p>Sin crear cuenta. Elige servicio, barbero y horario; tu correo y cédula te identifican.</p>
      </div>
    </section>
    <section class="section booking-layout">
      @if (!confirmed()) {
        <ol class="steps" aria-label="Progreso de reserva">
          @for (label of stepLabels; track label; let i = $index) {
            <li
              class="step-item"
              [class.active]="step() === i + 1"
              [class.done]="step() > i + 1"
            >
              <b aria-hidden="true">{{ step() > i + 1 ? '✓' : i + 1 }}</b>
              <span>{{ label }}</span>
            </li>
          }
        </ol>
      }
      @if (error()) { <div class="alert error">{{ error() }}</div> }
      <div class="booking-card" [class.confirmed]="!!confirmed()">
        @if (confirmed(); as booking) {
          <div class="booking-success">
            <div class="success-mark" aria-hidden="true">✓</div>
            <span class="eyebrow">Reserva confirmada</span>
            <h2>¡Listo, {{ booking.customerName }}!</h2>
            <p class="booking-lead">Tu cita quedó registrada. Guarda estos datos para consultar o cancelar después.</p>
          </div>
          <div class="summary elevated">
            <p><span>Servicio</span><strong>{{ booking.serviceName }}</strong></p>
            <p><span>Profesional</span><strong>{{ booking.barberName }}</strong></p>
            <p><span>Fecha y hora</span><strong>{{ booking.startUtc | date:'fullDate' }} · {{ formatSlot(booking.startUtc) }}</strong></p>
            <p><span>Correo</span><strong>{{ booking.customerEmail }}</strong></p>
            <p><span>Cédula</span><strong>{{ booking.customerDocumentNumber }}</strong></p>
            <p><span>Estado</span><strong>{{ booking.status }}</strong></p>
          </div>
          <div class="actions">
            <a class="button primary" routerLink="/mis-citas" [queryParams]="{ email: booking.customerEmail, documentNumber: booking.customerDocumentNumber }">Ver mis citas</a>
            <button class="button ghost" type="button" (click)="reset()">Nueva reserva</button>
          </div>
        } @else if (step() === 1) {
          <div class="booking-step">
            <header class="step-heading">
              <h2>Elige un servicio</h2>
              <p>Explora por categoría y agenda el servicio que mejor te quede.</p>
            </header>
            @if (loadingCatalog()) { <div class="state"><span class="spinner"></span><p>Cargando servicios…</p></div> }
            @else if (!services().length) { <div class="state"><p>No hay servicios disponibles.</p></div> }
            @else {
              <div class="catalog-accordion">
                @for (group of serviceGroups(); track group.name) {
                  <section class="catalog-category" [class.open]="isCategoryOpen(group.name)">
                    <button type="button" class="catalog-category-toggle" (click)="toggleCategory(group.name)" [attr.aria-expanded]="isCategoryOpen(group.name)">
                      <span>{{ group.name }}</span>
                      <span class="catalog-toggle-icon" aria-hidden="true">{{ isCategoryOpen(group.name) ? '−' : '+' }}</span>
                    </button>
                    @if (isCategoryOpen(group.name)) {
                      <div class="catalog-grid">
                        @for (service of group.items; track service.id; let i = $index) {
                          <article class="catalog-card">
                            <div class="catalog-card-main">
                              <h3>{{ i + 1 }}. {{ service.name }}</h3>
                              <p class="catalog-duration">{{ formatDuration(service.durationMinutes) }}</p>
                              <p class="catalog-price">{{ service.price | currency:'COP':'symbol-narrow':'1.0-0' }}</p>
                              @if (service.description) {
                                <p class="catalog-desc" [class.expanded]="expandedInfo() === service.id">{{ service.description }}</p>
                                <button type="button" class="text-link" (click)="toggleInfo(service.id)">
                                  {{ expandedInfo() === service.id ? 'Ver menos' : 'Más información' }}
                                </button>
                              }
                            </div>
                            <button type="button" class="button primary catalog-cta" (click)="selectService(service)">Agendar servicio</button>
                          </article>
                        }
                      </div>
                    }
                  </section>
                }
              </div>
            }
          </div>
        } @else if (step() === 2) {
          <div class="booking-step">
            <button class="back" type="button" (click)="step.set(1)">← Volver a servicios</button>
            <header class="step-heading">
              <h2>Elige tu barbero</h2>
              <p>Tu profesional para {{ selectedService()?.name }}.</p>
            </header>
            @if (loadingCatalog()) { <div class="state"><span class="spinner"></span><p>Cargando barberos…</p></div> }
            @else {
              <div class="choice-grid">
                @for (barber of barbers(); track barber.id) {
                  <button type="button" class="choice barber-choice" (click)="selectBarber(barber)">
                    <span class="choice-avatar" aria-hidden="true">{{ barberInitials(barber.displayName) }}</span>
                    <span class="choice-body">
                      <strong>{{ barber.displayName }}</strong>
                      <em>{{ barber.bio || 'Barbero profesional · técnica precisa' }}</em>
                    </span>
                  </button>
                }
              </div>
            }
          </div>
        } @else if (step() === 3) {
          <div class="booking-step">
            <button class="back" type="button" (click)="step.set(2)">← Volver a barberos</button>
            <header class="step-heading">
              <h2>Fecha y hora</h2>
              <p>Elige el día y luego un horario con {{ selectedBarber()?.displayName }}.</p>
            </header>
            <div class="day-picker" role="listbox" aria-label="Días disponibles">
              @for (day of dayOptions; track day.value) {
                <button
                  type="button"
                  class="day-chip"
                  role="option"
                  [class.active]="dateControl.value === day.value"
                  [attr.aria-selected]="dateControl.value === day.value"
                  (click)="pickDay(day.value)"
                >
                  <span class="day-weekday">{{ day.weekday }}</span>
                  <strong>{{ day.day }}</strong>
                  <span class="day-month">{{ day.month }}</span>
                </button>
              }
            </div>
            <label class="date-field sr-only">Fecha<input type="date" [min]="today" [formControl]="dateControl"></label>
            @if (slotsLoading()) { <div class="state"><span class="spinner"></span><p>Buscando horarios…</p></div> }
            @else if (dateControl.value && !slots().length) {
              <div class="state soft"><p>No hay horarios para esta fecha. Prueba otro día.</p></div>
            } @else if (slotGroups().length) {
              @for (group of slotGroups(); track group.label) {
                <div class="slot-group">
                  <p class="slots-label">{{ group.label }}</p>
                  <div class="slots">
                    @for (slot of group.items; track slot.startUtc) {
                      <button type="button" [class.active-slot]="selectedSlot()?.startUtc === slot.startUtc" (click)="selectSlot(slot)">{{ formatSlot(slot.startUtc) }}</button>
                    }
                  </div>
                </div>
              }
            }
          </div>
        } @else {
          <div class="booking-step">
            <button class="back" type="button" (click)="step.set(3)">← Volver a fecha</button>
            <header class="step-heading">
              <h2>Confirma con tus datos</h2>
              <p>Usa el mismo correo y cédula para consultar la cita después.</p>
            </header>
            <div class="summary elevated">
              <p><span>Servicio</span><strong>{{ selectedService()?.name }}</strong></p>
              <p><span>Profesional</span><strong>{{ selectedBarber()?.displayName }}</strong></p>
              <p><span>Fecha</span><strong>{{ dateControl.value | date:'fullDate' }}</strong></p>
              <p><span>Hora</span><strong>{{ selectedSlot() ? formatSlot(selectedSlot()!.startUtc) : '' }}</strong></p>
            </div>
            <form class="guest-form" [formGroup]="guestForm" (ngSubmit)="confirm()" novalidate>
              <label>Nombre completo<input formControlName="fullName" autocomplete="name"><small>{{ fieldError('fullName') }}</small></label>
              <label>Correo electrónico<input type="email" formControlName="email" autocomplete="email"><small>{{ fieldError('email') }}</small></label>
              <label>Número de cédula<input formControlName="documentNumber" inputmode="numeric" autocomplete="off"><small>{{ fieldError('documentNumber') }}</small></label>
              <label>Teléfono (opcional)<input formControlName="phone" autocomplete="tel" inputmode="tel"></label>
              <label class="wide">Notas (opcional)<textarea rows="3" formControlName="notes" maxlength="300"></textarea></label>
              <button class="button primary full" [disabled]="saving()">{{ saving() ? 'Confirmando…' : 'Confirmar cita' }}</button>
            </form>
          </div>
        }
      </div>
    </section>
  `,
})
export class BookingPage {
  private readonly api = inject(ApiService);
  readonly stepLabels = ['Servicio', 'Barbero', 'Fecha y hora', 'Tus datos'];
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly step = signal(1);
  readonly services = signal<BarberService[]>([]);
  readonly barbers = signal<Barber[]>([]);
  readonly slots = signal<TimeSlot[]>([]);
  readonly selectedService = signal<BarberService | null>(null);
  readonly selectedBarber = signal<Barber | null>(null);
  readonly selectedSlot = signal<TimeSlot | null>(null);
  readonly confirmed = signal<Appointment | null>(null);
  readonly loadingCatalog = signal(true);
  readonly slotsLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly openCategories = signal<Record<string, boolean>>({});
  readonly expandedInfo = signal<string | null>(null);
  readonly dateControl = this.fb.nonNullable.control('');
  readonly guestForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    documentNumber: ['', [Validators.required, Validators.pattern(/^[0-9A-Za-z.\-]{5,30}$/)]],
    phone: [''],
    notes: [''],
  });
  readonly today = new Date().toISOString().slice(0, 10);
  readonly dayOptions = this.buildDayOptions(14);
  readonly serviceGroups = computed<ServiceGroup[]>(() => {
    const order = ['Servicios de corte', 'Combos', 'Otros Servicios'];
    const buckets = new Map<string, BarberService[]>(order.map((name) => [name, []]));
    for (const service of this.services()) {
      const category = this.serviceCategory(service);
      buckets.get(category)!.push(service);
    }
    return order
      .map((name) => ({ name, items: buckets.get(name) ?? [] }))
      .filter((group) => group.items.length > 0);
  });
  readonly slotGroups = computed<SlotGroup[]>(() => {
    const morning: TimeSlot[] = [];
    const afternoon: TimeSlot[] = [];
    const evening: TimeSlot[] = [];
    for (const slot of this.slots()) {
      const hour = new Date(slot.startUtc).getHours();
      if (hour < 12) morning.push(slot);
      else if (hour < 17) afternoon.push(slot);
      else evening.push(slot);
    }
    return [
      { label: 'Mañana', items: morning },
      { label: 'Tarde', items: afternoon },
      { label: 'Noche', items: evening },
    ].filter((group) => group.items.length > 0);
  });

  constructor() {
    this.api.getServices().pipe(finalize(() => this.loadingCatalog.set(false))).subscribe({
      next: (items) => {
        const active = items.filter((item) => item.isActive);
        this.services.set(active);
        const firstCategory = this.serviceCategory(active[0] ?? { name: '' } as BarberService);
        if (active.length) this.openCategories.set({ [firstCategory]: true });
        const id = this.route.snapshot.queryParamMap.get('serviceId');
        const selected = active.find((item) => item.id === id);
        if (selected) this.selectService(selected);
      },
      error: (e: ApiError) => this.error.set(e.message),
    });
    this.dateControl.valueChanges.subscribe(() => this.loadSlots());
  }

  /**
   * Advances the booking flow with the chosen service.
   * @param service Selected service.
   */
  selectService(service: BarberService): void {
    this.selectedService.set(service);
    this.step.set(2);
    this.loadingCatalog.set(true);
    this.api.getBarbers().pipe(finalize(() => this.loadingCatalog.set(false))).subscribe({
      next: (items) => {
        const active = items.filter((item) => item.isActive);
        this.barbers.set(active);
        if (active.length === 1) this.selectBarber(active[0]);
      },
      error: (e: ApiError) => this.error.set(e.message),
    });
  }

  /**
   * Advances the booking flow with the chosen barber.
   * @param barber Selected barber.
   */
  selectBarber(barber: Barber): void {
    this.selectedBarber.set(barber);
    this.step.set(3);
    if (!this.dateControl.value) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.dateControl.setValue(tomorrow.toISOString().slice(0, 10));
    } else {
      this.loadSlots();
    }
  }

  /**
   * Advances the booking flow with the chosen slot.
   * @param slot Available UTC slot.
   */
  selectSlot(slot: TimeSlot): void {
    this.selectedSlot.set(slot);
    this.step.set(4);
  }

  /**
   * Selects a day from the visual day picker.
   * @param value ISO date string (yyyy-MM-dd).
   */
  pickDay(value: string): void {
    this.dateControl.setValue(value);
  }

  /**
   * Toggles an accordion service category.
   * @param name Category name.
   */
  toggleCategory(name: string): void {
    this.openCategories.update((state) => ({ ...state, [name]: !state[name] }));
  }

  /**
   * Returns whether a category accordion is expanded.
   * @param name Category name.
   */
  isCategoryOpen(name: string): boolean {
    return !!this.openCategories()[name];
  }

  /**
   * Expands or collapses the full service description.
   * @param serviceId Service identifier.
   */
  toggleInfo(serviceId: string): void {
    this.expandedInfo.update((current) => (current === serviceId ? null : serviceId));
  }

  /** Loads available slots for the current selection. */
  loadSlots(): void {
    const barber = this.selectedBarber();
    const service = this.selectedService();
    const date = this.dateControl.value;
    if (!barber || !service || !date) return;
    this.slotsLoading.set(true);
    this.slots.set([]);
    this.selectedSlot.set(null);
    this.api
      .getAvailability(barber.id, service.id, date)
      .pipe(finalize(() => this.slotsLoading.set(false)))
      .subscribe({
        next: (items) => this.slots.set(items),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  /**
   * Formats a UTC instant as a compact 24-hour local time.
   * @param value ISO UTC timestamp.
   */
  formatSlot(value: string): string {
    return new Date(value).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  /**
   * Formats service duration for catalog cards.
   * @param minutes Duration in minutes.
   */
  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!rest) return hours === 1 ? '1 hr' : `${hours} hrs`;
    return `${hours} h ${rest} min`;
  }

  /**
   * Builds short initials for a barber avatar.
   * @param name Barber display name.
   */
  barberInitials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  /**
   * Maps a service into a catalog category inspired by salon booking UX.
   * @param service Service to categorize.
   */
  serviceCategory(service: BarberService): string {
    const name = service.name.toLowerCase();
    if (
      name.includes('combo') ||
      name.includes(' and ') ||
      name.includes(' y ') ||
      name.includes('+') ||
      (name.includes('haircut') && name.includes('beard')) ||
      (name.includes('corte') && name.includes('barba'))
    ) {
      return 'Combos';
    }
    if (
      name.includes('beard') ||
      name.includes('barba') ||
      name.includes('ceja') ||
      name.includes('tratamiento') ||
      name.includes('color') ||
      name.includes('afeitado')
    ) {
      return 'Otros Servicios';
    }
    return 'Servicios de corte';
  }

  /**
   * Returns a validation message for a guest form control.
   * @param name Control name.
   */
  fieldError(name: string): string {
    const field = this.guestForm.get(name);
    if (!field?.touched || !field.errors) return '';
    if (field.hasError('required')) return 'Este campo es obligatorio.';
    if (field.hasError('email')) return 'Ingresa un correo válido.';
    if (field.hasError('minlength') || field.hasError('pattern')) return 'Revisa este dato.';
    return '';
  }

  /** Confirms the appointment with guest identity data. */
  confirm(): void {
    const service = this.selectedService();
    const barber = this.selectedBarber();
    const slot = this.selectedSlot();
    if (!service || !barber || !slot) return;
    if (this.guestForm.invalid) {
      this.guestForm.markAllAsTouched();
      return;
    }

    const value = this.guestForm.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this.api
      .createGuestAppointment({
        fullName: value.fullName.trim(),
        email: value.email.trim().toLowerCase(),
        documentNumber: value.documentNumber.trim(),
        phone: value.phone.trim() || undefined,
        serviceId: service.id,
        barberId: barber.id,
        startUtc: slot.startUtc,
        notes: value.notes.trim() || undefined,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (appointment) => this.confirmed.set(appointment),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  /** Restarts the booking wizard. */
  reset(): void {
    this.confirmed.set(null);
    this.step.set(1);
    this.selectedService.set(null);
    this.selectedBarber.set(null);
    this.selectedSlot.set(null);
    this.slots.set([]);
    this.expandedInfo.set(null);
    this.dateControl.setValue('');
    this.guestForm.reset({ fullName: '', email: '', documentNumber: '', phone: '', notes: '' });
    this.error.set('');
  }

  /**
   * Builds selectable day chips for the next N days.
   * @param count Number of upcoming days.
   */
  private buildDayOptions(count: number): DayOption[] {
    const formatterWeekday = new Intl.DateTimeFormat('es-CO', { weekday: 'short' });
    const formatterMonth = new Intl.DateTimeFormat('es-CO', { month: 'short' });
    const options: DayOption[] = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    for (let i = 0; i < count; i++) {
      const date = new Date(base);
      date.setDate(base.getDate() + i);
      options.push({
        value: date.toISOString().slice(0, 10),
        weekday: formatterWeekday.format(date).replace('.', ''),
        day: String(date.getDate()).padStart(2, '0'),
        month: formatterMonth.format(date).replace('.', ''),
      });
    }
    return options;
  }
}
