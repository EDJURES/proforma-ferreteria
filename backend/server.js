// server.js — API REST para el sistema de proformas
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
// Ruta de diagnóstico temporal
app.get('/', (req, res) => res.json({ ok: true, mensaje: 'server.js correcto corriendo', rutas: ['/api/productos', '/api/proformas'] }));

// ---------- PRODUCTOS ----------

// Búsqueda / autocompletar de productos por descripción o código
app.get('/api/productos', async (req, res) => {
  try {
    const { q } = req.query;
    let result;
    if (q && q.trim()) {
      result = await db.query(
        `SELECT id, codigo, descripcion, marca, unidad, precio_unitario
         FROM productos
         WHERE activo = TRUE
           AND (LOWER(descripcion) LIKE LOWER($1) OR LOWER(codigo) LIKE LOWER($1))
         ORDER BY descripcion
         LIMIT 20`,
        [`%${q}%`]
      );
    } else {
      result = await db.query(
        `SELECT id, codigo, descripcion, marca, unidad, precio_unitario
         FROM productos WHERE activo = TRUE ORDER BY descripcion LIMIT 50`
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar productos' });
  }
});

// Crear un producto nuevo en el catálogo
app.post('/api/productos', async (req, res) => {
  try {
    const { codigo, descripcion, marca, unidad, precio_unitario } = req.body;
    const result = await db.query(
      `INSERT INTO productos (codigo, descripcion, marca, unidad, precio_unitario)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [codigo, descripcion, marca, unidad || 'UND', precio_unitario || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// ---------- CONSULTA RUC (SUNAT vía Decolecta.com) ----------
app.get('/api/consulta-documento/:numero', async (req, res) => {
  const numero = (req.params.numero || '').trim();
  const token = process.env.DECOLECTA_TOKEN;

  if (!token) {
    return res.status(500).json({ error: 'Falta configurar el token de consulta en el servidor.' });
  }
  if (/^\d{8}$/.test(numero)) {
    return res.status(501).json({ error: 'La consulta de DNI no está disponible. Ingresa manualmente.' });
  }
  if (!/^\d{11}$/.test(numero)) {
    return res.status(400).json({ error: 'Ingresa un RUC válido (11 dígitos).' });
  }

  try {
    const resp = await fetch(`https://api.decolecta.com/v1/sunat/ruc?numero=${numero}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (resp.status === 404) return res.status(404).json({ error: 'No se encontró información para el RUC.' });
    if (resp.status === 401 || resp.status === 403) return res.status(502).json({ error: 'Token de consulta inválido o expirado.' });
    if (resp.status === 429) return res.status(429).json({ error: 'Se alcanzó límite de consultas 100, ingresa manualmente' });
    if (!resp.ok) return res.status(502).json({ error: 'Revisa el numero de RUC válido.' });

    const data = await resp.json();
    console.log('Respuesta Decolecta:', data); // temporal, para verificar campos reales

    res.json({
      tipo: 'RUC',
      numero,
      nombre: data.razon_social || data.nombre || '',
      direccion: data.direccion || '',
      estado: data.estado || '',
      condicion: data.condicion || '',
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'No se pudo conectar con el servicio de consulta.' });
  }
});

// ---------- CLIENTES ----------

// Buscar cliente exacto por RUC/DNI (caché local antes de llamar la API externa)
app.get('/api/clientes/ruc/:numero', async (req, res) => {
  try {
    const numero = (req.params.numero || '').trim();
    const result = await db.query(
      'SELECT nombre, ruc_dni, direccion, telefono FROM clientes WHERE ruc_dni = $1 LIMIT 1',
      [numero]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No encontrado en la base de datos local' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar cliente: ' + err.message });
  }
});

// Autocompletar clientes por nombre
app.get('/api/clientes/buscar', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) return res.json([]);
    const result = await db.query(
      `SELECT id, nombre, ruc_dni, direccion, telefono
       FROM clientes
       WHERE LOWER(nombre) LIKE LOWER($1)
       ORDER BY nombre
       LIMIT 10`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar clientes: ' + err.message });
  }
});



// ---------- PROFORMAS ----------

