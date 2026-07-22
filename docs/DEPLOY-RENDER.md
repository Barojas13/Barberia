# Despliegue en Render (gratis) + GitHub personal

## 1. Subir a tu GitHub personal

En esta máquina `gh` no está instalado, así que usa tu cuenta de GitHub normal:

```bash
cd C:\Fuentes\Barberia
git init
git add .
git commit -m "Initial Gemelli Studio application"

# Crea un repo vacío en github.com (Personal) y luego:
git branch -M main
git remote add origin https://github.com/TU_USUARIO/gemelli-studio.git
git push -u origin main
```

Inicia sesión con **tus** credenciales de GitHub (usuario/token personal). No uses credenciales de otra cuenta u organización.

## 2. Desplegar en Render (como eventosvivos)

### A. API (Docker Web Service)

1. En Render: **New → Web Service**
2. Conecta tu repo personal de GitHub
3. Runtime: **Docker**
4. Dockerfile path: `./Dockerfile`
5. Plan: **Free**
6. Health check path: `/health`
7. Environment:

| Key | Value |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__DefaultConnection` | `Data Source=/data/barberia.db` |
| `Jwt__Issuer` | `Gemelli.Studio.Api` |
| `Jwt__Audience` | `Gemelli.Studio.Web` |
| `Jwt__Key` | genera una cadena larga aleatoria (≥ 32 caracteres) |
| `Jwt__ExpirationMinutes` | `120` |
| `SeedOnStartup` | `true` |
| `Cors__AllowedOrigins__0` | URL del frontend, ej. `https://gemelli-studio-web.onrender.com` |

Copia la URL pública de la API (ej. `https://gemelli-studio-api.onrender.com`).

### B. Web (Static Site)

1. **New → Static Site**
2. Mismo repo
3. Build command:

```bash
cd frontend/barberia-web && npm ci && node scripts/set-api-url.mjs && npm run build -- --configuration=production
```

4. Publish directory:

```text
frontend/barberia-web/dist/barberia-web/browser
```

5. Environment:

| Key | Value |
|---|---|
| `API_URL` | `https://gemelli-studio-api.onrender.com` |

6. Rewrite SPA: `/*` → `/index.html`

### C. Orden recomendado

1. Despliega la API
2. Configura `Cors__AllowedOrigins__0` con la URL del Static Site (puedes crear el Static Site primero para conocer la URL, o actualizar CORS después)
3. Despliega/redeploy el frontend con `API_URL` apuntando a la API
4. Si creaste el web antes que la API, haz **Manual Deploy** del web cuando la API esté lista

## 3. Credenciales de la app (seed)

Con `SeedOnStartup=true` se crean:

- Admin: `admin@barberia.local` / `DevAdmin123!`
- Barbero: `barber@barberia.local` / `DevBarber123!`

Cámbialas después del primer acceso. Son solo para desarrollo/demo.

## 4. Notas del plan free

- El servicio Docker se duerme tras inactividad; la primera petición puede tardar ~30–60s
- SQLite en `/data` **no es persistente** en free sin disco: un redeploy puede borrar citas
- Para datos persistentes gratis más adelante: Postgres gratuito externo (Neon, etc.) cambiando solo `ConnectionStrings__DefaultConnection`

## 5. Blueprint opcional

También puedes usar **New → Blueprint** con el archivo `render.yaml` del repo. Aun así debes completar a mano:

- `Cors__AllowedOrigins__0`
- `API_URL` del Static Site
