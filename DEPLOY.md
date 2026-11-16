# Cómo publicar el sistema en internet

**Producción actual:** https://finanzas-carpinteria.onrender.com
Servicio Render `srv-dbtgq3e1egvs73aju4lg`, repositorio `josartpsd-cell/finanzas-carpinteria`, rama `master`.

El sistema es una app Node con base SQLite y archivos subidos en disco. Necesita un servidor que ejecute Node y un **disco persistente** (sin disco, los datos se borran en cada despliegue).

## Aviso importante sobre el plan gratuito

El servicio está hoy en el plan **free**: no tiene disco persistente. Cada deploy o reinicio vuelve a crear la base con los datos de ejemplo, y lo que se haya registrado se pierde.

Para conservar los datos hay que pasar al plan **starter** (agregar tarjeta en https://dashboard.render.com/billing) y crear el disco de 1 GB en `/var/data` con `DATA_DIR=/var/data` y `UPLOAD_DIR=/var/data/uploads`.

Mientras tanto, usa **Cuentas y categorías → Respaldo → Descargar respaldo** para guardar un JSON con todo fuera del servidor.

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

## Opción 6 — Hostinger

### VPS (recomendado)

Con root por SSH, un solo comando hace todo: instala Node 22, crea usuario, clona el repo, monta systemd y nginx.

```bash
HOST=IP_DO_VPS USER=root PORT_SSH=22 ./scripts/deploy-hostinger.sh
```

Con dominio y HTTPS:

```bash
HOST=IP USER=root DOMINIO=finanzas.seudominio.com ./scripts/deploy-hostinger.sh
# depois, no servidor:
certbot --nginx -d finanzas.seudominio.com
```

Los datos quedan en `/opt/finanzas/data` y `/opt/finanzas/uploads`, fuera del repositorio, y sobreviven a los deploys. Para actualizar: `git push` y volver a correr el script (hace `git reset --hard` y reinicia el servicio).

### Hospedaje compartido (hPanel)

El plan compartido no permite procesos propios ni systemd. Si el plan tiene **Setup Node.js App**:

1. Sube el proyecto por Git o File Manager a `~/domains/SEU-DOMINIO/finanzas`.
2. En hPanel → **Advanced → Node.js**: aplicación `finanzas`, versión 22, archivo de inicio `app.js`, modo `production`.
3. Define las variables `DATA_DIR` y `UPLOAD_DIR` apuntando a una carpeta dentro de `~/domains/SEU-DOMINIO/datos`.
4. Reinicia la aplicación desde hPanel.

El archivo `app.js` en la raíz existe justamente para ese caso: solo importa `server.js`.

Limitaciones del compartido: sin procesos en segundo plano, sin control de puertos y sin `certbot` propio. Para uso real con datos financieros, el VPS es la opción correcta.

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
