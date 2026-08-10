import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Appointment,
  AppointmentStatus,
  AuthResponse,
  Barber,
  BarberService,
  CreateAppointmentRequest,
  CreateBarberRequest,
  CreateGuestAppointmentRequest,
  Customer,
  LoginRequest,
  Page,
  RegisterRequest,
  Schedule,
  TimeSlot,
  UpsertScheduleRequest,
  UpsertServiceRequest,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Authenticates an existing account.
   * @param payload Login credentials.
   */
  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, payload);
  }

  /**
   * Registers a new customer account.
   * @param payload Registration payload.
   */
  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/register`, payload);
  }

  /**
   * Lists active services with pagination.
   * @param page Page number starting at 1.
   * @param pageSize Page size.
   */
  getServices(page = 1, pageSize = 100): Observable<BarberService[]> {
    return this.http
      .get<Page<BarberService>>(`${this.baseUrl}/services`, {
        params: { page, pageSize, active: true },
      })
      .pipe(map((response) => response.items));
  }

  /**
   * Creates or updates a service for administrators.
   * @param id Existing service identifier, if any.
   * @param payload Service payload.
   */
  saveService(id: string | null, payload: UpsertServiceRequest): Observable<BarberService> {
    return id
      ? this.http.put<BarberService>(`${this.baseUrl}/services/${id}`, payload)
      : this.http.post<BarberService>(`${this.baseUrl}/services`, payload);
  }

  /**
   * Soft-deletes a service.
   * @param id Service identifier.
   */
  deleteService(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/services/${id}`);
  }

  /**
   * Lists active barbers.
   * @param page Page number starting at 1.
   * @param pageSize Page size.
   */
  getBarbers(page = 1, pageSize = 100): Observable<Barber[]> {
    return this.http
      .get<Page<Barber>>(`${this.baseUrl}/barbers`, { params: { page, pageSize } })
      .pipe(map((response) => response.items));
  }

  /**
   * Creates a barber account (admin only).
   * @param payload Barber creation payload.
   */
  createBarber(payload: CreateBarberRequest): Observable<Barber> {
    return this.http.post<Barber>(`${this.baseUrl}/admin/barbers`, payload);
  }

  /**
   * Lists all barbers for administration, including inactive ones.
   * @param page Page number starting at 1.
   * @param pageSize Page size.
   */
  getAdminBarbers(page = 1, pageSize = 100): Observable<Barber[]> {
    return this.http
      .get<Page<Barber>>(`${this.baseUrl}/admin/barbers`, { params: { page, pageSize } })
      .pipe(map((response) => response.items));
  }

  /**
   * Activates or deactivates a barber profile.
   * @param id Barber identifier.
   * @param isActive Desired active flag.
   */
  setBarberStatus(id: string, isActive: boolean): Observable<Barber> {
    return this.http.patch<Barber>(`${this.baseUrl}/admin/barbers/${id}/status`, { isActive });
  }

  /**
   * Returns available UTC slots for a barber, service, and date.
   * @param barberId Barber identifier.
   * @param serviceId Service identifier.
   * @param date Local calendar date in YYYY-MM-DD.
   */
  getAvailability(barberId: string, serviceId: string, date: string): Observable<TimeSlot[]> {
    const params = new HttpParams()
      .set('barberId', barberId)
      .set('serviceId', serviceId)
      .set('date', date);
    return this.http.get<TimeSlot[]>(`${this.baseUrl}/availability`, { params });
  }

  /**
   * Creates a guest appointment without authentication.
   * @param payload Guest booking payload.
   */
  createGuestAppointment(payload: CreateGuestAppointmentRequest): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/bookings`, payload);
  }

  /**
   * Creates a customer appointment.
   * @param payload Appointment creation payload.
   */
  createAppointment(payload: CreateAppointmentRequest): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/appointments`, payload);
  }

  /**
   * Lists guest appointments by email and document number.
   * @param email Customer email.
   * @param documentNumber Customer document number.
   */
  getGuestAppointments(email: string, documentNumber: string): Observable<Page<Appointment>> {
    const params = new HttpParams()
      .set('email', email)
      .set('documentNumber', documentNumber)
      .set('pageSize', 100);
    return this.http.get<Page<Appointment>>(`${this.baseUrl}/bookings`, { params });
  }

  /**
   * Cancels a guest appointment after ownership verification.
   * @param id Appointment identifier.
   * @param email Customer email.
   * @param documentNumber Customer document number.
   */
  cancelGuestAppointment(id: string, email: string, documentNumber: string): Observable<Appointment> {
    const params = new HttpParams().set('email', email).set('documentNumber', documentNumber);
    return this.http.post<Appointment>(`${this.baseUrl}/bookings/${id}/cancel`, {}, { params });
  }

  /**
   * Lists appointments according to the authenticated user's scope.
   * @param params Optional filters and pagination.
   */
  getAppointments(params: Record<string, string | number> = {}): Observable<Page<Appointment>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) {
        httpParams = httpParams.set(key, value);
      }
    });
    return this.http.get<Page<Appointment>>(`${this.baseUrl}/appointments`, { params: httpParams });
  }

  /**
   * Updates an appointment status.
   * @param id Appointment identifier.
   * @param status Target status.
   */
  updateAppointmentStatus(id: string, status: AppointmentStatus): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.baseUrl}/appointments/${id}/status`, { status });
  }

  /**
   * Cancels an appointment.
   * @param id Appointment identifier.
   */
  cancelAppointment(id: string): Observable<Appointment> {
    return this.updateAppointmentStatus(id, 'Cancelled');
  }

  /**
   * Lists customers for administrators.
   * @param params Pagination and search filters.
   */
  getClients(params: Record<string, string | number>): Observable<Page<Customer>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) {
        httpParams = httpParams.set(key, value);
      }
    });
    return this.http.get<Page<Customer>>(`${this.baseUrl}/admin/clients`, { params: httpParams });
  }

  /**
   * Lists schedules for a barber.
   * @param barberId Barber identifier.
   */
  getSchedules(barberId: string): Observable<Schedule[]> {
    return this.http.get<Schedule[]>(`${this.baseUrl}/admin/barbers/${barberId}/schedules`);
  }

  /**
   * Creates a weekly schedule entry for a barber.
   * @param barberId Barber identifier.
   * @param payload Schedule payload.
   */
  saveSchedule(barberId: string, payload: UpsertScheduleRequest): Observable<Schedule> {
    return this.http.post<Schedule>(`${this.baseUrl}/admin/barbers/${barberId}/schedules`, payload);
  }

  /**
   * Deletes a schedule entry.
   * @param id Schedule identifier.
   */
  deleteSchedule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/schedules/${id}`);
  }
}
