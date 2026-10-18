import React, { useState, useEffect, useRef } from "react";

// ============================================================
//  Comercial Elizabeth — Sistema de Proformas
// ============================================================
//  - Catálogo de productos en PostgreSQL (autocompletar).
//  - Alta MANUAL de productos: se agrega a la proforma y,
//    opcionalmente, se guarda en la base de datos (catálogo).
//  - Historial: consulta de proformas emitidas a la fecha,
//    con filtros y vista de detalle.
//  - Exporta a PDF (jsPDF + autoTable por CDN) y envía a WhatsApp.
// ============================================================

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:4000") + "/api";
const IGV_RATE = 0.18;

const CATALOGO_DEMO = [
  { id: 1, codigo: "STANLEY/84-011", descripcion: "JUEGO ALICATE AISLADO P/ 1000V X 3 PZAS - STANLEY", precio_unitario: 183.0 },
  { id: 2, codigo: "STANLEY/84-369", descripcion: "ALICATE DE PRESION DE 10\" BOCA CURVA - STANLEY", precio_unitario: 29.5 },
  { id: 3, codigo: "STANLEY/66-052", descripcion: "DESARMADOR JUEGO X 6 PZAS P/RELOJERO M/AMARILLO - STANLEY", precio_unitario: 23.0 },
  { id: 4, codigo: "STMT60-175", descripcion: "JUEGO DESARMADOR X 7 PZAS M/AISLADO 1000V STMT 60-175 STANLEY", precio_unitario: 99.5 },
  { id: 5, codigo: "STANLEY/69-254", descripcion: "LLAVE ALLEN JGO X 10 PZAS 1/16\"-3/8\" - STANLEY", precio_unitario: 30.5 },
  { id: 6, codigo: "STST515155", descripcion: "MOCHILA PORTA HERRAMIENTA STANLEY", precio_unitario: 134.0 },
  { id: 7, codigo: "STANLEY/87-434", descripcion: "LLAVE FRANCESA DE 12\" CROMADO - STANLEY", precio_unitario: 54.3 },
  { id: 8, codigo: "STANLEY/10323", descripcion: "CUCHILLA CUTTER 6 1/2\" C/HOJA GRANDE 18MM - STANLEY", precio_unitario: 4.8 },
  { id: 9, codigo: "PRETUL/27083", descripcion: "LINTERNA FRONTAL 100 LUM 27083 PRETUL", precio_unitario: 11.5 },
  { id: 10, codigo: "SANWA/CD-800a", descripcion: "MULTITESTER DIGITAL DCV 600V - ACV 600V 40-400HZ MOD. CD-800a SANWA", precio_unitario: 190.0 },
  { id: 11, codigo: "STANLEY/69-257", descripcion: "LLAVE ALLEN JGO X 12 PZAS 1/16\"-3/8\" C/PUNTA BOLA - STANLEY", precio_unitario: 62.5 },
  { id: 12, codigo: "BOSCH/GSB550", descripcion: "TALADRO PERCUTOR 550W GSB 550 BOSCH", precio_unitario: 159.0 },
  { id: 13, codigo: "DEWALT/DWE402", descripcion: "AMOLADORA ANGULAR 4 1/2\" 1010W DWE402 DEWALT", precio_unitario: 245.0 },
];

const peso = (n) =>
  "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

//SE AGREGA UNA MEJORA, AÑADIENDO BOTON "PDF" PARA DESCARGAR DOCUMENTO PDF - 30/07/2026

