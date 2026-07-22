/** Application roles returned by the API. */
export type UserRole = 'Admin' | 'Barber' | 'Customer';

/** Appointment lifecycle statuses returned by the API. */
export type AppointmentStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  expiresAtUtc: string;
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface Barber {
  id: string;
  displayName: string;
  bio?: string | null;
  isActive: boolean;
}

export interface BarberService {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export interface TimeSlot {
  startUtc: string;
  endUtc: string;
}

export interface Appointment {
  id: string;
  barberId: string;
  barberName: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerDocumentNumber: string;
  serviceId: string;
  serviceName: string;
  startUtc: string;
  endUtc: string;
  status: AppointmentStatus;
  notes?: string | null;
}

export interface CreateGuestAppointmentRequest {
  fullName: string;
  email: string;
  documentNumber: string;
  phone?: string;
  barberId: string;
  serviceId: string;
  startUtc: string;
  notes?: string;
}

export interface CreateAppointmentRequest {
  barberId: string;
  serviceId: string;
  startUtc: string;
  notes?: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface Schedule {
  id: string;
  barberId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface UpsertServiceRequest {
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export interface CreateBarberRequest {
  email: string;
  password: string;
  displayName: string;
  bio?: string;
}

export interface UpsertScheduleRequest {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface Customer {
  id: string;
  fullName: string;
  phone?: string | null;
  email: string;
  documentNumber: string;
}
