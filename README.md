# Gemelli Studio — aplicación integral

Aplicación completa para **Gemelli Studio** (`@gemelli.studio.ba`) con:

- **Backend:** ASP.NET Core 10 Web API
- **Frontend:** Angular 22
- **Base de datos:** SQLite (sin servidor externo)

## Estructura

```
Barberia/
├── backend/
│   ├── Barberia.Api
│   ├── Barberia.Application
│   ├── Barberia.Domain
│   └── Barberia.Infrastructure
├── frontend/barberia-web
├── docs/DEPLOY-RENDER.md
├── Dockerfile
└── render.yaml
```

## Requisitos

- .NET SDK 10
- Node.js 20+ y npm

## Credenciales de desarrollo / seed

| Rol     | Correo                   | Contraseña      |
|---------|--------------------------|-----------------|
| Admin   | `admin@barberia.local`   | `DevAdmin123!`  |
| Barbero | `barber@barberia.local`  | `DevBarber123!` |

La migración y el seed se aplican al iniciar si `SeedOnStartup=true` (activo por defecto en Development).

## Ejecutar en local

```bash
# API
cd backend/Barberia.Api
dotnet run --launch-profile http

# Web
cd frontend/barberia-web
npm install
npm start
```

- Web: http://localhost:4200
- API: http://localhost:5000
- Swagger: http://localhost:5000/swagger

## Reserva (sin cuenta)

1. Ir a **Reservar**
2. Elegir servicio, barbero, fecha y hora
3. Confirmar con **nombre + correo + cédula**
4. Consultar/cancelar en **Mis citas** con el mismo correo y cédula

## Staff

- Login en `/login` solo para Admin y Barbero
- Admin: servicios, barberos, horarios, clientes y citas
- Barbero: agenda y estados

## GitHub + Render (gratis)

Guía completa: [docs/DEPLOY-RENDER.md](docs/DEPLOY-RENDER.md)

Resumen:

1. Sube el repo a **tu GitHub personal** con tus credenciales
2. En Render crea:
   - **Web Service (Docker)** → API
   - **Static Site** → Angular
3. Configura variables de entorno (`Jwt__Key`, `Cors__AllowedOrigins__0`, `API_URL`)
4. No uses secretos del entorno local en producción; genera valores nuevos en Render

## Notas

- Los secretos de producción van en Render → Environment (ver `.env.example`)
- SQLite en el plan free de Render puede perderse en redeploys sin disco persistente
- El JWT de `appsettings.Development.json` es solo local
