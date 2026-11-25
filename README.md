# Finanzas — Carpintería

App de gestión financiera para el día a día de la carpintería y de la casa: movimientos, ventas, balance mensual consolidado y una bandeja de entrada de WhatsApp lista para recibir textos, audios y fotos de facturas.

Corre en tu computadora, sin internet y sin login. Los datos quedan en una base SQLite local.

## Cómo ejecutar

```bash
npm install
npm start
```

Abre http://localhost:4173 en el navegador. La contraseña inicial es `carpinteria2026` (se cambia en **Cuentas y categorías → Seguridad**).

Para desarrollo con recarga automática: `npm run dev`.

Para publicar en internet, consulta `DEPLOY.md`. Para guardar los datos fuera del servidor, define las variables opcionales `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` (Turso, gratis); sin ellas la app usa la base SQLite local.

## Pantallas

- **Panel** — saldo en cuentas, resultado del mes, ingresos, gastos, por cobrar, por pagar, retiros de los socios, gráfico de los últimos 6 meses, gastos por categoría, cuentas y últimos movimientos.
- **Movimientos** — ingresos, gastos y transferencias con filtros por entidad, tipo, estado y búsqueda. Cada movimiento acepta foto o PDF del comprobante.
- **Ventas** — servicios de carpintería (a medida) y muebles listos, con costo de material, margen y estado (presupuesto, aprobado, en producción, entregado, pagado). El botón de check registra el cobro en la cuenta de la empresa.
- **Balance** — cierre del mes: empresa, personal y consolidado, estado de resultados simplificado por grupo de categoría, retiros de los socios, total por persona y saldo en cuentas al cierre del mes. Exporta CSV e imprime.
- **Cuentas y categorías** — cuentas (caja, banco, tarjeta), categorías por grupo, nombres de los socios y nombre del negocio.
- **WhatsApp** — bandeja de entrada con mensajes, audios y fotos; cada mensaje puede convertirse en movimiento con un clic (el valor en reales se lee del texto automáticamente).

## Cómo se calcula el dinero

- Saldo de la cuenta = saldo inicial + ingresos − gastos − transferencias enviadas + transferencias recibidas.
- La transferencia entre cuentas no entra como ingreso ni gasto, así que no infla el resultado.
- El retiro de los socios es una transferencia de una cuenta de la empresa a una cuenta personal: aparece como retiro, no como gasto de la empresa.
- Consolidado = resultado de la empresa + resultado personal, sin contar las transferencias internas.

## Moneda

La moneda está en `₲` (guaraní). Para cambiarla, edita la constante `MONEDA` al inicio de `public/app.js` y los textos de los formularios que dicen «(₲)».

El sistema acepta dos monedas: guaraní (₲) y real (R$). Cada cuenta, movimiento y venta tiene su moneda. Los totales se muestran en guaraníes, convirtiendo los valores en real por la cotización configurada en **Cuentas y categorías → Identidad** (₲ por R$ 1).

## WhatsApp: cómo conectar después

La estructura ya está lista y recibe mensajes por el endpoint:

```
POST /api/whatsapp/webhook?token=TU_TOKEN
{ "remetente": "Socio", "tipo": "texto", "conteudo": "Pagué R$ 180 de flete" }
```

Campos aceptados: `remetente`, `tipo` (`texto`, `audio`, `imagem`, `documento`), `conteudo`, `media_path`, `mimetype`, `enviado_em`, `entidade`.

Pasos cuando tengas el número a mano:

1. Elige el proveedor: Meta Cloud API (oficial) o Evolution API / Z-API (más simple para un número común).
2. En la pantalla **WhatsApp**, indica el número, el proveedor y define un token.
3. Apunta el webhook del proveedor a la URL que muestra la pantalla.
4. Como la app corre local, esa URL tiene que estar expuesta en internet (un túnel o hosting) para que el proveedor la alcance.

Mientras tanto, el botón **Simular** crea mensajes de prueba para ejercitar el flujo de vinculación.

## Datos y respaldo

- Base: `data/financas.db`
- Adjuntos: `uploads/`

Para respaldar, copia esas dos carpetas. Para recrear los datos de ejemplo:

```bash
npm run seed -- --force
```

Atención: `--force` borra los movimientos, ventas y mensajes existentes.

## Estructura

```
server.js          servidor Express
src/db.js          conexión SQLite y esquema
src/seed.js        datos de ejemplo
src/api.js         rutas de la API
public/            interfaz (HTML, CSS y JS sin build)
```
