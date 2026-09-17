import { useRef } from 'react';
import { jsPDF } from 'jspdf';
import { X, Download, Printer } from 'lucide-react';

const COMPANY = {
  ruc: '1513069-1-850069',
  nombre: 'PIK\'TA',
  nombreSecundario: 'Restaurant',
  direccion: 'INTERAMERICANA',
  direccion2: 'DAVID',
  telefono: '7231-2417',
  email: 'pikta-restaurant@gmail.com',
  condicion: 'CONTADO',
  sucursal: '0001-PRINCIPAL',
  caja: '001',
  leyenda: 'MAS ALLA DE TU IMAGINACION. PARA TODO LOS CAMBIOS SE NECESITA LA FACTURA, Y EL PLAZO ES DE 15 DIAS. ROPA INTERIOR NO SE CAMBIA. ROPA BLANCA NO SE CAMBIA. CONSERVE LA CAJA EN BUEN ESTADO LOS ARTICULOS. REVISE SU CAMBIO ANTES DE SAIR DEL LOCAL.',
};

function getTaxRate(item) {
  const tipo = (item.tipo || '').toUpperCase();
  const nombre = (item.nombre || '').toUpperCase();
  const cat = (item.categoria || '').toUpperCase();

  if (tipo === 'BEBIDA ALCOHOLICA' || tipo === 'ALCOHOL' ||
      nombre.includes('CERVEZA') || nombre.includes('CERVEZAS') ||
      nombre.includes('VIN') || nombre.includes('RON') || nombre.includes('TEQUILA') ||
      nombre.includes('VODKA') || nombre.includes('WHISKY') || nombre.includes('GINEBRA') ||
      nombre.includes('CHAMPAGNA') || nombre.includes('ESPUMANTE') ||
      cat === 'BEBIDAS ALCOHOLICAS' || cat === 'ALCOHOL') {
    return 0.10;
  }
  return 0.07;
}

function calcItemTax(price, qty, taxRate) {
  const impuestoUnitario = Math.round(price * taxRate * 100) / 100;
  const precioConImp = Math.round((price + impuestoUnitario) * 100) / 100;
  const subtotalSinImp = Math.round(price * qty * 100) / 100;
  const impuestoItem = Math.round(impuestoUnitario * qty * 100) / 100;
  return {
    precioBase: Math.round(price * 100) / 100,
    impuestoUnitario,
    precioConImp,
    subtotalSinImp,
    impuestoItem,
    subtotalConImp: Math.round((subtotalSinImp + impuestoItem) * 100) / 100,
  };
}

