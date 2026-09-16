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

export default function ReceiptModal({ order, onClose }) {
  const receiptRef = useRef();

  if (!order) return null;

  const { items, total, metodo_pago, monto_recibido, cambio, order_id, canal, created_at, impuesto, descuento } = order;
  const now = created_at ? new Date(created_at) : new Date();
  const dateStr = now.toLocaleDateString('es-PA');
  const timeStr = now.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });
  const folio = order_id || String(Date.now()).slice(-10);
  const interno = folio;
  const totalItems = (items || []).reduce((sum, item) => sum + (item.cantidad || item.qty || 1), 0);
  const taxRate = 0.07;
  const subTotal = total / (1 + taxRate);
  const imp = total - subTotal;
  const cafeDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const cufe = `FE01${COMPANY.ruc.replace(/-/g, '')}${String(folio).padStart(10, '0')}${String(Math.floor(Math.random() * 9999999999999999))}`;

  const generatePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 290] });
    const pw = 80;
    let y = 4;
    const line = () => { doc.line(3, y, pw - 3, y); y += 2; };
    const center = (txt, sz = 7, f = 'normal') => { doc.setFont('courier', f); doc.setFontSize(sz); doc.text(txt, pw / 2, y, { align: 'center' }); y += sz * 0.4 + 1.2; };
    const left = (txt, sz = 6.5) => { doc.setFont('courier', 'normal'); doc.setFontSize(sz); doc.text(txt, 4, y); y += sz * 0.4 + 0.8; };
    const row3 = (c1, c2, c3, w1 = 22, w2 = 28) => {
      doc.setFont('courier', 'normal'); doc.setFontSize(6.5);
      doc.text(c1, 4, y);
      doc.text(c2, 4 + w1, y);
      doc.text(c3, pw - 4, y, { align: 'right' });
      y += 3;
    };

    // Header DGI
    center('DGI', 10, 'bold');
    center(COMpany.nombre, 9, 'bold');
    y += 1;

    // Info empresa
    doc.setFont('courier', 'normal'); doc.setFontSize(6);
    doc.text(`RUC:`, 4, y); doc.text(`${COMPANY.ruc}`, 32, y); y += 3;
    doc.text(`Direccion:`, 4, y); doc.text(`${COMPANY.direccion}`, 32, y); y += 3;
    doc.text(``, 4, y); doc.text(`${COMPANY.direccion2}`, 32, y); y += 3;
    doc.text(`Telefono:`, 4, y); doc.text(`${COMPANY.telefono}`, 32, y); y += 3;
    doc.text(`Email:`, 4, y); doc.text(`${COMPANY.email}`, 32, y); y += 3;
    doc.text(`Condicion:`, 4, y); doc.text(`${COMPANY.condicion}`, 32, y); y += 3;
    doc.text(`Sucursal:`, 4, y); doc.text(`${COMPANY.sucursal}`, 32, y); y += 5;

    line();
    center('COMPROBANTE AUXILIAR DE', 6.5, 'bold');
    center('FACTURACION ELECTRONICA', 6.5, 'bold');
    center('FACTURA', 8, 'bold');
    center('DE OPERACION INTERNA', 7, 'bold');
    y += 1;
    doc.setFont('courier', 'normal'); doc.setFontSize(6.5);
    doc.text(`Fecha:  ${dateStr}  ${timeStr}`, 4, y); y += 5;

    line();
    left(`Receptor: Consumidor Final`);
    left(`Cliente:`);
    left(`Estimado Cliente`);
    y += 1;
    line();

    // Table header
    doc.setFont('courier', 'bold'); doc.setFontSize(6);
    doc.text('Descripcion', 4, y);
    doc.text('Cant', 42, y);
    doc.text('P.Venta', 52, y);
    doc.text('Tasa', 62, y);
    doc.text('Total', pw - 4, y, { align: 'right' });
    y += 3;
    line();

    // Items
    doc.setFont('courier', 'normal'); doc.setFontSize(6);
    (items || []).forEach(item => {
      const qty = item.cantidad || item.qty || 1;
      const price = item.precio || 0;
      const sub = qty * price;
      const name = item.nombre || '';
      const split = doc.splitTextToSize(name, 34);
      split.forEach((line, i) => {
        doc.text(line, 4, y);
        if (i === 0) {
          doc.text(`${qty}.00`, 42, y);
          doc.text(`${price.toFixed(2)}`, 52, y);
          doc.text('7.00%', 62, y);
          doc.text(`${sub.toFixed(2)}`, pw - 4, y, { align: 'right' });
        }
        y += 2.8;
      });
    });

    y += 1;
    line();

    const totalDesc = descuento || 0;
    doc.setFont('courier', 'normal'); doc.setFontSize(6.5);
    doc.text(`Descuento:`, 4, y); doc.text(`${totalDesc.toFixed(2)}`, pw - 4, y, { align: 'right' }); y += 3.5;
    doc.text(`SubTotal:`, 4, y); doc.text(`${subTotal.toFixed(2)}`, pw - 4, y, { align: 'right' }); y += 3.5;
    doc.text(`Impuesto:`, 4, y); doc.text(`${imp.toFixed(2)}`, pw - 4, y, { align: 'right' }); y += 4;

    doc.setFont('courier', 'bold'); doc.setFontSize(8);
    doc.text(`Total Neto:`, 4, y); doc.text(`${total.toFixed(2)}`, pw - 4, y, { align: 'right' }); y += 6;

    line();

    // Pago
    doc.setFont('courier', 'normal'); doc.setFontSize(6.5);
    const metodoLabel = metodo_pago === 'EFECTIVO' ? 'EFECTIVO' : metodo_pago === 'YAPPY' ? 'YAPPY' : 'TARJETA';
    doc.text(`${metodoLabel}:`, 4, y); doc.text(`${total.toFixed(2)}`, pw - 4, y, { align: 'right' }); y += 3.5;
    if (metodo_pago === 'EFECTIVO') {
      doc.text(`Vuelto:`, 4, y); doc.text(`${(cambio || 0).toFixed(2)}`, pw - 4, y, { align: 'right' }); y += 3.5;
    }
    doc.text(`Total de articulos:`, 4, y); doc.text(`${totalItems}`, pw - 4, y, { align: 'right' }); y += 3.5;
    doc.text(`Cajero/a:`, 4, y); doc.text(`${order.cajero || 'CAJA'}`, pw - 4, y, { align: 'right' }); y += 5;

    line();
    doc.setFont('courier', 'normal'); doc.setFontSize(6);
    doc.text(`Caja/Pto Fact: ${COMPANY.caja}`, 4, y); y += 3;
    doc.text(`Cinta: ${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`, 4, y); y += 3;
    doc.text(`Fecha: ${dateStr}  ${timeStr}`, 4, y); y += 3;
    doc.text(`#Folio ${String(folio).padStart(10, '0')}`, 4, y); y += 3;
    doc.text(`#Interno ${String(interno).padStart(10, '0')}`, 4, y); y += 5;

    // QR placeholder
    doc.setDrawColor(0);
    doc.rect(pw / 2 - 10, y, 20, 20);
    doc.setFontSize(5);
    doc.text('[QR]', pw / 2, y + 12, { align: 'center' });
    y += 24;

    // CAFE
    doc.setFontSize(5.5);
    doc.text('CAFE de emision previa, transmision para la', 4, y); y += 2.5;
    doc.text('DIRECCION GENERAL DE INGRESOS hasta', 4, y); y += 2.5;
    doc.text(`${cafeDate.toLocaleDateString('es-PA')} ${timeStr}`, 4, y); y += 3;
    doc.text('Consulta el comprobante en', 4, y); y += 2.5;
    doc.text('https://dgi-fep.mef.gob.pa/', 4, y); y += 2.5;
    doc.text('Consultas/facturasPorCUFE', 4, y); y += 3;
    doc.text('Con el CUFE:', 4, y); y += 2.5;
    const cufeSplit = doc.splitTextToSize(cufe, 70);
    cufeSplit.forEach(l => { doc.text(l, 4, y); y += 2.5; });
    doc.text('o escaneando el codigo QR', 4, y); y += 5;

    line();

    // Footer legal
    doc.setFontSize(5.5);
    const footerSplit = doc.splitTextToSize(COMpany.leyenda, 70);
    footerSplit.forEach(l => { doc.text(l, 4, y); y += 2.5; });
    y += 3;
    doc.text('Documento validado por Soluciones de', 4, y); y += 2.5;
    doc.text('Punto de Venta, S.A. con R.U.C.', 4, y);

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
            .right { text-align: right; }
            .item { display: flex; justify-content: space-between; margin: 1px 0; font-size: 10px; }
            .header { font-size: 9px; }
            .small { font-size: 8px; }
            h1 { font-size: 20px; margin: 0; }
            h2 { font-size: 11px; margin: 1px 0; font-weight: normal; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            td { padding: 1px 0; }
            .col-desc { width: 45%; }
            .col-cant { width: 12%; text-align: center; }
            .col-pv { width: 18%; text-align: right; }
            .col-tot { width: 25%; text-align: right; }
          </style>
        </head>
        <body>
          <div class="center">
            <p style="font-size:14px; margin:2px 0;"><b>DGI</b></p>
            <p style="font-size:16px; margin:2px 0;"><b>${COMPANY.nombre}</b></p>
            <p style="font-size:10px; margin:1px 0;">${COMPANY.nombreSecundario}</p>
          </div>
          <div class="header" style="margin-top:6px;">
            <div class="item"><span>RUC:</span><span>${COMPANY.ruc}</span></div>
            <div class="item"><span>Direccion:</span><span>${COMPANY.direccion}</span></div>
            <div class="item"><span></span><span>${COMPANY.direccion2}</span></div>
            <div class="item"><span>Telefono:</span><span>${COMPANY.telefono}</span></div>
            <div class="item"><span>Email:</span><span>${COMPANY.email}</span></div>
            <div class="item"><span>Condicion:</span><span>${COMPANY.condicion}</span></div>
            <div class="item"><span>Sucursal:</span><span>${COMPANY.sucursal}</span></div>
          </div>
          <div class="line"></div>
          <div class="center bold">
            <p style="font-size:9px;">COMPROBANTE AUXILIAR DE</p>
            <p style="font-size:9px;">FACTURACION ELECTRONICA</p>
            <p style="font-size:14px; margin:4px 0;">FACTURA</p>
            <p style="font-size:10px;">DE OPERACION INTERNA</p>
          </div>
          <div class="header" style="margin:4px 0;">
            <div class="item"><span>Fecha:</span><span>${dateStr}  ${timeStr}</span></div>
          </div>
          <div class="line"></div>
          <div class="header">
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
              <td class="col-tot">Total</td>
            </tr>
          </table>
          <div class="line"></div>
          <table>
            ${(items || []).map(item => {
              const qty = item.cantidad || item.qty || 1;
              const price = item.precio || 0;
              const sub = qty * price;
              return `<tr>
                <td class="col-desc" style="font-size:10px;">${item.nombre}</td>
                <td class="col-cant" style="font-size:10px;">${qty}.00</td>
                <td class="col-pv" style="font-size:10px;">${price.toFixed(2)}</td>
                <td class="col-tot" style="font-size:10px;">${sub.toFixed(2)}</td>
              </tr>`;
            }).join('')}
          </table>
          <div class="line"></div>
          <div class="header" style="margin:4px 0;">
            <div class="item"><span>Descuento:</span><span>${(descuento || 0).toFixed(2)}</span></div>
            <div class="item"><span>SubTotal:</span><span>${subTotal.toFixed(2)}</span></div>
            <div class="item"><span>Impuesto:</span><span>${imp.toFixed(2)}</span></div>
          </div>
          <div class="line"></div>
          <div class="right bold" style="font-size:14px; margin:4px 0;">
            <p>Total Neto:  $${total.toFixed(2)}</p>
          </div>
          <div class="line"></div>
          <div class="header" style="margin:4px 0;">
            <div class="item"><span>${metodo_pago === 'EFECTIVO' ? 'EFECTIVO' : metodo_pago}:</span><span>${total.toFixed(2)}</span></div>
            ${metodo_pago === 'EFECTIVO' ? `<div class="item"><span>Vuelto:</span><span>${(cambio || 0).toFixed(2)}</span></div>` : ''}
            <div class="item"><span>Total de articulos:</span><span>${totalItems}</span></div>
            <div class="item"><span>Cajero/a:</span><span>${order.cajero || 'CAJA'}</span></div>
          </div>
          <div class="line"></div>
          <div class="header">
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
          <div class="small" style="margin-top:6px;">
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
          <div class="small">
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

          {/* COMPANY Info */}
          <div className="text-[11px] text-gray-300 space-y-0.5 mb-3">
            <div className="flex justify-between"><span>RUC:</span><span>{COMPANY.ruc}</span></div>
            <div className="flex justify-between"><span>Direccion:</span><span>{COMPANY.direccion}</span></div>
            <div className="flex justify-between"><span></span><span>{COMPANY.direccion2}</span></div>
            <div className="flex justify-between"><span>Telefono:</span><span>{COMPANY.telefono}</span></div>
            <div className="flex justify-between"><span>Email:</span><span>{COMPANY.email}</span></div>
            <div className="flex justify-between"><span>Condicion:</span><span>{COMPANY.condicion}</span></div>
            <div className="flex justify-between"><span>Sucursal:</span><span>{COMPANY.sucursal}</span></div>
          </div>

          <div className="border-t border-gray-600 my-2" />

          <div className="text-center mb-2">
            <p className="text-[10px] text-gray-400">COMPROBANTE AUXILIAR DE</p>
            <p className="text-[10px] text-gray-400">FACTURACION ELECTRONICA</p>
            <p className="text-sm font-bold text-white mt-1">FACTURA</p>
            <p className="text-[11px] text-gray-300">DE OPERACION INTERNA</p>
          </div>

          <div className="text-[11px] text-gray-300 mb-2">
            <span>Fecha: {dateStr}  {timeStr}</span>
          </div>

          <div className="border-t border-gray-600 my-2" />

          <div className="text-[11px] text-gray-300 mb-2">
            <p>Receptor: Consumidor Final</p>
            <p>Cliente:</p>
            <p>Estimado Cliente</p>
          </div>

          <div className="border-t border-gray-600 my-2" />

          {/* Table Header */}
          <div className="grid grid-cols-[1fr_40px_60px_60px] gap-1 text-[10px] text-gray-400 font-bold mb-1 px-1">
            <span>Descripcion</span>
            <span className="text-center">Cant</span>
            <span className="text-right">P.Venta</span>
            <span className="text-right">Total</span>
          </div>
          <div className="border-t border-gray-600 my-1" />

          {/* Items */}
          <div className="space-y-1 mb-2">
            {(items || []).map((item, idx) => {
              const qty = item.cantidad || item.qty || 1;
              const price = item.precio || 0;
              const sub = qty * price;
              return (
                <div key={idx} className="grid grid-cols-[1fr_40px_60px_60px] gap-1 text-[11px] px-1">
                  <span className="text-white truncate">{item.nombre}</span>
                  <span className="text-gray-300 text-center">{qty}.00</span>
                  <span className="text-gray-300 text-right">{price.toFixed(2)}</span>
                  <span className="text-pikta-accent font-semibold text-right">${sub.toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-600 my-2" />

          {/* Totals */}
          <div className="text-[11px] text-gray-300 space-y-0.5 mb-2 px-1">
            <div className="flex justify-between"><span>Descuento:</span><span>${(descuento || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>SubTotal:</span><span>${subTotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Impuesto:</span><span>${imp.toFixed(2)}</span></div>
          </div>

          <div className="border-t border-gray-600 my-2" />

          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-white font-bold text-sm">Total Neto:</span>
            <span className="text-pikta-accent font-bold text-lg">${total.toFixed(2)}</span>
          </div>

          <div className="border-t border-gray-600 my-2" />

          {/* Payment Info */}
          <div className="text-[11px] text-gray-300 space-y-0.5 mb-2 px-1">
            <div className="flex justify-between">
              <span>{metodo_pago === 'EFECTIVO' ? 'EFECTIVO' : metodo_pago}:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            {metodo_pago === 'EFECTIVO' && (
              <div className="flex justify-between">
                <span>Vuelto:</span>
                <span>${(cambio || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between"><span>Total de articulos:</span><span>{totalItems}</span></div>
            <div className="flex justify-between"><span>Cajero/a:</span><span>{order.cajero || 'CAJA'}</span></div>
          </div>

          <div className="border-t border-gray-600 my-2" />

          {/* Footer Info */}
          <div className="text-[11px] text-gray-400 space-y-0.5 mb-3 px-1">
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

          {/* CAFE */}
          <div className="text-[9px] text-gray-500 space-y-0.5 mb-3">
            <p>CAFE de emision previa, transmision para la</p>
            <p>DIRECCION GENERAL DE INGRESOS hasta</p>
            <p>{new Date(now.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString('es-PA')} {timeStr}</p>
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
