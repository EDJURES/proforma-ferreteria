# Sistema de Proformas — Comercial Elizabeth

Sistema web para generar proformas de ferretería, con catálogo de productos
en PostgreSQL, exportación a PDF y envío por WhatsApp.

## Arquitectura

```
Frontend (React)  ──►  Backend (Express)  ──►  PostgreSQL
   proforma.jsx        server.js / db.js        schema.sql
```

## 1. Base de datos (PostgreSQL)

```bash
# Crear la BD y las tablas
psql -U postgres -f schema.sql
```

Tablas creadas: `productos`, `clientes`, `proformas`, `proforma_detalle`.
El script incluye un catálogo de ejemplo basado en la proforma guía.

## 2. Backend (Node.js + Express)

```bash
cd backend
cp .env.example .env      # ajusta usuario/clave de PostgreSQL
npm install
npm start                 # API en http://localhost:4000
```

Endpoints:
- `GET  /api/productos?q=texto`        → autocompletar descripción
- `POST /api/productos`                → alta manual de producto (catálogo)
- `GET  /api/proformas/siguiente-numero`
- `POST /api/proformas`                → guarda cabecera + detalle (transacción)
- `GET  /api/proformas?desde=&hasta=&cliente=`  → historial con filtros
- `GET  /api/proformas/:id`            → detalle completo de una proforma

## 3. Frontend (React)

`proforma-elizabeth.jsx` es un componente listo para usar.

- En **Vite/CRA**: colócalo como `App.jsx`, instala React y ejecuta `npm run dev`.
- Ajusta `API_BASE` si tu backend no está en `localhost:4000`.
- jsPDF y autoTable se cargan automáticamente por CDN al exportar.

### Funciones
- **Autocompletar** el campo Descripción consultando PostgreSQL (con
  catálogo de respaldo si la API no responde).
- **Producto manual / nuevo**: botón que abre un formulario para agregar
  un producto que no está en el catálogo. Se añade a la proforma y, si se
  marca la casilla, se **guarda en la base de datos** (`POST /api/productos`)
  para reutilizarlo en futuras proformas.
- **Descargar PDF** de la proforma (jsPDF + autoTable).
- **Enviar por WhatsApp** con resumen y total; usa el teléfono del cliente
  si está cargado, o abre el selector de contactos.
- **Guardar** la proforma en la base de datos.
- **Proformas Emitidas** (pestaña superior): consulta el historial de
  proformas a la fecha, con filtros por rango de fechas y por cliente, y
  permite abrir el detalle completo de cada una.

## Nota sobre IGV
Según la proforma guía, los precios **ya incluyen IGV 18%**. El sistema
calcula la base imponible y el IGV a partir del total.
