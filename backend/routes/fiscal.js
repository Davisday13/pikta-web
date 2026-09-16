const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

function buildSucursalFilter(user, prefix = '') {
  if (user.rol === 'Administrador' || user.rol === 'Supervisor') return '';
  if (user.sucursal_id) return ` AND ${prefix}sucursal_id = ${user.sucursal_id}`;
  return '';
}

// POST /api/fiscal/cierre-z - Generate Z Report
router.post('/cierre-z', async (req, res) => {
  try {
    const { fecha, sucursal_id } = req.body;
    const targetDate = fecha || new Date().toISOString().slice(0, 10);

    const sucFilter = buildSucursalFilter(req.user, 'p.');
    const sucParam = (req.user.rol === 'Administrador' || req.user.rol === 'Supervisor') && sucursal_id
      ? ` AND p.sucursal_id = ${sucursal_id}` : sucFilter;

    const paidOrders = await queryAll(
      `SELECT p.* FROM pedidos p
       WHERE p.pagado = true
       AND p.estado IN ('COBRADO', 'ENTREGADO', 'PREPARANDO', 'LISTO')
       AND DATE(p.created_at) = $1
       ${sucParam}
       ORDER BY p.id ASC`,
      [targetDate]
    );

    if (!paidOrders || paidOrders.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: `No hay ventas pagadas para ${targetDate}`
      });
    }

    let totalBruto = 0;
    let totalImpuestos = 0;
    let exento = 0;
    const efectivo = { monto: 0, count: 0 };
    const yappy = { monto: 0, count: 0 };
    const tarjeta = { monto: 0, count: 0 };
    const transferencia = { monto: 0, count: 0 };
    let primerFolio = null;
    let ultimoFolio = null;

    const impuestos7 = { base: 0, monto: 0 };
    const impuestos10 = { base: 0, monto: 0 };

    for (const order of paidOrders) {
      const orderTotal = parseFloat(order.total) || 0;
      totalBruto += orderTotal;

      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const qty = item.cantidad || item.qty || 1;
        const price = item.precio || item.precio_unitario || 0;
        const subtotal = qty * price;
        const itemType = (item.tipo || 'COMIDA').toUpperCase();
        const taxRate = itemType === 'BEBIDA' ? 0.10 : 0.07;
        const taxAmount = subtotal * taxRate / (1 + taxRate);
        const baseAmount = subtotal - taxAmount;

        if (taxRate === 0.07) {
          impuestos7.base += baseAmount;
          impuestos7.monto += taxAmount;
        } else {
          impuestos10.base += baseAmount;
          impuestos10.monto += taxAmount;
        }
        totalImpuestos += taxAmount;
      }

      exento = totalBruto - totalImpuestos - (impuestos7.base + impuestos10.base);

      const metodo = (order.metodo_pago || 'EFECTIVO').toUpperCase();
      if (metodo === 'YAPPY') {
        yappy.monto += orderTotal;
        yappy.count++;
      } else if (metodo === 'TARJETA') {
        tarjeta.monto += orderTotal;
        tarjeta.count++;
      } else if (metodo === 'TRANSFERENCIA') {
        transferencia.monto += orderTotal;
        transferencia.count++;
      } else {
        efectivo.monto += orderTotal;
        efectivo.count++;
      }

      const folio = order.numero || `ORD-${order.id}`;
      if (!primerFolio) primerFolio = folio;
      ultimoFolio = folio;
    }

    const totalNeto = totalBruto - totalImpuestos;

    const now = new Date();
    const horaCierre = now.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const reportData = {
      tipo_reporte: 'Z',
      fecha_cierre: targetDate,
      hora_cierre: horaCierre,
      punto_venta: req.user.username || 'CAJA',
      resumen_ventas: {
        total_bruto: parseFloat(totalBruto.toFixed(2)),
        total_neto: parseFloat(totalNeto.toFixed(2)),
        total_impuestos: parseFloat(totalImpuestos.toFixed(2)),
        exento: parseFloat(exento.toFixed(2))
      },
      desglose_impuestos: [
        {
          codigo: 'ITBMS_7',
          tasa: 0.07,
          base: parseFloat(impuestos7.base.toFixed(2)),
          monto: parseFloat(impuestos7.monto.toFixed(2))
        },
        {
          codigo: 'ITBMS_10',
          tasa: 0.10,
          base: parseFloat(impuestos10.base.toFixed(2)),
          monto: parseFloat(impuestos10.monto.toFixed(2))
        }
      ],
      metodos_pago: {
        efectivo: parseFloat(efectivo.monto.toFixed(2)),
        yappy: parseFloat(yappy.monto.toFixed(2)),
        tarjeta_credito: parseFloat(tarjeta.monto.toFixed(2)),
        transferencia: parseFloat(transferencia.monto.toFixed(2))
      },
      folios: {
        factura_inicial: primerFolio,
        factura_final: ultimoFolio,
        total_documentos: paidOrders.length
      }
    };

    const reportText = generateReportText(reportData);

    await runSql(
      `INSERT INTO auditoria (tabla, accion, usuario, detalles, fecha)
       VALUES ('cierre_z', 'CREAR', $1, $2, NOW())`,
      [req.user.username || req.user.email, JSON.stringify(reportData)]
    );

    return res.json({
      success: true,
      data: reportData,
      reporte_texto: reportText
    });

  } catch (error) {
    console.error('Error en cierre Z:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al generar cierre Z'
    });
  }
});