// Genera el PDF de una proforma a partir de sus datos.
// data = { numero, fecha, cliente_nombre, cliente_ruc, cliente_direccion,
//          condicion_pago, validez_dias, items: [{descripcion,cantidad,precio_unitario}] }
async function generarPDFProforma(data) {
	  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
	  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
	  const { jsPDF } = window.jspdf;
	  const doc = new jsPDF();

	  const subtotal = data.items.reduce(
		(s, it) => s + Number(it.cantidad || 0) * Number(it.precio_unitario || 0), 0
	  );
	  const total = subtotal;
	  const baseImponible = total / (1 + IGV_RATE);
	  const igv = total - baseImponible;

	  doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.setTextColor(178, 34, 34);
	  doc.text("COMERCIAL ELIZABETH", 14, 18);
	  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60);
	  doc.text("VENTA DE ARTÍCULOS DE FERRETERIA EN GENERAL, ACCESORIOS PARA BAÑOS", 14, 24);
	  doc.text("GRIFERÍAS, FLUXOMETROS DE LAS MARCAS SLOAN, HELVEX, CONEXIONES PARA", 14, 27.5);
	  doc.text("AGUA Y DESAGUE PVC/CPVC, REPUESTOS NACIONALES E IMPORTADOS", 14, 31);
	  doc.text("Jr. Lino Cornejo N°242 Stand 115, Lima", 14, 36);
	  doc.text("Email: elenaespirilla.2505@gmail.com · Celular/YAPE: 955 546 747", 14, 39);

	  
	// ---------- Recuadro superior derecho: RUC / PROFORMA / N° ----------
	const RUC_EMPRESA = "10105765229";
	const MARGEN_DER = 14;                                   // igual al margen derecho de tu tabla
	const pageW = doc.internal.pageSize.getWidth();
	const bw = 50, rowH = 8.5, by = 11;                      // ancho, alto por fila, posición vertical
	const bx = pageW - MARGEN_DER - bw;                     // borde derecho alineado con la tabla
	const cx = bx + bw / 2;                                 // centro horizontal del recuadro

	// 1) Franja gris de la fila del medio (se pinta primero, queda debajo del marco)
	doc.setFillColor(238, 238, 238);
	doc.rect(bx, by + rowH, bw, rowH, "F");

	// 2) Marco con el mismo color y grosor de línea que la tabla de productos
	doc.setDrawColor(200, 200, 200);
	doc.setLineWidth(0.1);
	doc.rect(bx, by, bw, rowH * 3);

	// 3) Textos centrados
	doc.setTextColor(0, 0, 0);
	doc.setFont("helvetica", "normal");
	doc.setFontSize(11);
	doc.text(`RUC ${RUC_EMPRESA}`, cx, by + 5.9, { align: "center" });

	doc.setFont("helvetica", "bold");
	doc.setFontSize(13);
	doc.text("PROFORMA", cx, by + rowH + 6, { align: "center" });

	doc.setFont("helvetica", "normal");
	doc.setFontSize(11);
	doc.text(`N°: ${data.numero}`, cx, by + rowH * 2 + 5.9, { align: "center" });


	  let y = 45; doc.setFontSize(9);
	  doc.text(`Cliente: ${data.cliente_nombre || "-"}`, 14, y);
	  doc.text(`RUC/DNI: ${data.cliente_ruc || "-"}`, 120, y); y += 5;
	  doc.text(`Dirección: ${data.cliente_direccion || "-"}`, 14, y);
	  doc.text(`Fecha: ${String(data.fecha).slice(0, 10)}`, 120, y); y += 5; 
		if (data.solicitante) {
		  doc.setFont("helvetica", "bold");
		  doc.text(`Solicitante: ${data.solicitante}`, 14, y);
		  doc.setFont("helvetica", "normal");  // restaura la fuente normal para lo que sigue
		  y += 5;
		}
	  doc.text(`Condición: ${data.condicion_pago || "-"}`, 14, y);
	  doc.text(`Validez: ${data.validez_dias || "-"} días`, 120, y);

	  const body = data.items.map((it) => [
		it.cantidad, it.descripcion, peso(it.precio_unitario),
		peso(Number(it.cantidad) * Number(it.precio_unitario)),
	  ]);

	  doc.autoTable({
		startY: y + 6,
		head: [["CANT.", "DESCRIPCIÓN", "P. UNIT.", "IMPORTE"]],
		body, theme: "grid",
		headStyles: { fillColor: [27, 94, 32], textColor: 255, fontSize: 8 },
		bodyStyles: { fontSize: 8 },
		columnStyles: { 0: { cellWidth: 16, halign: "center" }, 2: { cellWidth: 28, halign: "right" }, 3: { cellWidth: 28, halign: "right" } },
	  });

	  let fy = doc.lastAutoTable.finalY + 8; doc.setFontSize(9);
	  doc.text(`Base imponible:`, 130, fy); doc.text(peso(baseImponible), 196, fy, { align: "right" }); fy += 5;
	  doc.text(`IGV (18%):`, 130, fy); doc.text(peso(igv), 196, fy, { align: "right" }); fy += 6;
	  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
	  doc.text(`TOTAL:`, 130, fy); doc.text(peso(total), 196, fy, { align: "right" });
	  fy += 12; doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(90);
	  doc.text("CTA. BCP: 191-37674850-0-02 / INTERBANCARIO: 002-191137674850002-55", 14, fy);

	  let fp = doc.lastAutoTable.finalY + 8; doc.setFontSize(9);
	  doc.text(`Base imponible:`, 130, fp); doc.text(peso(baseImponible), 196, fp, { align: "right" }); fp += 5;
	  doc.text(`IGV (18%):`, 130, fp); doc.text(peso(igv), 196, fp, { align: "right" }); fp += 6;
	  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
	  doc.text(`TOTAL:`, 130, fp); doc.text(peso(total), 196, fp, { align: "right" });
	  fp += 12; doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(90);
	  doc.text("Precios incluido IGV 18% en soles.  —  Gracias por su confianza.", 14, fp + 5);

	  doc.save(`Proforma-${data.numero}.pdf`);
	  
}
//FIN MEJORA BOTON PDF PARA DESCARGAR DOCUMENTO - 30/07/2026

const IconMail = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ verticalAlign: "-2px", marginRight: 4 }}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

const IconDashboard = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const IconDoc = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h6" />
  </svg>
);

const IconPhone = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ verticalAlign: "-2px", marginRight: 4 }}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l2 5v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
);

const IconPlus = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={{ verticalAlign: "-2px", marginRight: 5 }}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconList = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ verticalAlign: "-2px", marginRight: 5 }}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

