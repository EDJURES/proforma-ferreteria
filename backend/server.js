// server.js — API REST para el sistema de proformas
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

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

// Guardar una proforma completa (cabecera + detalle) en transacción
app.post('/api/proformas', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const p = req.body;
    await client.query('BEGIN');

    const cab = await client.query(
      `INSERT INTO proformas
        (numero, cliente_nombre, cliente_ruc, cliente_direccion, cliente_telefono,
         condicion_pago, validez_dias, fecha, subtotal, igv, total, moneda, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [p.numero, p.cliente_nombre, p.cliente_ruc, p.cliente_direccion, p.cliente_telefono,
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
    res.status(500).json({ error: 'Error al guardar proforma' });
  } finally {
    client.release();
  }
});

// Listar proformas emitidas (con filtros opcionales)
app.get('/api/proformas', async (req, res) => {
  try {
    const { desde, hasta, cliente } = req.query;
    const cond = [];
    const params = [];
    if (desde)  { params.push(desde);  cond.push(`fecha >= $${params.length}`); }
    if (hasta)  { params.push(hasta);  cond.push(`fecha <= $${params.length}`); }
    if (cliente){ params.push(`%${cliente}%`); cond.push(`LOWER(cliente_nombre) LIKE LOWER($${params.length})`); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT id, numero, cliente_nombre, cliente_ruc, condicion_pago,
              fecha, total, moneda, creado_en
       FROM proformas ${where}
       ORDER BY numero DESC
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
