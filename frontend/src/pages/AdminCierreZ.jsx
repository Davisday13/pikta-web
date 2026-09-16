import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { FileText, Download, Printer, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function AdminCierreZ() {
  const { user, selectedSucursal } = useAuth();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [reportText, setReportText] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');

  const effectiveSucursalId = user?.rol === 'Administrador' || user?.rol === 'Supervisor'
    ? (selectedSucursal || user?.sucursal_id)
    : user?.sucursal_id;

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get('/fiscal/cierre-z/history');
      setHistory(res.data.data || []);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const generateCierreZ = async () => {
    if (!fecha) return setError('Selecciona una fecha');
    setLoading(true);
    setError('');
    setReport(null);
    setReportText('');
    try {
      const res = await api.post('/fiscal/cierre-z', {
        fecha,
        sucursal_id: effectiveSucursalId
      });
      if (res.data.success) {
        if (res.data.data) {
          setReport(res.data.data);
          setReportText(res.data.reporte_texto || '');
          loadHistory();
        } else {
          setError(res.data.message || 'No hay ventas para esta fecha');
        }
      } else {
        setError(res.data.error || 'Error al generar cierre Z');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    if (!reportText) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head><title>Cierre Z - PIK'TA</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 10px; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-top: 1px solid #000; margin: 6px 0; }
          .right { text-align: right; }
          pre { white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 11px; }
        </style>
        </head>
        <body><pre>${reportText}</pre></body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  const downloadPDF = () => {
    if (!report) return;
    const { jsPDF } = require('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    const pw = 80;
    let y = 8;
    const line = () => { doc.line(5, y, pw - 5, y); y += 3; };
    const center = (txt, sz = 8, f = 'normal') => { doc.setFont('courier', f); doc.setFontSize(sz); doc.text(txt, pw / 2, y, { align: 'center' }); y += sz * 0.4 + 1.5; };
    const row2 = (l, r, sz = 7) => { doc.setFont('courier', 'normal'); doc.setFontSize(sz); doc.text(l, 5, y); doc.text(r, pw - 5, y, { align: 'right' }); y += sz * 0.4 + 1; };

    center('DGI - PIK\'TA', 10, 'bold');
    center('REPORTE DE CIERRE Z', 9, 'bold');
    y += 2;
    row2(`Fecha: ${report.fecha_cierre}`, `Hora: ${report.hora_cierre}`);
    row2(`Caja: ${report.punto_venta}`, '');
    y += 2;

    line(); center('RESUMEN DE VENTAS', 7, 'bold'); line();
    row2('Total Bruto:', `$${report.resumen_ventas.total_bruto.toFixed(2)}`);
    row2('Total Neto:', `$${report.resumen_ventas.total_neto.toFixed(2)}`);
    row2('Total Impuestos:', `$${report.resumen_ventas.total_impuestos.toFixed(2)}`);
    row2('Exento:', `$${report.resumen_ventas.exento.toFixed(2)}`);
    y += 2;

    line(); center('DESGLOSE IMPUESTOS', 7, 'bold'); line();
    for (const imp of report.desglose_impuestos) {
      row2(`${imp.codigo} (${(imp.tasa * 100).toFixed(0)}%):`, '');
      row2(`  Base:`, `$${imp.base.toFixed(2)}`);
      row2(`  Monto:`, `$${imp.monto.toFixed(2)}`);
    }
    y += 2;

    line(); center('METODOS DE PAGO', 7, 'bold'); line();
    row2('Efectivo:', `$${report.metodos_pago.efectivo.toFixed(2)}`);
    row2('Yappy:', `$${report.metodos_pago.yappy.toFixed(2)}`);
    row2('Tarjeta Credito:', `$${report.metodos_pago.tarjeta_credito.toFixed(2)}`);
    row2('Transferencia:', `$${report.metodos_pago.transferencia.toFixed(2)}`);
    y += 2;

    line(); center('FOLIOS', 7, 'bold'); line();
    row2(`Inicial: ${report.folios.factura_inicial}`, '');
    row2(`Final: ${report.folios.factura_final}`, '');
    row2(`Documentos: ${report.folios.total_documentos}`, '');

    y += 3; line(); center('FIN DEL REPORTE Z', 8, 'bold'); line();

    doc.save(`cierre-z-${report.fecha_cierre}.pdf`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="text-pikta-accent" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Cierre Z</h1>
          <p className="text-gray-400 text-sm">Reporte fiscal diario de ventas</p>
        </div>
      </div>

      {/* Generate Section */}
      <div className="bg-pikta-panel rounded-xl p-6 mb-6">
        <h2 className="text-lg font-bold text-white mb-4">Generar Cierre Z</h2>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="text-gray-400 text-sm mb-1 block">Fecha del cierre</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-pikta-accent focus:outline-none"
            />
          </div>
          <button
            onClick={generateCierreZ}
            disabled={loading}
            className="px-6 py-3 bg-pikta-accent text-white rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <><Clock size={18} className="animate-spin" /> Generando...</>
            ) : (
              <><FileText size={18} /> Generar Cierre Z</>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-pikta-err/20 border border-pikta-err/40 rounded-lg flex items-center gap-2">
            <AlertCircle size={18} className="text-pikta-err" />
            <span className="text-pikta-err text-sm">{error}</span>
          </div>
        )}
      </div>

      {/* Report Display */}
      {report && (
        <div className="bg-pikta-panel rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle size={20} className="text-pikta-ok" />
              Cierre Z Generado
            </h2>
            <div className="flex gap-2">
              <button onClick={printReport} className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-500 transition">
                <Printer size={16} /> Imprimir
              </button>
              <button onClick={downloadPDF} className="px-4 py-2 bg-pikta-info text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-600 transition">
                <Download size={16} /> PDF
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs">Total Bruto</p>
              <p className="text-white text-xl font-bold">${report.resumen_ventas.total_bruto.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs">Total Neto</p>
              <p className="text-pikta-accent text-xl font-bold">${report.resumen_ventas.total_neto.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs">Impuestos</p>
              <p className="text-pikta-warn text-xl font-bold">${report.resumen_ventas.total_impuestos.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs">Documentos</p>
              <p className="text-white text-xl font-bold">{report.folios.total_documentos}</p>
            </div>
          </div>

          {/* Taxes */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-400 mb-3">DESGLOSE IMPUESTOS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.desglose_impuestos.map((imp, idx) => (
                <div key={idx} className="bg-gray-800 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="text-white font-bold">{imp.codigo}</p>
                    <p className="text-gray-400 text-xs">Tasa: {(imp.tasa * 100).toFixed(0)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">Base: ${imp.base.toFixed(2)}</p>
                    <p className="text-pikta-accent font-bold">${imp.monto.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-400 mb-3">METODOS DE PAGO</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Efectivo</p>
                <p className="text-pikta-ok font-bold text-lg">${report.metodos_pago.efectivo.toFixed(2)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Yappy</p>
                <p className="text-pikta-info font-bold text-lg">${report.metodos_pago.yappy.toFixed(2)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Tarjeta</p>
                <p className="text-indigo-400 font-bold text-lg">${report.metodos_pago.tarjeta_credito.toFixed(2)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Transferencia</p>
                <p className="text-pikta-warn font-bold text-lg">${report.metodos_pago.transferencia.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Folios */}
          <div>
            <h3 className="text-sm font-bold text-gray-400 mb-3">FOLIOS</h3>
            <div className="bg-gray-800 rounded-lg p-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-400 text-xs">Inicial</p>
                <p className="text-white font-mono font-bold">{report.folios.factura_inicial}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Final</p>
                <p className="text-white font-mono font-bold">{report.folios.factura_final}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Total</p>
                <p className="text-white font-mono font-bold">{report.folios.total_documentos}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-pikta-panel rounded-xl">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-6 py-4 flex items-center justify-between text-white hover:bg-gray-700/30 rounded-xl transition"
        >
          <span className="font-bold">Historial de Cierres Z</span>
          {showHistory ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {showHistory && (
          <div className="px-6 pb-4">
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No hay cierres Z registrados</p>
            ) : (
              <div className="space-y-2">
                {history.map((h, idx) => {
                  let data = {};
                  try { data = JSON.parse(h.detalles); } catch (e) {}
                  return (
                    <div key={idx} className="bg-gray-800 rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <p className="text-white text-sm font-bold">{data.fecha_cierre || h.fecha?.slice(0, 10)}</p>
                        <p className="text-gray-400 text-xs">{data.hora_cierre || ''} — {data.punto_venta || ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-pikta-accent font-bold">${data.resumen_ventas?.total_bruto?.toFixed(2) || '0.00'}</p>
                        <p className="text-gray-400 text-xs">{data.folios?.total_documentos || 0} docs</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
