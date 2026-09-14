import { useRef } from 'react';
import { jsPDF } from 'jspdf';
import { X, Download, Printer } from 'lucide-react';

export default function ReceiptModal({ order, onClose }) {
  const receiptRef = useRef();

  if (!order) return null;

  const { items, total, metodo_pago, monto_recibido, cambio, order_id, canal, created_at } = order;
  const now = created_at ? new Date(created_at) : new Date();
  const dateStr = now.toLocaleDateString('es-PA');
  const timeStr = now.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });

  const generatePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    const pageWidth = 80;
    let y = 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text("PIK'TA", pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Restaurante', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text('David - Boquete', pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(7);
    doc.text(`Ticket #${order_id || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
    y += 3;
    doc.text(`${dateStr} ${timeStr}`, pageWidth / 2, y, { align: 'center' });
    y += 3;
    doc.text(`Canal: ${canal === 'LLEVAR' ? 'Para Llevar' : 'Consumo Local'}`, pageWidth / 2, y, { align: 'center' });
    y += 4;

    doc.setDrawColor(0);
    doc.line(5, y, pageWidth - 5, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('Cant', 7, y);
    doc.text('Producto', 17, y);
    doc.text('Subtotal', pageWidth - 7, y, { align: 'right' });
    y += 3;

    doc.setFont('helvetica', 'normal');
    if (items && items.length > 0) {
      for (const item of items) {
        const name = item.nombre || '';
        const qty = item.cantidad || item.qty || 1;
        const price = item.precio || 0;
        const subtotal = qty * price;

        doc.text(`${qty}x`, 7, y);

        const maxWidth = 40;
        const splitName = doc.splitTextToSize(name, maxWidth);
        doc.text(splitName[0], 17, y);

        doc.text(`$${subtotal.toFixed(2)}`, pageWidth - 7, y, { align: 'right' });
        y += splitName.length * 3;

        if (y > 180) {
          doc.addPage();
          y = 10;
        }
      }
    }

    y += 2;
    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`TOTAL: $${total.toFixed(2)}`, pageWidth - 7, y, { align: 'right' });
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (metodo_pago === 'EFECTIVO' && monto_recibido) {
      doc.text(`Recibido: $${parseFloat(monto_recibido).toFixed(2)}`, pageWidth - 7, y, { align: 'right' });
      y += 4;
      doc.text(`Cambio:   $${cambio.toFixed(2)}`, pageWidth - 7, y, { align: 'right' });
      y += 4;
    } else {
      doc.text(`Pago: ${metodo_pago}`, pageWidth - 7, y, { align: 'right' });
      y += 4;
    }

    doc.text(`Método: ${metodo_pago}`, pageWidth - 7, y, { align: 'right' });
    y += 6;

    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    doc.setFontSize(7);
    doc.text('¡Gracias por su preferencia!', pageWidth / 2, y, { align: 'center' });
    y += 3;
    doc.text('www.pikta-restaurant.com', pageWidth / 2, y, { align: 'center' });

    doc.save(`factura-pikta-${order_id || Date.now()}.pdf`);
  };

  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Factura PIK'TA</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 10px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 8px 0; }
            .right { text-align: right; }
            .item { display: flex; justify-content: space-between; margin: 2px 0; }
            h1 { font-size: 18px; margin: 0; }
            h2 { font-size: 12px; margin: 2px 0; font-weight: normal; }
          </style>
        </head>
        <body>
          <div class="center">
            <h1>PIK'TA</h1>
            <h2>Restaurante</h2>
            <h2>David - Boquete</h2>
            <p>Ticket #${order_id || 'N/A'}</p>
            <p>${dateStr} ${timeStr}</p>
            <p>${canal === 'LLEVAR' ? 'Para Llevar' : 'Consumo Local'}</p>
          </div>
          <div class="line"></div>
          <div class="bold">
            <div class="item"><span>Cant</span><span>Producto</span><span>Subtotal</span></div>
          </div>
          <div class="line"></div>
          ${(items || []).map(item => `
            <div class="item">
              <span>${item.cantidad || item.qty || 1}x ${item.nombre}</span>
              <span>$${((item.cantidad || item.qty || 1) * (item.precio || 0)).toFixed(2)}</span>
            </div>
          `).join('')}
          <div class="line"></div>
          <div class="right bold" style="font-size: 14px;">
            <p>TOTAL: $${total.toFixed(2)}</p>
          </div>
          ${metodo_pago === 'EFECTIVO' && monto_recibido ? `
            <div class="right">
              <p>Recibido: $${parseFloat(monto_recibido).toFixed(2)}</p>
              <p>Cambio: $${cambio.toFixed(2)}</p>
            </div>
          ` : ''}
          <div class="right"><p>Método: ${metodo_pago}</p></div>
          <div class="line"></div>
          <div class="center">
            <p>¡Gracias por su preferencia!</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-pikta-panel rounded-2xl w-[360px] shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-600">
          <h2 className="text-lg font-bold text-white">Factura Generada</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={22} />
          </button>
        </div>

        {/* Receipt content */}
        <div ref={receiptRef} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-pikta-accent">PIK'TA</h1>
            <p className="text-gray-400 text-sm">Restaurante</p>
            <p className="text-gray-400 text-xs">David - Boquete</p>
          </div>

          <div className="text-center mb-3">
            <p className="text-white text-sm font-mono">Ticket #{order_id || 'N/A'}</p>
            <p className="text-gray-400 text-xs">{dateStr} {timeStr}</p>
            <p className="text-gray-400 text-xs">{canal === 'LLEVAR' ? 'Para Llevar' : 'Consumo Local'}</p>
          </div>

          <div className="border-t border-dashed border-gray-600 my-3" />

          <div className="space-y-1.5 mb-3">
            {(items || []).map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-white">{item.cantidad || item.qty || 1}x {item.nombre}</span>
                <span className="text-pikta-accent font-semibold">${((item.cantidad || item.qty || 1) * (item.precio || 0)).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-600 my-3" />

          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-bold text-lg">TOTAL:</span>
            <span className="text-pikta-accent font-bold text-xl">${total.toFixed(2)}</span>
          </div>

          {metodo_pago === 'EFECTIVO' && monto_recibido && (
            <>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Recibido:</span>
                <span className="text-white">${parseFloat(monto_recibido).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Cambio:</span>
                <span className="text-pikta-ok font-bold">${cambio.toFixed(2)}</span>
              </div>
            </>
          )}

          <div className="flex justify-between text-sm mb-3">
            <span className="text-gray-400">Método:</span>
            <span className="text-white">{metodo_pago}</span>
          </div>

          <div className="border-t border-dashed border-gray-600 my-3" />

          <p className="text-center text-gray-500 text-xs">¡Gracias por su preferencia!</p>
        </div>

        {/* Action buttons */}
        <div className="px-5 py-4 border-t border-gray-600 flex gap-2">
          <button
            onClick={generatePDF}
            className="flex-1 py-3 bg-pikta-info text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition"
          >
            <Download size={16} /> Descargar PDF
          </button>
          <button
            onClick={printReceipt}
            className="flex-1 py-3 bg-gray-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-500 transition"
          >
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