export default function App() {
  const [seccion, setSeccion] = useState("dashboard");   // "dashboard" | "proforma"
  const [vista, setVista] = useState("nueva");           // "nueva" | "historial"
  const [resetKey, setResetKey] = useState(0);
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const irANueva = () => { setSeccion("proforma"); setVista("nueva"); setResetKey((k) => k + 1); };
  const irAHistorial = () => { setSeccion("proforma"); setVista("historial"); };

  return (
    <div style={S.shell} className="shell">
      <style>{CSS}</style>

      <aside style={S.sidebar} className="sidebar">
        <div style={S.sideBrand} className="sideBrand">
          <div style={S.sideLogo}>CE</div>
          <div style={{ fontSize: 12, lineHeight: 1.3, color: "#cfe5d1" }}>Comercial<br />Elizabeth</div>
        </div>
        <button className={"sideBtn " + (seccion === "dashboard" ? "sideOn" : "")} onClick={() => setSeccion("dashboard")}>
          <IconDashboard /> Dashboard
        </button>
        <button className={"sideBtn " + (seccion === "proforma" ? "sideOn" : "")} onClick={() => setSeccion("proforma")}>
          <IconDoc /> Proforma
        </button>
      </aside>

      <div style={S.content}>
        {/* Dashboard: se monta al entrar, así siempre trae datos frescos */}
        {seccion === "dashboard" && (
          <div style={S.page}>
            <Dashboard onNueva={irANueva} onHistorial={irAHistorial} />
          </div>
        )}

        {/* Proforma: queda montada y solo se oculta, para no perder lo que se esté escribiendo */}
        <div style={{ display: seccion === "proforma" ? "block" : "none" }}>
          <div style={S.page}>
            <header style={S.header}>
              <div>
                <h1 style={S.logo}>COMERCIAL ELIZABETH</h1>
                <p style={S.sub}>Ferretería y Herramientas · Jr. Lino Cornejo N°242 Stand 115, Lima</p>
                <p style={S.sub}>
                  <IconMail size={13} /> elenaespirilla.2505@gmail.com
                  &nbsp;·&nbsp;
                  <IconPhone size={13} /> Celular: 955 546 747
                </p>
              </div>
              <nav style={S.nav}>
                <button
                  className={"navBtn " + (vista === "nueva" ? "navOn" : "")}
                  onClick={() => { setVista("nueva"); setResetKey((k) => k + 1); }}
                >
                  <IconPlus size={15} /> Nueva Proforma
                </button>
                <button
                  className={"navBtn " + (vista === "historial" ? "navOn" : "")}
                  onClick={() => setVista("historial")}
                >
                  <IconList size={15} /> Proformas Emitidas
                </button>
              </nav>
            </header>

            {vista === "nueva" ? (
              <NuevaProforma key={resetKey} showToast={showToast} />
            ) : (
              <Historial showToast={showToast} />
            )}
          </div>
        </div>
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}

// ============================================================
//  VISTA: NUEVA PROFORMA
// ============================================================
function NuevaProforma({ showToast }) {
  const [cliente, setCliente] = useState({ nombre: "", ruc: "", direccion: "", telefono: "", solicitante: "" });
  const [meta, setMeta] = useState({
    numero: 130,
    fecha: new Date().toISOString().slice(0, 10),
    condicion: "CONTADO",
    validez: 6,
  });
  const [items, setItems] = useState([
    { uid: 1, producto_id: null, descripcion: "", cantidad: 1, precio_unitario: 0 },
  ]);
  const [modalNuevo, setModalNuevo] = useState(false);
  const uidRef = useRef(2);

  useEffect(() => {
    fetch(`${API_BASE}/proformas/siguiente-numero`)
      .then((r) => r.json())
      .then((d) => d?.numero && setMeta((m) => ({ ...m, numero: d.numero })))
      .catch(() => {});
  }, []);

  const subtotal = items.reduce(
    (s, it) => s + Number(it.cantidad || 0) * Number(it.precio_unitario || 0),
    0
  );
  const total = subtotal;
  const baseImponible = total / (1 + IGV_RATE);
  const igv = total - baseImponible;

  const addItem = () =>
    setItems((arr) => [
      ...arr,
      { uid: uidRef.current++, producto_id: null, descripcion: "", cantidad: 1, precio_unitario: 0 },
    ]);
  const removeItem = (uid) => setItems((arr) => arr.filter((i) => i.uid !== uid));
  const updateItem = (uid, patch) =>
    setItems((arr) => arr.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));

  // Recibe producto desde el modal de alta manual y lo añade a la proforma
  const agregarProductoNuevo = (prod) => {
    setItems((arr) => {
      // si la última fila está vacía, la reemplaza; si no, agrega
      const ultima = arr[arr.length - 1];
      const fila = {
        uid: uidRef.current++,
        producto_id: prod.id || null,
        descripcion: prod.descripcion,
        cantidad: prod.cantidad || 1,
        precio_unitario: prod.precio_unitario || 0,
      };
      if (ultima && !ultima.descripcion) return [...arr.slice(0, -1), fila];
      return [...arr, fila];
    });
  };

const exportarPDF = async () => {
  try {
    await generarPDFProforma({
      numero: meta.numero,
      fecha: meta.fecha,
      cliente_nombre: cliente.nombre,
      cliente_ruc: cliente.ruc,
      cliente_direccion: cliente.direccion,
	  solicitante: cliente.solicitante,
      condicion_pago: meta.condicion,
      validez_dias: meta.validez,
      items: items.filter((it) => it.descripcion),
    });
    showToast("PDF generado ✓");
  } catch (e) {
    console.error(e);
    showToast("No se pudo generar el PDF");
  }
};

  const enviarWhatsApp = () => {
    const lineas = items.filter((it) => it.descripcion).map(
      (it, i) => `${i + 1}. ${it.descripcion}\n   ${it.cantidad} x ${peso(it.precio_unitario)} = ${peso(Number(it.cantidad) * Number(it.precio_unitario))}`
    ).join("\n");
    const texto =
      `*COMERCIAL ELIZABETH*\nProforma N° ${meta.numero}  |  ${meta.fecha}\n` +
      `Cliente: ${cliente.nombre || "-"}\nCondición: ${meta.condicion}  |  Validez: ${meta.validez} días\n` +
      `------------------------------\n${lineas}\n------------------------------\n` +
      `*TOTAL: ${peso(total)}* (IGV incl.)\n\nGracias por su confianza.`;
    const tel = (cliente.telefono || "").replace(/\D/g, "");
    const url = tel ? `https://wa.me/51${tel}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
    showToast("Abriendo WhatsApp…");
  };

  const guardar = async () => {
	const payload = {
	  numero: meta.numero, cliente_nombre: cliente.nombre, cliente_ruc: cliente.ruc,
	  cliente_direccion: cliente.direccion, cliente_telefono: cliente.telefono,
	  solicitante: cliente.solicitante,
	  condicion_pago: meta.condicion, validez_dias: Number(meta.validez), fecha: meta.fecha,
	  subtotal: baseImponible, igv, total, moneda: "SOLES",
	  items: items.filter((it) => it.descripcion).map((it) => ({
		producto_id: it.producto_id, descripcion: it.descripcion,
		cantidad: Number(it.cantidad), precio_unitario: Number(it.precio_unitario),
		importe: Number(it.cantidad) * Number(it.precio_unitario),
	  })),
	};
    if (!payload.cliente_nombre) { showToast("Ingresa el nombre del cliente"); return; }
    if (payload.items.length === 0) { showToast("Agrega al menos un producto"); return; }
    try {
      const r = await fetch(`${API_BASE}/proformas`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      showToast(`Proforma N° ${meta.numero} guardada ✓`);
    } catch { showToast("No se pudo conectar al backend"); }
  };
  
  
//Autocompletar/sugerir nombre de cliente 
const [sugCliente, setSugCliente] = useState([]);
const [openCliente, setOpenCliente] = useState(false);
const clienteBoxRef = useRef(null);

const buscarClientePorNombre = async (texto) => {
  setCliente((c) => ({ ...c, nombre: texto.toUpperCase() }));
  if (!texto || texto.length < 2) { setSugCliente([]); setOpenCliente(false); return; }
  try {
    const r = await fetch(`${API_BASE}/clientes/buscar?q=${encodeURIComponent(texto)}`);
    if (!r.ok) throw new Error();
    setSugCliente(await r.json());
  } catch {
    setSugCliente([]);
  }
  setOpenCliente(true);
};

const elegirCliente = (c) => {
  setCliente((prev) => ({
    nombre: (c.nombre || "").toUpperCase(),
    ruc: c.ruc_dni || "",
    direccion: (c.direccion || "").toUpperCase(),
    telefono: c.telefono || "",
    solicitante: prev.solicitante || "",
  }));
  setOpenCliente(false);
};

useEffect(() => {
  const h = (e) => clienteBoxRef.current && !clienteBoxRef.current.contains(e.target) && setOpenCliente(false);
  document.addEventListener("mousedown", h);
  return () => document.removeEventListener("mousedown", h);
}, []);

//Fin - Autocompletar/sugerir nombre de cliente  
  
const buscarDocumento = async (numero) => {
  const limpio = (numero || "").trim();
  if (!limpio) return;

  const esDni = /^\d{8}$/.test(limpio);
  const esRuc = /^\d{11}$/.test(limpio);
  if (!esDni && !esRuc) return;

  // 1) Primero busca en tu propia base de datos (Neon), sin gastar cuota externa
  try {
    const rLocal = await fetch(`${API_BASE}/clientes/ruc/${limpio}`);
    if (rLocal.ok) {
      const c = await rLocal.json();
      setCliente((prev) => ({
        ...prev,
        nombre: (c.nombre || prev.nombre).toUpperCase(),
        direccion: (c.direccion || prev.direccion).toUpperCase(),
        telefono: c.telefono || prev.telefono,
      }));
      showToast("Cliente encontrado ya registrado ✓");
      return;
    }
  } catch {
    // si la consulta local falla, seguimos igual con la API externa
  }

  if (esDni) {
    showToast("Para DNI ingresa los datos manualmente.");
    return;
  }

  // 2) No estaba guardado localmente: consulta la API externa de RUC
  try {
    const r = await fetch(`${API_BASE}/consulta-documento/${limpio}`);
    const data = await r.json();
    if (!r.ok) {
      showToast(data.error || "Error no se pudo consultar el documento");
      return;
    }
    setCliente((c) => ({
      ...c,
      nombre: (data.nombre || c.nombre).toUpperCase(),
      direccion: (data.direccion || c.direccion).toUpperCase(),
    }));
    showToast("RUC encontrado ✓");
  } catch {
    showToast("Esta fallando el servicio de consulta");
  }
};

  return (
    <main style={S.card}>
		<section style={S.gridTop}>
		  <div style={{ width: 110 }}>
			<Field label="N° Proforma">
			  <input className="inp" type="number" value={meta.numero} onChange={(e) => setMeta({ ...meta, numero: e.target.value })} />
			</Field>
		  </div>
		  <div style={{ width: 160 }}>
			<Field label="Fecha">
			  <input className="inp" type="date" value={meta.fecha} onChange={(e) => setMeta({ ...meta, fecha: e.target.value })} />
			</Field>
		  </div>
		  <div style={{ width: 150 }}>
			<Field label="Condición de pago">
			  <select className="inp" value={meta.condicion} onChange={(e) => setMeta({ ...meta, condicion: e.target.value })}>
				<option>CONTADO</option><option>CRÉDITO</option><option>TRANSFERENCIA</option>
			  </select>
			</Field>
		  </div>
		  <div style={{ width: 100 }}>
			<Field label="Validez (días)">
			  <input className="inp" type="number" value={meta.validez} onChange={(e) => setMeta({ ...meta, validez: e.target.value })} />
			</Field>
		  </div>
		  <div style={{ flex: 1, minWidth: 140 }}>
			<Field label="Teléfono (WhatsApp)">
			  <input className="inp" value={cliente.telefono} placeholder="9XXXXXXXX" onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} />
			</Field>
		  </div>
		</section>
		<section style={S.gridCli}>
		  <div style={{ position: "relative" }} ref={clienteBoxRef}>
			<Field label="Nombre / Razón social">
			  <input
				className="inp"
				value={cliente.nombre}
				placeholder="Ej. ESPIRILLA FOLLANE ELEUTERIA"
				onChange={(e) => buscarClientePorNombre(e.target.value)}
				onFocus={() => cliente.nombre && buscarClientePorNombre(cliente.nombre)}
			  />
			</Field>
			{openCliente && sugCliente.length > 0 && (
			  <div style={S.dropdown}>
				{sugCliente.map((c) => (
				  <div key={c.id} style={S.option} onMouseDown={() => elegirCliente(c)}>
					<span style={{ fontWeight: 600 }}>{c.nombre}</span>
					<span style={S.optMeta}>{c.ruc_dni || "sin RUC"}{c.direccion ? " · " + c.direccion : ""}</span>
				  </div>
				))}
			  </div>
			)}
		  </div>
		  <Field label="Solicitante">
			<input
			  className="inp"
			  value={cliente.solicitante}
			  placeholder="Nombre de contacto"
			  onChange={(e) => setCliente({ ...cliente, solicitante: e.target.value.toUpperCase() })}
			/>
		  </Field>
		  <Field label="RUC / DNI">
			<input
			  className="inp"
			  value={cliente.ruc}
			  maxLength={11}
			  inputMode="numeric"
			  onChange={(e) => {
				const soloNumeros = e.target.value.replace(/\D/g, "").slice(0, 11);
				setCliente({ ...cliente, ruc: soloNumeros });
			  }}
			  onKeyDown={(e) => { if (e.key === "Tab") buscarDocumento(cliente.ruc); }}
			  onBlur={() => buscarDocumento(cliente.ruc)}
			/>
		  </Field>
		  <Field label="Dirección">
			<input
			  className="inp"
			  value={cliente.direccion}
			  onChange={(e) => setCliente({ ...cliente, direccion: e.target.value.toUpperCase() })}
			/>
		  </Field>
		</section>

      <div style={S.tableWrap}>
        <div style={S.thead}>
          <div style={{ width: 70 }}>Cant.</div>
          <div style={{ flex: 1 }}>Descripción del producto</div>
          <div style={{ width: 110 }}>P. Unit.</div>
          <div style={{ width: 110 }}>Importe</div>
          <div style={{ width: 40 }} />
        </div>

        {items.map((it) => (
          <ItemRow key={it.uid} item={it} onChange={(patch) => updateItem(it.uid, patch)} onRemove={() => removeItem(it.uid)} />
        ))}

        <div style={S.addRow}>
          <button className="btnAdd" onClick={addItem}>+ Agregar línea</button>
          <button className="btnManual" onClick={() => setModalNuevo(true)}>✚ Producto manual / nuevo</button>
        </div>
      </div>

      <section style={S.totals}>
        <Row k="Base imponible" v={peso(baseImponible)} />
        <Row k="IGV (18%)" v={peso(igv)} />
        <Row k="TOTAL" v={peso(total)} big />
        <p style={S.nota}>Precios incluido IGV 18% en soles.</p>
      </section>

      <section style={S.actions}>
        <button className="btn btnPdf" onClick={exportarPDF}>📄 Descargar PDF</button>
        <button className="btn btnWa" onClick={enviarWhatsApp}>💬 Enviar por WhatsApp</button>
        <button className="btn btnSave" onClick={guardar}>💾 Guardar</button>
      </section>

      {modalNuevo && (
        <ModalProductoNuevo
          onClose={() => setModalNuevo(false)}
          onAgregar={agregarProductoNuevo}
          showToast={showToast}
        />
      )}
    </main>
  );
}

// ============================================================
//  MODAL: Alta manual / nuevo producto
// ============================================================
function ModalProductoNuevo({ onClose, onAgregar, showToast }) {
  const [form, setForm] = useState({
    codigo: "", descripcion: "", marca: "", unidad: "UND",
    precio_unitario: "", cantidad: 1,
  });
  const [guardarCatalogo, setGuardarCatalogo] = useState(true);
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const confirmar = async () => {
    if (!form.descripcion.trim()) { showToast("La descripción es obligatoria"); return; }
    let producto = {
      descripcion: form.descripcion.trim(),
      precio_unitario: Number(form.precio_unitario) || 0,
      cantidad: Number(form.cantidad) || 1,
      id: null,
    };

    if (guardarCatalogo) {
      setBusy(true);
      try {
        const r = await fetch(`${API_BASE}/productos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codigo: form.codigo.trim() || null,
            descripcion: form.descripcion.trim(),
            marca: form.marca.trim() || null,
            unidad: form.unidad,
            precio_unitario: Number(form.precio_unitario) || 0,
          }),
        });
        if (!r.ok) throw new Error();
        const creado = await r.json();
        producto.id = creado.id;
        showToast("Producto guardado en el catálogo ✓");
      } catch {
        showToast("Agregado a la proforma (no se guardó en BD)");
      } finally {
        setBusy(false);
      }
    }

    onAgregar(producto);
    onClose();
  };

  return (
    <div style={S.overlay} onMouseDown={onClose}>
      <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Agregar producto manualmente</h3>
          <button className="btnDel" onClick={onClose}>✕</button>
        </div>

        <div style={S.modalBody}>
          <Field label="Descripción del producto *">
            <input className="inp" autoFocus value={form.descripcion}
              placeholder="Ej. JUEGO DE LLAVES MIXTAS 8 PZAS"
              onChange={(e) => set("descripcion", e.target.value)} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Código (opcional)">
              <input className="inp" value={form.codigo} onChange={(e) => set("codigo", e.target.value)} />
            </Field>
            <Field label="Marca (opcional)">
              <input className="inp" value={form.marca} onChange={(e) => set("marca", e.target.value)} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Unidad">
              <select className="inp" value={form.unidad} onChange={(e) => set("unidad", e.target.value)}>
                <option>UND</option><option>JGO</option><option>CJA</option><option>MTR</option><option>KIT</option>
              </select>
            </Field>
            <Field label="Precio unit. (S/)">
              <input className="inp" type="number" step="0.01" value={form.precio_unitario}
                onChange={(e) => set("precio_unitario", e.target.value)} />
            </Field>
            <Field label="Cantidad">
              <input className="inp" type="number" min="1" value={form.cantidad}
                onChange={(e) => set("cantidad", e.target.value)} />
            </Field>
          </div>

          <label style={S.check}>
            <input type="checkbox" checked={guardarCatalogo} onChange={(e) => setGuardarCatalogo(e.target.checked)} />
            <span>Guardar este producto en el catálogo (base de datos) para reutilizarlo</span>
          </label>
        </div>

        <div style={S.modalFoot}>
          <button className="btn btnGhost" onClick={onClose}>Cancelar</button>
          <button className="btn btnSave" disabled={busy} onClick={confirmar}>
            {busy ? "Guardando…" : "Agregar a la proforma"}
          </button>
        </div>
      </div>
    </div>
  );
}