// GET /api/fiscal/cierre-z/history - Z Report history
router.get('/cierre-z/history', async (req, res) => {
  try {
    const rows = await queryAll(
      `SELECT * FROM auditoria
       WHERE tabla = 'cierre_z'
       ORDER BY fecha DESC
       LIMIT 30`
    );
    return res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener historial' });
  }
});

function generateReportText(data) {
  const line = '─'.repeat(40);
  const dline = '═'.repeat(40);
  let txt = '';

  txt += `${dline}\n`;
  txt += `           DGI - PIK'TA\n`;
  txt += `     REPORTE DE CIERRE Z\n`;
  txt += `${dline}\n\n`;

  txt += `Fecha: ${data.fecha_cierre}\n`;
  txt += `Hora:  ${data.hora_cierre}\n`;
  txt += `Caja:  ${data.punto_venta}\n\n`;

  txt += `${line}\n`;
  txt += `         RESUMEN DE VENTAS\n`;
  txt += `${line}\n`;
  txt += `Total Bruto:      $${data.resumen_ventas.total_bruto.toFixed(2).padStart(10)}\n`;
  txt += `Total Neto:       $${data.resumen_ventas.total_neto.toFixed(2).padStart(10)}\n`;
  txt += `Total Impuestos:  $${data.resumen_ventas.total_impuestos.toFixed(2).padStart(10)}\n`;
  txt += `Exento:           $${data.resumen_ventas.exento.toFixed(2).padStart(10)}\n\n`;

  txt += `${line}\n`;
  txt += `        DESGLOSE IMPUESTOS\n`;
  txt += `${line}\n`;
  for (const imp of data.desglose_impuestos) {
    txt += `${imp.codigo} (${(imp.tasa * 100).toFixed(0)}%):\n`;
    txt += `  Base:    $${imp.base.toFixed(2).padStart(10)}\n`;
    txt += `  Monto:   $${imp.monto.toFixed(2).padStart(10)}\n`;
  }
  txt += '\n';

  txt += `${line}\n`;
  txt += `       METODOS DE PAGO\n`;
  txt += `${line}\n`;
  txt += `Efectivo:        $${data.metodos_pago.efectivo.toFixed(2).padStart(10)}\n`;
  txt += `Yappy:           $${data.metodos_pago.yappy.toFixed(2).padStart(10)}\n`;
  txt += `Tarjeta Credito: $${data.metodos_pago.tarjeta_credito.toFixed(2).padStart(10)}\n`;
  txt += `Transferencia:   $${data.metodos_pago.transferencia.toFixed(2).padStart(10)}\n\n`;

  txt += `${line}\n`;
  txt += `           FOLIOS\n`;
  txt += `${line}\n`;
  txt += `Inicial:   ${data.folios.factura_inicial}\n`;
  txt += `Final:     ${data.folios.factura_final}\n`;
  txt += `Documentos: ${data.folios.total_documentos}\n\n`;

  txt += `${dline}\n`;
  txt += `    FIN DEL REPORTE Z\n`;
  txt += `${dline}\n`;

  return txt;
}

module.exports = router;
