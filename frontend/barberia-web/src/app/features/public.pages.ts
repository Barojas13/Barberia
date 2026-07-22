import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ApiError, Appointment, Barber, BarberService, TimeSlot } from '../core/models';

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
    <section class="page-header"><span class="eyebrow">Reserva en línea</span><h1>Agenda tu cita</h1><p>Sin crear cuenta: usa tu correo y cédula para identificarte.</p></section>
    <section class="section booking-layout">
      @if (!confirmed()) {
        <div class="steps" aria-label="Progreso de reserva">
          @for (label of ['Servicio','Barbero','Fecha y hora','Tus datos']; track label; let i = $index) {
            <span [class.active]="step() >= i + 1"><b>{{ i + 1 }}</b>{{ label }}</span>
          }
        </div>
      }
      @if (error()) { <div class="alert error">{{ error() }}</div> }
      <div class="booking-card">
        @if (confirmed(); as booking) {
          <div class="state">
            <span class="eyebrow">Reserva confirmada</span>
            <h2>¡Listo, {{ booking.customerName }}!</h2>
            <p>Tu cita quedó registrada. Guarda estos datos para consultar o cancelar después.</p>
          </div>
          <div class="summary">
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
          <h2>Elige un servicio</h2>
          @if (loadingCatalog()) { <div class="state"><span class="spinner"></span><p>Cargando servicios…</p></div> }
          @else if (!services().length) { <div class="state"><p>No hay servicios disponibles.</p></div> }
          @else {
            <div class="choice-grid">
              @for (service of services(); track service.id) {
                <button type="button" class="choice" (click)="selectService(service)">
                  <strong>{{ service.name }}</strong>
                  <span>{{ service.durationMinutes }} min · {{ service.price | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
                </button>
              }
            </div>
          }
        } @else if (step() === 2) {
          <button class="back" type="button" (click)="step.set(1)">← Volver</button>
          <h2>Elige tu barbero</h2>
          @if (loadingCatalog()) { <div class="state"><span class="spinner"></span></div> }
          @else {
            <div class="choice-grid">
              @for (barber of barbers(); track barber.id) {
                <button type="button" class="choice" (click)="selectBarber(barber)">
                  <strong>{{ barber.displayName }}</strong>
                  <span>{{ barber.bio || 'Barbero profesional' }}</span>
                </button>
              }
            </div>
          }
        } @else if (step() === 3) {
          <button class="back" type="button" (click)="step.set(2)">← Volver</button>
          <h2>Fecha y hora</h2>
          <label>Fecha<input type="date" [min]="today" [formControl]="dateControl"></label>
          @if (slotsLoading()) { <div class="state"><span class="spinner"></span><p>Buscando horarios…</p></div> }
          @else if (dateControl.value && !slots().length) { <div class="state"><p>No hay horarios disponibles para esta fecha. Prueba otro día.</p></div> }
          <div class="slots">
            @for (slot of slots(); track slot.startUtc) {
              <button type="button" [class.active-slot]="selectedSlot()?.startUtc === slot.startUtc" (click)="selectSlot(slot)">{{ formatSlot(slot.startUtc) }}</button>
            }
          </div>
        } @else {
          <button class="back" type="button" (click)="step.set(3)">← Volver</button>
          <h2>Confirma con tus datos</h2>
          <div class="summary">
            <p><span>Servicio</span><strong>{{ selectedService()?.name }}</strong></p>
            <p><span>Profesional</span><strong>{{ selectedBarber()?.displayName }}</strong></p>
            <p><span>Fecha</span><strong>{{ dateControl.value | date:'fullDate' }}</strong></p>
            <p><span>Hora</span><strong>{{ selectedSlot() ? formatSlot(selectedSlot()!.startUtc) : '' }}</strong></p>
          </div>
          <form [formGroup]="guestForm" (ngSubmit)="confirm()" novalidate>
            <label>Nombre completo<input formControlName="fullName" autocomplete="name"><small>{{ fieldError('fullName') }}</small></label>
            <label>Correo electrónico<input type="email" formControlName="email" autocomplete="email"><small>{{ fieldError('email') }}</small></label>
            <label>Número de cédula<input formControlName="documentNumber" inputmode="numeric" autocomplete="off"><small>{{ fieldError('documentNumber') }}</small></label>
            <label>Teléfono (opcional)<input formControlName="phone" autocomplete="tel" inputmode="tel"></label>
            <label>Notas (opcional)<textarea rows="3" formControlName="notes" maxlength="300"></textarea></label>
            <button class="button primary full" [disabled]="saving()">{{ saving() ? 'Confirmando…' : 'Confirmar cita' }}</button>
          </form>
        }
      </div>
    </section>
  `,
})
export class BookingPage {
  private readonly api = inject(ApiService);
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
  readonly dateControl = this.fb.nonNullable.control('');
  readonly guestForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    documentNumber: ['', [Validators.required, Validators.pattern(/^[0-9A-Za-z.\-]{5,30}$/)]],
    phone: [''],
    notes: [''],
  });
  readonly today = new Date().toISOString().slice(0, 10);

  constructor() {
    this.api.getServices().pipe(finalize(() => this.loadingCatalog.set(false))).subscribe({
      next: (items) => {
        this.services.set(items.filter((item) => item.isActive));
        const id = this.route.snapshot.queryParamMap.get('serviceId');
        const selected = items.find((item) => item.id === id);
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
   * Formats a UTC instant as a local time string.
   * @param value ISO UTC timestamp.
   */
  formatSlot(value: string): string {
    return new Date(value).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
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
    this.dateControl.setValue('');
    this.guestForm.reset({ fullName: '', email: '', documentNumber: '', phone: '', notes: '' });
    this.error.set('');
  }
}