// SE AGREGA PANEL DASHBOARD COMO PANTALLA PRINCIPAL
// ============================================================
//  DASHBOARD
// ============================================================
const num = (n) => Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function BarrasMes({ datos }) {
  const max = Math.max(...datos.map((d) => Number(d.monto)), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 190 }}>
      {datos.map((d, i) => {
        const monto = Number(d.monto);
        const alto = monto > 0 ? Math.max((monto / max) * 130, 6) : 2;
        const actual = i === datos.length - 1;
        return (
          <div key={d.mes} title={`${d.cantidad} proformas`}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: actual ? 700 : 500, color: "#555" }}>
              {monto > 0 ? num(monto) : ""}
            </span>
            <div style={{ width: "100%", maxWidth: 46, height: alto, background: actual ? "#1b5e20" : "#9cc3a0", borderRadius: "6px 6px 0 0" }} />
            <span style={{ fontSize: 12, color: actual ? "#2a2a28" : "#777", fontWeight: actual ? 700 : 400 }}>
              {MESES[Number(d.mes.split("-")[1]) - 1]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const Kpi = ({ label, value, sub, subColor }) => (
  <div style={D.kpi}>
    <div style={D.kpiLabel}>{label}</div>
    <div style={D.kpiValue}>{value}</div>
    <div style={{ ...D.kpiSub, color: subColor || "#8a857a" }}>{sub}</div>
  </div>
);

function Dashboard({ onNueva, onHistorial }) {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = async () => {
    setCargando(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/dashboard/resumen`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Error ${r.status}`);
      }
      setData(await r.json());
    } catch (e) {
      setError("No se pudo cargar el resumen. " + e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const k = data?.kpis;
  const dif = k ? k.proformas_mes - k.proformas_mes_anterior : 0;
  const promedio = k && k.total_proformas > 0 ? Number(k.monto_total) / k.total_proformas : 0;
  const subMes = dif > 0 ? `▲ ${dif} más que el mes anterior`
               : dif < 0 ? `▼ ${-dif} menos que el mes anterior`
               : "Igual que el mes anterior";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={D.head}>
        <div>
          <h2 style={{ ...S.h2, margin: 0 }}>Dashboard</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b6b66" }}>Resumen de las proformas emitidas</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="navBtn" onClick={cargar}>↻ Actualizar</button>
          <button className="navBtn navOn" onClick={onNueva}><IconPlus size={15} /> Nueva proforma</button>
        </div>
      </div>

      {error && <div style={S.aviso}>{error}</div>}
      {cargando && !data && <div style={S.vacio}>Cargando resumen…</div>}

      {data && (
        <>
          <section style={D.kpis} className="dashKpis">
            <Kpi label="Proformas del mes" value={k.proformas_mes} sub={subMes} subColor={dif >= 0 ? "#1b5e20" : "#b22222"} />
            <Kpi label="Monto del mes" value={`S/ ${num(k.monto_mes)}`} sub="Monto proformado" />
            <Kpi label="Total emitidas" value={k.total_proformas} sub="A la fecha" />
            <Kpi label="Promedio" value={`S/ ${num(promedio)}`} sub="Por proforma" />
          </section>

          <section style={{ ...D.row, gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)" }} className="dashRow">
            <div style={D.panel}>
              <h3 style={D.panelTitle}>Monto proformado por mes</h3>
              <BarrasMes datos={data.porMes} />
            </div>
            <div style={D.panel}>
              <h3 style={D.panelTitle}>Clientes con más monto</h3>
              {data.topClientes.length === 0 ? <div style={D.vacio}>Sin datos todavía.</div> :
                data.topClientes.map((c, i) => (
                  <div key={i} style={D.item}>
                    <span style={D.rank}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...D.ellipsis, fontSize: 13, fontWeight: 600 }}>{c.nombre}</div>
                      <div style={{ fontSize: 12, color: "#8a857a" }}>{c.proformas} proformas</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>S/ {num(c.monto)}</span>
                  </div>
                ))}
            </div>
          </section>

          <section style={{ ...D.row, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }} className="dashRow">
            <div style={D.panel}>
              <h3 style={D.panelTitle}>Productos más cotizados</h3>
              {data.topProductos.length === 0 ? <div style={D.vacio}>Sin datos todavía.</div> :
                data.topProductos.map((p, i) => (
                  <div key={i} style={D.item}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...D.ellipsis, fontSize: 13 }}>{p.descripcion}</div>
                      <div style={{ fontSize: 12, color: "#8a857a" }}>en {p.proformas} proformas</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{num(p.unidades)} und</span>
                  </div>
                ))}
            </div>
            <div style={D.panel}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={D.panelTitle}>Últimas proformas</h3>
                <button className="btnVer" style={{ marginBottom: 12 }} onClick={onHistorial}>Ver todas →</button>
              </div>
              {data.recientes.length === 0 ? <div style={D.vacio}>Sin datos todavía.</div> :
                data.recientes.map((p) => (
                  <div key={p.id} style={D.item}>
                    <span style={{ fontSize: 13, fontWeight: 700, width: 38 }}>{p.numero}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...D.ellipsis, fontSize: 13 }}>{p.cliente_nombre}</div>
                      <div style={{ fontSize: 12, color: "#8a857a" }}>{String(p.fecha).slice(0, 10)}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>S/ {num(p.total)}</span>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
// FIN SE AGREGA PANEL DASHBOARD COMO PANTALLA PRINCIPAL


// ============================================================
//  VISTA: HISTORIAL DE PROFORMAS
// ============================================================
function Historial({ showToast }) {
  const [lista, setLista] = useState([]);
  const [filtros, setFiltros] = useState({ desde: "", hasta: "", cliente: "", producto: "" });
  const [cargando, setCargando] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [sinBackend, setSinBackend] = useState(false);


//NUEVA MEJORA - AGREGANDO EL BOTON PDF EN EL HISTORIAL - 30/07/26
const descargarPDF = async (id) => {
  try {
    const r = await fetch(`${API_BASE}/proformas/${id}`);
    if (!r.ok) throw new Error();
    const data = await r.json();
    await generarPDFProforma(data);
    showToast("PDF generado ✓");
  } catch {
    showToast("No se pudo generar el PDF de esta proforma");
  }
};
//FIN - NUEVA MEJORA AGREGANDO EL BOTON PDF EN EL HISTORIAL - 30/07/26

const cargar = async () => {
  setCargando(true);
  const qs = new URLSearchParams();
  if (filtros.desde) qs.set("desde", filtros.desde);
  if (filtros.hasta) qs.set("hasta", filtros.hasta);
  if (filtros.cliente) qs.set("cliente", filtros.cliente);
  if (filtros.producto) qs.set("producto", filtros.producto);   // ← nueva línea
  try {
    const r = await fetch(`${API_BASE}/proformas?${qs.toString()}`);
    if (!r.ok) throw new Error();
    setLista(await r.json());
    setSinBackend(false);
  } catch {
    setSinBackend(true);
    setLista([]);
  } finally {
    setCargando(false);
  }
};

  useEffect(() => { cargar(); }, []);

  const verDetalle = async (id) => {
    try {
      const r = await fetch(`${API_BASE}/proformas/${id}`);
      if (!r.ok) throw new Error();
      setDetalle(await r.json());
    } catch { showToast("No se pudo cargar el detalle"); }
  };

  return (
    <main style={S.card}>
      <h2 style={S.h2}>Proformas emitidas</h2>

<section style={S.filtros}>
  <Field label="Desde">
    <input className="inp" type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
  </Field>
  <Field label="Hasta">
    <input className="inp" type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
  </Field>
  <Field label="Cliente">
    <input className="inp" placeholder="Buscar por nombre…" value={filtros.cliente} onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })} />
  </Field>
  <Field label="Producto">
    <input className="inp" placeholder="Buscar por producto…" value={filtros.producto} onChange={(e) => setFiltros({ ...filtros, producto: e.target.value })} />
  </Field>
  <button className="btn btnSave" style={{ alignSelf: "end", flex: "none" }} onClick={cargar}>🔍 Buscar</button>
</section>

      {sinBackend && (
        <div style={S.aviso}>No se pudo conectar al backend. Inicia la API para consultar el historial.</div>
      )}

      <div style={S.tablaHist}>
        <div style={S.histHead}>
          <div style={{ width: 70 }}>N°</div>
          <div style={{ width: 110 }}>Fecha</div>
          <div style={{ flex: 1 }}>Cliente</div>
          <div style={{ width: 110 }}>Condición</div>
          <div style={{ width: 120, textAlign: "right" }}>Total</div>
		  <div style={{ width: 150 }}></div>
        </div>

        {cargando ? (
          <div style={S.vacio}>Cargando…</div>
        ) : lista.length === 0 ? (
          <div style={S.vacio}>No hay proformas para mostrar.</div>
        ) : (
          lista.map((p) => (
            <div key={p.id} style={S.histRow}>
              <div style={{ width: 70, fontWeight: 700 }}>{p.numero}</div>
              <div style={{ width: 110 }}>{String(p.fecha).slice(0, 10)}</div>
              <div style={{ flex: 1 }}>{p.cliente_nombre}</div>
              <div style={{ width: 110 }}>{p.condicion_pago}</div>
              <div style={{ width: 120, textAlign: "right", fontWeight: 600 }}>{peso(p.total)}</div>
				<div style={{ width: 150, display: "flex", gap: 6 }}>
				  <button className="btnVer" onClick={() => verDetalle(p.id)}>Ver</button>
				  <button className="btnPdfMini" onClick={() => descargarPDF(p.id)}>PDF</button>
				</div>
            </div>
          ))
        )}
      </div>

      {detalle && <ModalDetalle data={detalle} onClose={() => setDetalle(null)} />}
    </main>
  );
}

function ModalDetalle({ data, onClose }) {
  return (
    <div style={S.overlay} onMouseDown={onClose}>
      <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Proforma N° {data.numero}</h3>
          <button className="btnDel" onClick={onClose}>✕</button>
        </div>
        <div style={S.modalBody}>
          <p style={{ margin: "0 0 4px" }}><b>Cliente:</b> {data.cliente_nombre}</p>
		  {data.solicitante && (
			  <p style={{ margin: "0 0 4px" }}><b>Solicitante:</b> {data.solicitante}</p>
		  )}
          <p style={{ margin: "0 0 4px" }}><b>Fecha:</b> {String(data.fecha).slice(0, 10)} · <b>Condición:</b> {data.condicion_pago}</p>
          <div style={{ ...S.thead, marginTop: 10, borderRadius: 8 }}>
            <div style={{ width: 50 }}>Cant.</div>
            <div style={{ flex: 1 }}>Descripción</div>
            <div style={{ width: 90, textAlign: "right" }}>P.Unit</div>
            <div style={{ width: 90, textAlign: "right" }}>Importe</div>
          </div>
          {data.items?.map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "7px 8px", borderBottom: "1px solid #eee", fontSize: 13 }}>
              <div style={{ width: 50 }}>{it.cantidad}</div>
              <div style={{ flex: 1 }}>{it.descripcion}</div>
              <div style={{ width: 90, textAlign: "right" }}>{peso(it.precio_unitario)}</div>
              <div style={{ width: 90, textAlign: "right", fontWeight: 600 }}>{peso(it.importe)}</div>
            </div>
          ))}
          <div style={{ ...S.totBig, display: "flex", justifyContent: "space-between", marginTop: 14 }}>
            <span>TOTAL</span><span>{peso(data.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Fila de producto con autocompletar ---------
function ItemRow({ item, onChange, onRemove }) {
  const [open, setOpen] = useState(false);
  const [sug, setSug] = useState([]);
  const boxRef = useRef(null);

  const buscar = async (texto) => {
    onChange({ descripcion: texto, producto_id: null });
    if (!texto) { setSug([]); setOpen(false); return; }
    try {
      const r = await fetch(`${API_BASE}/productos?q=${encodeURIComponent(texto)}`);
      if (!r.ok) throw new Error();
      setSug(await r.json());
    } catch {
      const t = texto.toLowerCase();
      setSug(CATALOGO_DEMO.filter((p) => p.descripcion.toLowerCase().includes(t)).slice(0, 12));
    }
    setOpen(true);
  };

  const elegir = (p) => {
    onChange({ descripcion: p.descripcion, precio_unitario: p.precio_unitario, producto_id: p.id });
    setOpen(false);
  };

  useEffect(() => {
    const h = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const importe = Number(item.cantidad || 0) * Number(item.precio_unitario || 0);

  return (
    <div style={S.row}>
      <input className="inp cell" style={{ width: 70 }} type="number" min="0" value={item.cantidad} onChange={(e) => onChange({ cantidad: e.target.value })} />
      <div style={{ flex: 1, position: "relative" }} ref={boxRef}>
        <input className="inp cell" placeholder="Escribe para buscar en el catálogo…" value={item.descripcion}
          onChange={(e) => buscar(e.target.value)} onFocus={() => item.descripcion && buscar(item.descripcion)} />
        {open && sug.length > 0 && (
          <div style={S.dropdown}>
            {sug.map((p) => (
              <div key={p.id} style={S.option} onMouseDown={() => elegir(p)}>
                <span style={{ fontWeight: 600 }}>{p.descripcion}</span>
                <span style={S.optMeta}>{p.codigo} · {peso(p.precio_unitario)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <input className="inp cell" style={{ width: 110 }} type="number" step="0.01" value={item.precio_unitario} onChange={(e) => onChange({ precio_unitario: e.target.value })} />
      <div style={{ width: 110, ...S.importe }}>{peso(importe)}</div>
      <button className="btnDel" onClick={onRemove} title="Eliminar">✕</button>
    </div>
  );
}

const Field = ({ label, children }) => (
  <label style={S.field}><span style={S.label}>{label}</span>{children}</label>
);
const Row = ({ k, v, big }) => (
  <div style={{ ...S.totRow, ...(big ? S.totBig : {}) }}><span>{k}</span><span>{v}</span></div>
);

// ---------- Estilos ----------
const S = {
  page: { minHeight: "100vh", background: "#f4f1ea", padding: "24px 16px", fontFamily: "'Outfit', system-ui, sans-serif", color: "#2a2a28" },
  header: { maxWidth: 960, margin: "0 auto 18px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px", flexWrap: "wrap", gap: 12 },
  logo: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, letterSpacing: 2, color: "#b22222", margin: 0, lineHeight: 1 },
  sub: { margin: "2px 0 0", fontSize: 13, color: "#6b6b66" },
  nav: { display: "flex", gap: 8 },
  card: { maxWidth: 960, margin: "0 auto", background: "#fff", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,.08)", padding: 26, border: "1px solid #e7e2d6" },
  h2: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 1, color: "#1b5e20", margin: "0 0 18px" },
  gridTop: { display: "flex", gap: 14, marginBottom: 15, flexWrap: "wrap" },
  gridCli: { display: "grid", gridTemplateColumns: "1.8fr 1fr 111px 2.2fr", gap: 14, marginBottom: 22, paddingBottom: 18, borderBottom: "2px dashed #e0dacb" },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#8a857a" },
  tableWrap: { marginBottom: 18 },
  thead: { display: "flex", gap: 10, padding: "10px 8px", background: "#1b5e20", color: "#fff", borderRadius: "8px 8px 0 0", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { display: "flex", gap: 10, padding: "8px", borderBottom: "1px solid #eee", alignItems: "center" },
  importe: { textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  addRow: { display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" },
  dropdown: { position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: 8, boxShadow: "0 12px 30px rgba(0,0,0,.15)", zIndex: 30, maxHeight: 280, overflowY: "auto", marginTop: 4 },
  option: { padding: "10px 12px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 2, borderBottom: "1px solid #f2f2f2", fontSize: 13 },
  optMeta: { fontSize: 11, color: "#999" },
  totals: { marginLeft: "auto", maxWidth: 340, marginBottom: 22 },
  totRow: { display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 14, borderBottom: "1px solid #f0ece2" },
  totBig: { fontSize: 22, fontWeight: 800, color: "#b22222", borderBottom: "none", borderTop: "2px solid #1b5e20", marginTop: 4, paddingTop: 12 },
  nota: { fontSize: 11, color: "#8a857a", fontStyle: "italic", textAlign: "right", marginTop: 6 },
  actions: { display: "flex", gap: 12, flexWrap: "wrap" },
  toast: { position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "#2a2a28", color: "#fff", padding: "12px 22px", borderRadius: 10, fontSize: 14, boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 100 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 },
  modal: { background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.3)" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid #eee" },
  modalBody: { padding: 22, display: "flex", flexDirection: "column", gap: 14 },
  modalFoot: { display: "flex", gap: 12, padding: "16px 22px", borderTop: "1px solid #eee", justifyContent: "flex-end" },
  check: { display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13, color: "#555", background: "#f7f5ef", padding: 12, borderRadius: 8, cursor: "pointer" },
  filtros: { display: "flex", gap: 9, marginBottom: 18, flexWrap: "wrap", alignItems: "end" },
  aviso: { background: "#fbeaea", color: "#b22222", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 14 },
  tablaHist: { border: "1px solid #eee", borderRadius: 10, overflow: "hidden" },
  histHead: { display: "flex", gap: 10, padding: "11px 12px", background: "#1b5e20", color: "#fff", fontSize: 12, fontWeight: 700, textTransform: "uppercase" },
  histRow: { display: "flex", gap: 10, padding: "11px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 14, alignItems: "center" },
  vacio: { padding: 30, textAlign: "center", color: "#999", fontSize: 14 },
  shell: { display: "flex", minHeight: "100vh", background: "#f4f1ea" },
	sidebar: { width: 210, flex: "none", background: "#1b5e20", color: "#fff", padding: "22px 14px", display: "flex", flexDirection: "column", gap: 6, position: "sticky", top: 0, height: "100vh", boxSizing: "border-box" },
	sideBrand: { display: "flex", alignItems: "center", gap: 10, padding: "0 6px 20px", borderBottom: "1px solid rgba(255,255,255,.2)", marginBottom: 10 },
	sideLogo: { width: 38, height: 38, borderRadius: 9, background: "#b22222", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1 },
	content: { flex: 1, minWidth: 0 },
};

const D = {
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 14 },
  kpi: { background: "#fff", border: "1px solid #e7e2d6", borderRadius: 14, padding: "16px 18px", boxShadow: "0 6px 20px rgba(0,0,0,.05)" },
  kpiLabel: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#8a857a" },
  kpiValue: { fontSize: 24, fontWeight: 800, margin: "6px 0 2px" },
  kpiSub: { fontSize: 12 },
  row: { display: "grid", gap: 14, marginBottom: 14 },
  panel: { background: "#fff", border: "1px solid #e7e2d6", borderRadius: 14, padding: 20, boxShadow: "0 6px 20px rgba(0,0,0,.05)" },
  panelTitle: { fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#1b5e20", margin: "0 0 12px" },
  item: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #f0ece2" },
  rank: { width: 24, height: 24, borderRadius: "50%", background: "#e3f2e4", color: "#1b5e20", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" },
  ellipsis: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  vacio: { padding: "18px 0", textAlign: "center", color: "#999", fontSize: 13 },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap');
* { box-sizing: border-box; }
.inp { width:100%; padding:9px 11px; border:1px solid #d9d3c5; border-radius:8px; font-size:14px; font-family:inherit; background:#fcfbf7; transition:border .15s, box-shadow .15s; }
.inp:focus { outline:none; border-color:#1b5e20; box-shadow:0 0 0 3px rgba(27,94,32,.12); }
.cell { background:#fff; }
.btn { border:none; padding:13px 22px; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer; font-family:inherit; transition:transform .1s, filter .15s; flex:1; min-width:150px; }
.btn:hover { filter:brightness(1.06); }
.btn:active { transform:translateY(1px); }
.btn:disabled { opacity:.6; cursor:default; }
.btnPdf { background:#b22222; color:#fff; }
.btnWa { background:#25d366; color:#fff; }
.btnSave { background:#1b5e20; color:#fff; }
.btnGhost { background:#eee; color:#444; }
.btnAdd { background:#fff; border:2px dashed #1b5e20; color:#1b5e20; padding:11px; flex:1; border-radius:8px; font-weight:700; cursor:pointer; font-family:inherit; font-size:14px; min-width:150px; }
.btnAdd:hover { background:#f0f7f0; }
.btnManual { background:#fff; border:2px dashed #b22222; color:#b22222; padding:11px; flex:1; border-radius:8px; font-weight:700; cursor:pointer; font-family:inherit; font-size:14px; min-width:150px; }
.btnManual:hover { background:#fdf2f2; }
.btnDel { width:32px; height:32px; border:none; background:#fbeaea; color:#b22222; border-radius:8px; cursor:pointer; font-size:14px; font-weight:700; }
.btnDel:hover { background:#f5d5d5; }
.btnVer { background:#1b5e20; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; }
.btnVer:hover { filter:brightness(1.1); }
.btnPdfMini { background:#A32D2D; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; }
.btnPdfMini:hover { filter:brightness(1.1); }
.navBtn { background:#fff; border:1px solid #d9d3c5; color:#555; padding:10px 16px; border-radius:9px; font-weight:700; cursor:pointer; font-family:inherit; font-size:14px; }
.navBtn:hover { border-color:#1b5e20; }
.navOn { background:#1b5e20; color:#fff; border-color:#1b5e20; }
.option:hover { background:#f0f7f0; }
@media (max-width:680px){ .gridTop, .gridCli { grid-template-columns:1fr 1fr !important; } }

.sideBtn { display:flex; align-items:center; gap:10px; width:100%; padding:12px 14px; border:none; border-radius:10px; background:transparent; color:#cfe5d1; font-family:inherit; font-size:15px; font-weight:600; cursor:pointer; text-align:left; transition:background .15s, color .15s; }
.sideBtn:hover { background:rgba(255,255,255,.10); color:#fff; }
.sideOn, .sideOn:hover { background:#fff; color:#1b5e20; }
@media (max-width:900px) {
  .dashKpis { grid-template-columns:repeat(2, minmax(0,1fr)) !important; }
  .dashRow { grid-template-columns:1fr !important; }
}
@media (max-width:820px) {
  .shell { flex-direction:column !important; }
  .sidebar { width:100% !important; height:auto !important; position:static !important; flex-direction:row !important; align-items:center; padding:10px 12px !important; overflow-x:auto; }
  .sideBrand { display:none !important; }
  .sideBtn { width:auto; white-space:nowrap; }
}

`;
