-- ============================================================
-- Base de datos: Sistema de Proformas "Comercial Elizabeth"
-- Motor: PostgreSQL
-- ============================================================

CREATE DATABASE comercial_elizabeth;
-- \c comercial_elizabeth

-- ------------------------------------------------------------
-- Tabla: productos
-- Catálogo de productos que alimenta el campo DESCRIPCIÓN
-- ------------------------------------------------------------
CREATE TABLE productos (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(50) UNIQUE,            -- ej. STANLEY / 84-011
    descripcion     VARCHAR(255) NOT NULL,         -- nombre del producto
    marca           VARCHAR(80),                   -- STANLEY, BOSCH, etc.
    unidad          VARCHAR(20) DEFAULT 'UND',     -- UND, JGO, etc.
    precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock           INTEGER DEFAULT 0,
    activo          BOOLEAN DEFAULT TRUE,
    creado_en       TIMESTAMP DEFAULT NOW()
);

-- Índice para búsqueda rápida por descripción (autocompletar)
CREATE INDEX idx_productos_descripcion ON productos USING gin (to_tsvector('spanish', descripcion));
CREATE INDEX idx_productos_desc_like ON productos (LOWER(descripcion));

-- ------------------------------------------------------------
-- Tabla: clientes
-- ------------------------------------------------------------
CREATE TABLE clientes (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(180) NOT NULL,
    ruc_dni     VARCHAR(20),
    direccion   VARCHAR(255),
    telefono    VARCHAR(30),
    creado_en   TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Tabla: proformas (cabecera)
-- ------------------------------------------------------------
CREATE TABLE proformas (
    id              SERIAL PRIMARY KEY,
    numero          INTEGER UNIQUE NOT NULL,        -- N° de proforma (ej. 130)
    cliente_id      INTEGER REFERENCES clientes(id),
    cliente_nombre  VARCHAR(180) NOT NULL,          -- snapshot por si no hay cliente_id
    cliente_ruc     VARCHAR(20),
    cliente_direccion VARCHAR(255),
    cliente_telefono  VARCHAR(30),
    condicion_pago  VARCHAR(40) DEFAULT 'CONTADO',
    validez_dias    INTEGER DEFAULT 6,
    fecha           DATE DEFAULT CURRENT_DATE,
    subtotal        NUMERIC(12,2) DEFAULT 0,
    igv             NUMERIC(12,2) DEFAULT 0,        -- 18%
    total           NUMERIC(12,2) DEFAULT 0,
    moneda          VARCHAR(10) DEFAULT 'SOLES',
    observaciones   TEXT,
    creado_en       TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Tabla: proforma_detalle (líneas de la proforma)
-- ------------------------------------------------------------
CREATE TABLE proforma_detalle (
    id              SERIAL PRIMARY KEY,
    proforma_id     INTEGER NOT NULL REFERENCES proformas(id) ON DELETE CASCADE,
    producto_id     INTEGER REFERENCES productos(id),
    descripcion     VARCHAR(255) NOT NULL,          -- snapshot de la descripción
    cantidad        NUMERIC(12,2) NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    importe         NUMERIC(12,2) NOT NULL DEFAULT 0,
    orden           INTEGER DEFAULT 0
);

CREATE INDEX idx_detalle_proforma ON proforma_detalle (proforma_id);

-- ------------------------------------------------------------
-- Datos de ejemplo (catálogo basado en la imagen de guía)
-- ------------------------------------------------------------
INSERT INTO productos (codigo, descripcion, marca, unidad, precio_unitario) VALUES
('STANLEY/84-011',  'JUEGO ALICATE AISLADO P/ 1000V X 3 PZAS - STANLEY', 'STANLEY', 'JGO', 183.00),
('STANLEY/84-369',  'ALICATE DE PRESION DE 10" BOCA CURVA - STANLEY', 'STANLEY', 'UND', 29.50),
('STANLEY/66-052',  'DESARMADOR JUEGO X 6 PZAS P/RELOJERO M/AMARILLO - STANLEY', 'STANLEY', 'JGO', 23.00),
('STMT60-175',      'JUEGO DESARMADOR X 7 PZAS M/AISLADO 1000V STMT 60-175 STANLEY', 'STANLEY', 'JGO', 99.50),
('STANLEY/69-254',  'LLAVE ALLEN JGO X 10 PZAS 1/16"-3/8" - STANLEY', 'STANLEY', 'JGO', 30.50),
('STST515155',      'MOCHILA PORTA HERRAMIENTA STANLEY', 'STANLEY', 'UND', 134.00),
('STANLEY/87-434',  'LLAVE FRANCESA DE 12" CROMADO - STANLEY', 'STANLEY', 'UND', 54.30),
('STANLEY/10323',   'CUCHILLA CUTTER 6 1/2" C/HOJA GRANDE 18MM - STANLEY', 'STANLEY', 'UND', 4.80),
('PRETUL/27083',    'LINTERNA FRONTAL 100 LUM 27083 PRETUL', 'PRETUL', 'UND', 11.50),
('SANWA/CD-800a',   'MULTITESTER DIGITAL DCV 600V - ACV 600V 40-400HZ MOD. CD-800a SANWA', 'SANWA', 'UND', 190.00),
('STANLEY/69-257',  'LLAVE ALLEN JGO X 12 PZAS 1/16"-3/8" C/PUNTA BOLA - STANLEY', 'STANLEY', 'JGO', 62.50),
('BOSCH/GSB550',    'TALADRO PERCUTOR 550W GSB 550 BOSCH', 'BOSCH', 'UND', 159.00),
('DEWALT/DWE402',   'AMOLADORA ANGULAR 4 1/2" 1010W DWE402 DEWALT', 'DEWALT', 'UND', 245.00),
('TRUPER/14674',    'JUEGO DE DADOS 1/2" X 24 PZAS TRUPER', 'TRUPER', 'JGO', 89.00),
('MAKITA/HP1640',   'TALADRO PERCUTOR 680W HP1640 MAKITA', 'MAKITA', 'UND', 210.00);