export default function ReceiptModal({ order, onClose }) {
  const receiptRef = useRef();

  if (!order) return null;

  const { items, total, metodo_pago, monto_recibido, cambio, order_id, canal, created_at, descuento } = order;
  const now = created_at ? new Date(created_at) : new Date();
  const dateStr = now.toLocaleDateString('es-PA');
  const timeStr = now.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });
  const folio = order_id || String(Date.now()).slice(-10);
  const interno = folio;
  const totalItems = (items || []).reduce((sum, item) => sum + (item.cantidad || item.qty || 1), 0);

  const taxRate7 = 0.07;
  const taxRate10 = 0.10;

  let subtotal7 = 0, imp7 = 0, subtotal10 = 0, imp10 = 0;
  const itemsCalc = (items || []).map(item => {
    const qty = item.cantidad || item.qty || 1;
    const price = item.precio || 0;
    const rate = getTaxRate(item);
    const calc = calcItemTax(price, qty, rate);
    if (rate === 0.10) {
      subtotal10 += calc.subtotalSinImp;
      imp10 += calc.impuestoItem;
    } else {
      subtotal7 += calc.subtotalSinImp;
      imp7 += calc.impuestoItem;
    }
    return { ...item, qty, price, rate, calc };
  });

  const totalSinImp = subtotal7 + subtotal10;
  const totalImp = imp7 + imp10;
  const totalConImp = totalSinImp + totalImp;

  const cufe = `FE01${COMPANY.ruc.replace(/-/g, '')}${String(folio).padStart(10, '0')}${String(Math.floor(Math.random() * 9999999999999999))}`;
  const cafeDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const generatePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 290] });
    const pw = 80;
    let y = 4;
    const line = () => { doc.line(3, y, pw - 3, y); y += 2; };
    const center = (txt, sz = 7, f = 'normal') => { doc.setFont('courier', f); doc.setFontSize(sz); doc.text(txt, pw / 2, y, { align: 'center' }); y += sz * 0.4 + 1.2; };

    center('DGI', 10, 'bold');
    center(COMPANY.nombre, 9, 'bold');
    center(COMPANY.nombreSecundario, 7);
    y += 1;

    doc.setFont('courier', 'normal'); doc.setFontSize(6);
    const infoLines = [
      `RUC: ${COMPANY.ruc}`,
      `Direccion: ${COMPANY.direccion}`,
      `${COMPANY.direccion2}`,
      `Telefono: ${COMPANY.telefono}`,
      `Email: ${COMPANY.email}`,
      `Condicion: ${COMPANY.condicion}`,
      `Sucursal: ${COMPANY.sucursal}`,
    ];
    infoLines.forEach(l => { center(l, 6); });
    y += 1;

    line();
    center('COMPROBANTE AUXILIAR DE', 6.5, 'bold');
    center('FACTURACION ELECTRONICA', 6.5, 'bold');
    center('FACTURA', 8, 'bold');
    center('DE OPERACION INTERNA', 7, 'bold');
    y += 1;
    center(`Fecha: ${dateStr}  ${timeStr}`, 6.5);
    line();

    center('Receptor: Consumidor Final', 6.5);
    center('Cliente:', 6.5);
    center('Estimado Cliente', 6.5);
    y += 1;
    line();

    // Table header
    doc.setFont('courier', 'bold'); doc.setFontSize(5.5);
    doc.text('Descripcion', pw / 2 - 20, y, { align: 'left' });
    doc.text('Cant', pw / 2 + 5, y, { align: 'center' });
    doc.text('P.Venta', pw / 2 + 16, y, { align: 'right' });
    doc.text('ITBMS', pw / 2 + 27, y, { align: 'right' });
    doc.text('Total', pw - 4, y, { align: 'right' });
    y += 3;
    line();

    // Items
    doc.setFont('courier', 'normal'); doc.setFontSize(5.5);
    itemsCalc.forEach(item => {
      const name = item.nombre || '';
      const split = doc.splitTextToSize(name, 30);
      split.forEach((ln, i) => {
        doc.text(ln, pw / 2 - 20, y);
        if (i === 0) {
          doc.text(`${item.qty}.00`, pw / 2 + 5, y, { align: 'center' });
          doc.text(`${item.calc.precioBase.toFixed(2)}`, pw / 2 + 16, y, { align: 'right' });
          doc.text(`${item.calc.impuestoUnitario.toFixed(2)}`, pw / 2 + 27, y, { align: 'right' });
          doc.text(`${item.calc.subtotalConImp.toFixed(2)}`, pw - 4, y, { align: 'right' });
        }
        y += 2.5;
      });
    });

    y += 1;
    line();

    // Totals
    doc.setFont('courier', 'normal'); doc.setFontSize(6);
    if (descuento) {
      doc.text('Descuento:', pw / 2 - 20, y);
      doc.text(`-${descuento.toFixed(2)}`, pw - 4, y, { align: 'right' });
      y += 3;
    }
    doc.text('SubTotal 7%:', pw / 2 - 20, y);
    doc.text(subtotal7.toFixed(2), pw - 4, y, { align: 'right' });
    y += 3;
    doc.text('ITBMS 7%:', pw / 2 - 20, y);
    doc.text(imp7.toFixed(2), pw - 4, y, { align: 'right' });
    y += 3;
    doc.text('SubTotal 10%:', pw / 2 - 20, y);
    doc.text(subtotal10.toFixed(2), pw - 4, y, { align: 'right' });
    y += 3;
    doc.text('ITBMS 10%:', pw / 2 - 20, y);
    doc.text(imp10.toFixed(2), pw - 4, y, { align: 'right' });
    y += 4;
    line();

    doc.setFont('courier', 'bold'); doc.setFontSize(8);
    doc.text('Total Neto:', pw / 2 - 20, y);
    doc.text(`$${totalConImp.toFixed(2)}`, pw - 4, y, { align: 'right' });
    y += 5;
    line();

    // Payment
    doc.setFont('courier', 'normal'); doc.setFontSize(6);
    const metodoLabel = metodo_pago === 'EFECTIVO' ? 'EFECTIVO' : metodo_pago === 'YAPPY' ? 'YAPPY' : 'TARJETA';
    doc.text(`${metodoLabel}:`, pw / 2 - 20, y);
    doc.text(`${totalConImp.toFixed(2)}`, pw - 4, y, { align: 'right' });
    y += 3;
    if (metodo_pago === 'EFECTIVO') {
      doc.text('Vuelto:', pw / 2 - 20, y);
      doc.text(`${(cambio || 0).toFixed(2)}`, pw - 4, y, { align: 'right' });
      y += 3;
    }
    doc.text('Total articulos:', pw / 2 - 20, y);
    doc.text(`${totalItems}`, pw - 4, y, { align: 'right' });
    y += 3;
    doc.text('Cajero/a:', pw / 2 - 20, y);
    doc.text(`${order.cajero || 'CAJA'}`, pw - 4, y, { align: 'right' });
    y += 5;
    line();

    // Footer
    doc.setFont('courier', 'normal'); doc.setFontSize(5.5);
    center(`Caja/Pto Fact: ${COMPANY.caja}`, 5.5);
    center(`Cinta: ${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`, 5.5);
    center(`Fecha: ${dateStr}  ${timeStr}`, 5.5);
    center(`#Folio ${String(folio).padStart(10, '0')}`, 5.5);
    center(`#Interno ${String(interno).padStart(10, '0')}`, 5.5);
    y += 2;

    // QR
    doc.setDrawColor(0);
    doc.rect(pw / 2 - 10, y, 20, 20);
    doc.setFontSize(5);
    doc.text('[QR]', pw / 2, y + 12, { align: 'center' });
    y += 24;

    // CAFE
    doc.setFontSize(5);
    center('CAFE de emision previa, transmision para la', 5);
    center('DIRECCION GENERAL DE INGRESOS hasta', 5);
    center(`${cafeDate.toLocaleDateString('es-PA')} ${timeStr}`, 5);
    center('Consulta el comprobante en', 5);
    center('https://dgi-fep.mef.gob.pa/', 5);
    center('Consultas/facturasPorCUFE', 5);
    center('Con el CUFE:', 5);
    const cufeSplit = doc.splitTextToSize(cufe, 72);
    cufeSplit.forEach(l => { center(l, 5); });
    center('o escaneando el codigo QR', 5);
    y += 2;
    line();

    // Footer legal
    doc.setFontSize(5);
    const footerSplit = doc.splitTextToSize(COMPANY.leyenda, 72);
    footerSplit.forEach(l => { center(l, 5); });
    y += 2;
    center('Documento validado por Soluciones de', 5);
    center('Punto de Venta, S.A. con R.U.C.', 5);

    doc.save(`factura-pikta-${order_id || Date.now()}.pdf`);
  };

  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Factura PIK'TA</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: 'Courier New', monospace; font-size: 11px; width: 280px; margin: 0 auto; padding: 8px; color: #000; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px solid #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            td { padding: 1px 0; }
            .col-desc { text-align: left; }
            .col-cant { text-align: center; }
            .col-pv { text-align: right; }
            .col-imp { text-align: right; }
            .col-tot { text-align: right; }
            .small { font-size: 8px; }
          </style>
        </head>
        <body>
          <div class="center">
            <p style="font-size:14px; margin:2px 0;"><b>DGI</b></p>
            <p style="font-size:16px; margin:2px 0;"><b>${COMPANY.nombre}</b></p>
            <p style="font-size:10px; margin:1px 0;">${COMPANY.nombreSecundario}</p>
          </div>
          <div class="center" style="font-size:9px; margin-top:6px;">
            <p>RUC: ${COMPANY.ruc}</p>
            <p>Direccion: ${COMPANY.direccion}</p>
            <p>${COMPANY.direccion2}</p>
            <p>Telefono: ${COMPANY.telefono}</p>
            <p>Email: ${COMPANY.email}</p>
            <p>Condicion: ${COMPANY.condicion}</p>
            <p>Sucursal: ${COMPANY.sucursal}</p>
          </div>
          <div class="line"></div>
          <div class="center bold">
            <p style="font-size:9px;">COMPROBANTE AUXILIAR DE</p>
            <p style="font-size:9px;">FACTURACION ELECTRONICA</p>
            <p style="font-size:14px; margin:4px 0;">FACTURA</p>
            <p style="font-size:10px;">DE OPERACION INTERNA</p>
          </div>
          <div class="center" style="font-size:10px; margin:4px 0;">
            <p>Fecha: ${dateStr}  ${timeStr}</p>
          </div>
          <div class="line"></div>
          <div class="center" style="font-size:10px;">
            <p>Receptor: Consumidor Final</p>
            <p>Cliente:</p>
            <p>Estimado Cliente</p>
          </div>
          <div class="line"></div>
          <table style="margin:4px 0;">
            <tr class="bold" style="font-size:9px;">
              <td class="col-desc">Descripcion</td>
              <td class="col-cant">Cant</td>
              <td class="col-pv">P.Venta</td>
              <td class="col-imp">ITBMS</td>
              <td class="col-tot">Total</td>
            </tr>
          </table>
          <div class="line"></div>
          <table>
            ${itemsCalc.map(item => `
              <tr>
                <td class="col-desc" style="font-size:10px;">${item.nombre}</td>
                <td class="col-cant" style="font-size:10px;">${item.qty}.00</td>
                <td class="col-pv" style="font-size:10px;">${item.calc.precioBase.toFixed(2)}</td>
                <td class="col-imp" style="font-size:10px;">${item.calc.impuestoUnitario.toFixed(2)}</td>
                <td class="col-tot" style="font-size:10px;">${item.calc.subtotalConImp.toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>
          <div class="line"></div>
          <div class="center" style="font-size:10px; margin:4px 0;">
            ${descuento ? `<p>Descuento: ${descuento.toFixed(2)}</p>` : ''}
            <p>SubTotal 7%: ${subtotal7.toFixed(2)}</p>
            <p>ITBMS 7%: ${imp7.toFixed(2)}</p>
            <p>SubTotal 10%: ${subtotal10.toFixed(2)}</p>
            <p>ITBMS 10%: ${imp10.toFixed(2)}</p>
          </div>
          <div class="line"></div>
          <div class="center bold" style="font-size:14px; margin:4px 0;">
            <p>Total Neto: $${totalConImp.toFixed(2)}</p>
          </div>
          <div class="line"></div>
          <div class="center" style="font-size:10px; margin:4px 0;">
            <p>${metodo_pago === 'EFECTIVO' ? 'EFECTIVO' : metodo_pago}: ${totalConImp.toFixed(2)}</p>
            ${metodo_pago === 'EFECTIVO' ? `<p>Vuelto: ${(cambio || 0).toFixed(2)}</p>` : ''}
            <p>Total articulos: ${totalItems}</p>
            <p>Cajero/a: ${order.cajero || 'CAJA'}</p>
          </div>
          <div class="line"></div>
          <div class="center" style="font-size:9px;">
            <p>Caja/Pto Fact: ${COMPANY.caja}</p>
            <p>Cinta: ${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}</p>
            <p>Fecha: ${dateStr}  ${timeStr}</p>
            <p>#Folio ${String(folio).padStart(10, '0')}</p>
            <p>#Interno ${String(interno).padStart(10, '0')}</p>
          </div>
          <div class="center" style="margin:8px 0;">
            <div style="width:100px; height:100px; border:1px solid #000; margin:0 auto; display:flex; align-items:center; justify-content:center;">
              <span style="font-size:8px;">[QR CODE]</span>
            </div>
          </div>
          <div class="small center" style="margin-top:6px;">
            <p>CAFE de emision previa, transmision para la</p>
            <p>DIRECCION GENERAL DE INGRESOS hasta</p>
            <p>${cafeDate.toLocaleDateString('es-PA')} ${timeStr}</p>
            <p>Consulta el comprobante en</p>
            <p>https://dgi-fep.mef.gob.pa/</p>
            <p>Consultas/facturasPorCUFE</p>
            <p>Con el CUFE:</p>
            <p style="word-break:break-all;">${cufe}</p>
            <p>o escaneando el codigo QR</p>
          </div>
          <div class="line"></div>
          <div class="small center">
            <p>${COMPANY.leyenda}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-pikta-panel rounded-2xl w-[380px] shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-600">
          <h2 className="text-lg font-bold text-white">Factura Generada</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={22} /></button>
        </div>

        <div ref={receiptRef} className="flex-1 overflow-y-auto px-5 py-4">
          {/* DGI Header */}
          <div className="text-center mb-2">
            <p className="text-[10px] text-gray-400 font-bold">DGI</p>
            <h1 className="text-xl font-bold text-pikta-accent">{COMPANY.nombre}</h1>
            <p className="text-gray-400 text-xs">{COMPANY.nombreSecundario}</p>
          </div>

          {/* Company Info - centered */}
          <div className="text-[11px] text-gray-300 space-y-0.5 mb-3 text-center">
            <p>RUC: {COMPANY.ruc}</p>
            <p>Direccion: {COMPANY.direccion}</p>
            <p>{COMPANY.direccion2}</p>
            <p>Telefono: {COMPANY.telefono}</p>
            <p>Email: {COMPANY.email}</p>
            <p>Condicion: {COMPANY.condicion}</p>
            <p>Sucursal: {COMPANY.sucursal}</p>
          </div>

          <div className="border-t border-gray-600 my-2" />

          <div className="text-center mb-2">
            <p className="text-[10px] text-gray-400">COMPROBANTE AUXILIAR DE</p>
            <p className="text-[10px] text-gray-400">FACTURACION ELECTRONICA</p>
            <p className="text-sm font-bold text-white mt-1">FACTURA</p>
            <p className="text-[11px] text-gray-300">DE OPERACION INTERNA</p>
          </div>

          <div className="text-center text-[11px] text-gray-300 mb-2">
            <span>Fecha: {dateStr}  {timeStr}</span>
          </div>

          <div className="border-t border-gray-600 my-2" />

          <div className="text-center text-[11px] text-gray-300 mb-2">
            <p>Receptor: Consumidor Final</p>
            <p>Cliente:</p>
            <p>Estimado Cliente</p>
          </div>

          <div className="border-t border-gray-600 my-2" />

          {/* Table Header */}
          <div className="grid grid-cols-[1fr_30px_50px_50px_55px] gap-1 text-[10px] text-gray-400 font-bold mb-1 px-1">
            <span>Descripcion</span>
            <span className="text-center">Cant</span>
            <span className="text-right">P.Venta</span>
            <span className="text-right">ITBMS</span>
            <span className="text-right">Total</span>
          </div>
          <div className="border-t border-gray-600 my-1" />

          {/* Items */}
          <div className="space-y-1 mb-2">
            {itemsCalc.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_30px_50px_50px_55px] gap-1 text-[11px] px-1">
                <span className="text-white truncate">{item.nombre}</span>
                <span className="text-gray-300 text-center">{item.qty}.00</span>
                <span className="text-gray-300 text-right">{item.calc.precioBase.toFixed(2)}</span>
                <span className="text-gray-300 text-right">{item.calc.impuestoUnitario.toFixed(2)}</span>
                <span className="text-pikta-accent font-semibold text-right">${item.calc.subtotalConImp.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-600 my-2" />

          {/* Totals - centered */}
          <div className="text-[11px] text-gray-300 space-y-0.5 mb-2 px-1 text-center">
            {descuento > 0 && <p>Descuento: -${descuento.toFixed(2)}</p>}
            <p>SubTotal 7%: ${subtotal7.toFixed(2)}</p>
            <p>ITBMS 7%: ${imp7.toFixed(2)}</p>
            <p>SubTotal 10%: ${subtotal10.toFixed(2)}</p>
            <p>ITBMS 10%: ${imp10.toFixed(2)}</p>
          </div>

          <div className="border-t border-gray-600 my-2" />

          <div className="text-center mb-3 px-1">
            <span className="text-white font-bold text-sm">Total Neto: </span>
            <span className="text-pikta-accent font-bold text-lg">${totalConImp.toFixed(2)}</span>
          </div>

          <div className="border-t border-gray-600 my-2" />

          {/* Payment Info - centered */}
          <div className="text-[11px] text-gray-300 space-y-0.5 mb-2 px-1 text-center">
            <p>{metodo_pago === 'EFECTIVO' ? 'EFECTIVO' : metodo_pago}: ${totalConImp.toFixed(2)}</p>
            {metodo_pago === 'EFECTIVO' && <p>Vuelto: ${(cambio || 0).toFixed(2)}</p>}
            <p>Total articulos: {totalItems}</p>
            <p>Cajero/a: {order.cajero || 'CAJA'}</p>
          </div>

          <div className="border-t border-gray-600 my-2" />

          {/* Footer Info - centered */}
          <div className="text-[11px] text-gray-400 space-y-0.5 mb-3 px-1 text-center">
            <p>Caja/Pto Fact: {COMPANY.caja}</p>
            <p>Cinta: {String(Math.floor(Math.random() * 99999)).padStart(5, '0')}</p>
            <p>Fecha: {dateStr}  {timeStr}</p>
            <p>#Folio {String(folio).padStart(10, '0')}</p>
            <p>#Interno {String(interno).padStart(10, '0')}</p>
          </div>

          {/* QR placeholder */}
          <div className="flex justify-center my-3">
            <div className="w-24 h-24 border border-gray-600 rounded flex items-center justify-center">
              <span className="text-[10px] text-gray-500">[QR CODE]</span>
            </div>
          </div>

          {/* CAFE - centered */}
          <div className="text-[9px] text-gray-500 space-y-0.5 mb-3 text-center">
            <p>CAFE de emision previa, transmision para la</p>
            <p>DIRECCION GENERAL DE INGRESOS hasta</p>
            <p>{cafeDate.toLocaleDateString('es-PA')} {timeStr}</p>
            <p>Consulta el comprobante en</p>
            <p className="text-pikta-info">https://dgi-fep.mef.gob.pa/</p>
            <p>Consultas/facturasPorCUFE</p>
            <p>Con el CUFE:</p>
            <p className="break-all">FE01{COMPANY.ruc.replace(/-/g, '')}{String(folio).padStart(10, '0')}{String(Math.floor(Math.random() * 9999999999999999))}</p>
            <p>o escaneando el codigo QR</p>
          </div>

          <div className="border-t border-gray-600 my-2" />

          <p className="text-[9px] text-gray-500 text-center leading-tight">{COMPANY.leyenda}</p>
        </div>

        <div className="px-5 py-4 border-t border-gray-600 flex gap-2">
          <button onClick={generatePDF} className="flex-1 py-3 bg-pikta-info text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition">
            <Download size={16} /> Descargar PDF
          </button>
          <button onClick={printReceipt} className="flex-1 py-3 bg-gray-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-500 transition">
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
