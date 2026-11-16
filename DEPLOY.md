# Cómo publicar el sistema en internet

El sistema es una app Node con base SQLite y archivos subidos en disco. Necesita un servidor que ejecute Node y un **disco persistente** (sin disco, los datos se borran en cada despliegue).

## Antes de publicar: contraseña

La app ya tiene login. La contraseña inicial es `carpinteria2026` y se puede cambiar en **Cuentas y categorías → Seguridad**.

Para definir otra desde el inicio, usa la variable de entorno `APP_PASSWORD` en el servidor. Si el servidor ya tiene contraseña guardada, esa variable no la sobrescribe.

## Opción 1 — Render (más simple)

1. Sube el proyecto a un repositorio de GitHub.
2. En Render: **New → Blueprint**, elige el repositorio. El archivo `render.yaml` ya trae la configuración.
3. Define `APP_PASSWORD` cuando lo pida.
4. El disco de 1 GB se monta en `/var/data` y guarda la base y los adjuntos.

El disco persistente requiere el plan pago (Starter). En el plan gratuito el servicio duerme y pierde los datos.

## Opción 2 — Fly.io

```bash
fly launch --no-deploy
fly volumes create datos --size 1
fly secrets set APP_PASSWORD=tu_contraseña
fly deploy
```

El `fly.toml` ya apunta el volumen a `/data` y usa la región `gru` (São Paulo).

## Opción 3 — Cualquier servidor con Docker

```bash
docker build -t finanzas-carpinteria .
docker run -d --name finanzas -p 8080:8080 \
  -e APP_PASSWORD=tu_contraseña \
  -v finanzas-datos:/data \
  -e DATA_DIR=/data -e UPLOAD_DIR=/data/uploads \
  finanzas-carpinteria
```

Detrás de un proxy con HTTPS (Caddy, Nginx, Traefik), la cookie de sesión se marca `Secure` automáticamente al detectar `X-Forwarded-Proto: https`.

## Opción 4 — Túnel temporal (para probar hoy)

Sin cuenta y sin servidor, mientras la computadora esté encendida:

```bash
npm run publicar
```

Levanta el servidor y el túnel juntos, reinicia cualquiera de los dos si se cae y escribe la URL pública en `public-url.txt`. El registro queda en `publicacao.log`.

Genera una URL `https://algo.trycloudflare.com` válida mientras el proceso siga abierto. Sirve para que tu hermano pruebe el sistema, no para uso permanente: la URL cambia cada vez y no hay garantía de disponibilidad.

## Opción 5 — Script de despliegue en Render

Con una API key de Render y el repositorio ya en GitHub:

```bash
RENDER_API_KEY=rnd_xxx GITHUB_REPO=usuario/finanzas-carpinteria APP_PASSWORD=tu_contraseña \
  node scripts/deploy-render.mjs
```

Crea el servicio web con disco de 1 GB en `/var/data`, variables de entorno y health check en `/login`. Grava o id do serviço e a URL em `render-service.json`.

## Variables de entorno

| Variable | Para qué sirve | Por defecto |
| --- | --- | --- |
| `PORT` | Puerto del servidor | `4173` |
| `APP_PASSWORD` | Contraseña inicial | `carpinteria2026` |
| `DATA_DIR` | Carpeta de la base SQLite | `./data` |
| `UPLOAD_DIR` | Carpeta de comprobantes | `./uploads` |

## Respaldo en producción

Copia la carpeta del disco (`/var/data` en Render y Fly, el volumen en Docker). Contiene `financas.db` y `uploads/`.

## WhatsApp en producción

Con la app publicada, la URL del webhook deja de ser local:

```
https://tu-dominio/api/whatsapp/webhook?token=TU_TOKEN
```

Ese enderezo se puede registrar directamente en el proveedor (Meta Cloud API, Evolution API, Z-API), sin túnel.
