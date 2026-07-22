import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/public.pages').then((m) => m.HomePage), title: 'Inicio | Gemelli Studio' },
  { path: 'servicios', loadComponent: () => import('./features/public.pages').then((m) => m.ServicesPage), title: 'Servicios | Gemelli Studio' },
  { path: 'login', loadComponent: () => import('./features/public.pages').then((m) => m.AuthPage), title: 'Ingresar | Gemelli Studio' },
  { path: 'reservar', loadComponent: () => import('./features/public.pages').then((m) => m.BookingPage), title: 'Reservar | Gemelli Studio' },
  { path: 'mis-citas', loadComponent: () => import('./features/client.page').then((m) => m.ClientPage), title: 'Mis citas | Gemelli Studio' },
  { path: 'mi-cuenta', redirectTo: 'mis-citas' },
  { path: 'admin', canActivate: [authGuard, roleGuard], data: { roles: ['Admin'] }, loadComponent: () => import('./features/admin.page').then((m) => m.AdminPage), title: 'Administración | Gemelli Studio' },
  { path: 'barbero', canActivate: [authGuard, roleGuard], data: { roles: ['Barber'] }, loadComponent: () => import('./features/barber.page').then((m) => m.BarberPage), title: 'Mi agenda | Gemelli Studio' },
  { path: 'registro', redirectTo: 'reservar' },
  { path: '**', redirectTo: '' },
];
