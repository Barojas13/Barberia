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

## 2. Base de datos persistente (Neon Postgres, gratis)

SQLite en Render Free **se borra** en cada redeploy. Usa Neon para guardar barberos, citas y horarios.

1. Entra a [https://neon.tech](https://neon.tech) y crea una cuenta
2. **Create project** → región cercana (ej. `Virginia` / US East)
3. En el dashboard copia la connection string (**Connection string** → URI), algo como:

```text
postgresql://usuario:clave@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

4. En Render → **gemelli-studio-api** → **Environment**, usa **formato con punto y coma** (recomendado, evita el bug del `=`):

```text
Host=ep-xxxx-pooler.c-4.us-east-2.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=TU_CLAVE;SSL Mode=Require
```

Si prefieres la URI, en Render pégala **entre comillas**:

```text
"postgresql://usuario:clave@ep-xxxx-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

> Importante: sin comillas, Render corta `sslmode=require` y deja solo `sslmode`, y la API falla.

5. Guarda y haz **Manual Deploy** de la API
6. Con `SeedOnStartup=true` se crean admin/barbero iniciales **una vez** en Neon
7. Los barberos y citas que crees **ya no se borran** al redeployar

Local sigue usando SQLite (`Data Source=barberia.db`) sin cambios.

## 3. Desplegar en Render

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
| `ConnectionStrings__DefaultConnection` | URI de Neon (ver sección 2) |
| `Jwt__Issuer` | `Gemelli.Studio.Api` |
| `Jwt__Audience` | `Gemelli.Studio.Web` |
| `Jwt__Key` | genera una cadena larga aleatoria (≥ 32 caracteres) |
| `Jwt__ExpirationMinutes` | `120` |
| `SeedOnStartup` | `true` |
| `Cors__AllowedOrigins__0` | URL del frontend, ej. `https://barberia-2n8e.onrender.com` |

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
| `NODE_VERSION` | `24.15.0` |

6. Rewrite SPA: `/*` → `/index.html`

### C. Orden recomendado

1. Crea Neon y configura la connection string
2. Despliega/redeploy la API
3. Configura `Cors__AllowedOrigins__0` con la URL del Static Site
4. Despliega el frontend con `API_URL` apuntando a la API

## 4. Credenciales de la app (seed)

Con `SeedOnStartup=true` se crean:

- Admin: `admin@barberia.local` / `DevAdmin123!`
- Barbero: `barber@barberia.local` / `DevBarber123!`

Cámbialas después del primer acceso. Son solo para desarrollo/demo.

## 5. Notas del plan free

- El servicio Docker se duerme tras inactividad; la primera petición puede tardar ~30–60s
- Neon Free también puede “pausar”; la primera query puede tardar unos segundos
- No uses `Data Source=/data/barberia.db` en Render si quieres datos permanentes

## 6. Blueprint opcional

También puedes usar **New → Blueprint** con el archivo `render.yaml` del repo. Aun así debes completar a mano:

- `ConnectionStrings__DefaultConnection` (Neon)
- `Cors__AllowedOrigins__0`
- `API_URL` del Static Site
