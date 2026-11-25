# Manual rápido — Finanzas de la Carpintería

Enlace: https://finanzas-carpinteria.onrender.com
Contraseña inicial: `carpinteria2026` (cámbiala en el primer acceso)

La primera vez que abras el sitio en el día puede tardar 30 a 50 segundos en cargar. Es normal.

---

## 1. Entrar

1. Abre el enlace.
2. Escribe la contraseña.
3. Si aparece «No se pudo cargar», pulsa **Reintentar**.

Para cambiar la contraseña: **Cuentas y categorías → Seguridad**.

---

## 2. Panel

Es la primera pantalla. Muestra el mes elegido arriba a la derecha.

| Tarjeta | Qué significa |
|---|---|
| Saldo en cuentas | Lo que hay hoy en todas las cuentas, sumado en guaraníes |
| Resultado del mes | Ingresos menos gastos del mes |
| Ingresos / Gastos | Totales del mes |
| Por cobrar | Lo que clientes todavía deben (incluye saldo de ventas) |
| Por pagar | Movimientos marcados como pendientes |
| Retiros de los socios | Transferencias de la empresa al personal |
| Resultado de la empresa | Solo la parte de la empresa |

Debajo: gráfico de los últimos 6 meses y gastos por categoría.

---

## 3. Movimientos

Aquí se registra todo lo que entra y sale.

**Nuevo movimiento** → botón **Nuevo movimiento**.

- **Ingreso / Gasto / Transferencia**: elige el tipo arriba.
- **Valor** y **Moneda**: escribe el número y elige **Guaraní (₲)** o **Real (R$)**.
- **Entidad**: Empresa (carpintería) o Personal (familia).
- **Categoría**: obligatoria para ingresos y gastos.
- **Cuenta**: de dónde sale o entra el dinero.
- **Estado**: *Pagado / cobrado* o *Pendiente* (pendiente entra en «Por pagar» o «Por cobrar»).
- **Comprobante**: puedes adjuntar foto o PDF de la factura.

Para corregir algo: icono de lápiz en la fila. Para borrar: icono de papelera.

Filtros arriba: mes, entidad, tipo, estado y búsqueda por texto. El botón **CSV** descarga la lista en Excel.

---

## 4. Ventas

**Nueva venta** → botón **Nueva venta**.

- **Tipo**: Servicio de carpintería (a medida) o Mueble listo (reventa).
- **Valor cobrado** y **Costo de material**: en la moneda que elijas (₲ o R$).
- **Reparto del negocio (%)**: cuánto de la ganancia queda en el negocio. El resto es del socio/a. Por defecto 60.
- **Estado**: Orçamento, Aprobado, En producción, Entregado, Pagado.

**Cobro parcial:** el botón ✓ en la fila abre una ventana con el saldo pendiente ya escrito. Puedes cobrar una parte (por ejemplo la mitad de adelanto) y el resto después. La venta pasa a *Pagado* solo cuando se cobra el total.

Columnas de la lista: Valor, Costo, Margen, Reparto (60/40), Cobrado, Saldo, Estado.

Cartón **Reparto de la ganancia**: muestra el margen bruto dividido entre negocio y socio/a, con el porcentaje.

---

## 5. Balance

Cierre del mes: tarjetas de Empresa, Personal y Consolidado, el estado de resultados por grupo de categoría, retiros de los socios, gastos por categoría y movimientos por persona. El botón **CSV** descarga el balance.

---

## 6. Cuentas y categorías

**Cuentas** — cada cuenta tiene nombre, tipo (Caja, Banco, Tarjeta, Inversión), entidad y **moneda**. Una cuenta en reales (por ejemplo *Caixa Brasil*) guarda sus saldos en R$ y el panel la convierte a guaraníes.

**Categorías** — se agrupan por entidad y tipo. Puedes crear, editar y borrar.

**Identidad** — aquí se ajusta lo general:

| Campo | Para qué sirve |
|---|---|
| Nombre del negocio | Aparece arriba a la izquierda |
| Reparto del negocio (%) | Porcentaje por defecto de la ganancia para el negocio |
| Cotización del real (₲ por R$ 1) | Cuántos guaraníes vale 1 real. Se usa para sumar los movimientos en real a los totales en guaraníes |

**Seguridad** — cambio de contraseña.

---

## 7. WhatsApp

Muestra los mensajes recibidos (texto, audio, foto de comprobante). Todavía está **desconectado**: para conectarlo hace falta un número de WhatsApp y un proveedor. Cuando lo tengamos, los mensajes entran solos en esta pantalla.

---

## 8. Respaldo

En **Cuentas y categorías** hay un botón para descargar un archivo JSON con todo: movimientos, ventas, cuentas, categorías y configuración. Guárdalo de vez en cuando; sirve para recuperar la información.

---

## 9. Problemas comunes

| Situación | Qué hacer |
|---|---|
| «No se pudo cargar» | Pulsar **Reintentar**. Si sigue, esperar 1 minuto y recargar |
| Tarda en abrir | Es la primera carga del día; esperar hasta 50 segundos |
| Un valor salió en la moneda equivocada | Editar el movimiento (lápiz) y cambiar **Moneda** |
| Los totales no cuadran con el real | Revisar la **Cotización del real** en Identidad |
| Olvidé la contraseña | Avisar a José para restablecerla |