// Siguiente número de proforma
app.get('/api/proformas/siguiente-numero', async (req, res) => {
  try {
    const result = await db.query('SELECT COALESCE(MAX(numero),129)+1 AS siguiente FROM proformas');
    res.json({ numero: result.rows[0].siguiente });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// Guardar una proforma completa (cabecera + detalle) en transacción + insert/update Cliente
app.post('/api/proformas', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const p = req.body;
    await client.query('BEGIN');

    // Buscar o crear el cliente en el directorio, solo si trae RUC/DNI
    let clienteId = null;
    const ruc = (p.cliente_ruc || '').trim();
    if (ruc) {
      const existente = await client.query('SELECT id FROM clientes WHERE ruc_dni = $1', [ruc]);
      if (existente.rows.length > 0) {
        clienteId = existente.rows[0].id;
        await client.query(
          `UPDATE clientes SET nombre = $1, direccion = $2, telefono = $3 WHERE id = $4`,
          [p.cliente_nombre, p.cliente_direccion, p.cliente_telefono, clienteId]
        );
      } else {
        const nuevo = await client.query(
          `INSERT INTO clientes (nombre, ruc_dni, direccion, telefono)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [p.cliente_nombre, ruc, p.cliente_direccion, p.cliente_telefono]
        );
        clienteId = nuevo.rows[0].id;
      }
    }

    const cab = await client.query(
      `INSERT INTO proformas
        (numero, cliente_id, cliente_nombre, cliente_ruc, cliente_direccion, cliente_telefono,
         condicion_pago, validez_dias, fecha, subtotal, igv, total, moneda, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [p.numero, clienteId, p.cliente_nombre, p.cliente_ruc, p.cliente_direccion, p.cliente_telefono,
       p.condicion_pago || 'CONTADO', p.validez_dias || 6, p.fecha || new Date(),
       p.subtotal, p.igv, p.total, p.moneda || 'SOLES', p.observaciones]
    );
    const proformaId = cab.rows[0].id;

    for (let i = 0; i < p.items.length; i++) {
      const it = p.items[i];
      await client.query(
        `INSERT INTO proforma_detalle
          (proforma_id, producto_id, descripcion, cantidad, precio_unitario, importe, orden)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [proformaId, it.producto_id || null, it.descripcion, it.cantidad,
         it.precio_unitario, it.importe, i]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: proformaId, numero: p.numero });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al guardar proforma: ' + err.message });
  } finally {
    client.release();
  }
});

// Listar proformas emitidas (con filtros opcionales)
app.get('/api/proformas', async (req, res) => {
  try {
    const { desde, hasta, cliente, producto } = req.query;
    const cond = [];
    const params = [];
    let join = '';

    if (producto) {
      join = 'INNER JOIN proforma_detalle pd ON pd.proforma_id = p.id';
      params.push(`%${producto}%`);
      cond.push(`LOWER(pd.descripcion) LIKE LOWER($${params.length})`);
    }
    if (desde)   { params.push(desde);  cond.push(`p.fecha >= $${params.length}`); }
    if (hasta)   { params.push(hasta);  cond.push(`p.fecha <= $${params.length}`); }
    if (cliente) { params.push(`%${cliente}%`); cond.push(`LOWER(p.cliente_nombre) LIKE LOWER($${params.length})`); }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT DISTINCT p.id, p.numero, p.cliente_nombre, p.cliente_ruc, p.condicion_pago,
              p.fecha, p.total, p.moneda, p.creado_en
       FROM proformas p ${join} ${where}
       ORDER BY p.numero DESC
       LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar proformas' });
  }
});

// Detalle completo de una proforma (cabecera + líneas)
app.get('/api/proformas/:id', async (req, res) => {
  try {
    const cab = await db.query('SELECT * FROM proformas WHERE id = $1', [req.params.id]);
    if (cab.rows.length === 0) return res.status(404).json({ error: 'No encontrada' });
    const det = await db.query(
      `SELECT descripcion, cantidad, precio_unitario, importe
       FROM proforma_detalle WHERE proforma_id = $1 ORDER BY orden`,
      [req.params.id]
    );
    res.json({ ...cab.rows[0], items: det.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar proforma' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
