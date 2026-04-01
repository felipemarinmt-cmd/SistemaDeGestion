// reports.js - Exportación de Reportes PDF y CSV
// Usa jsPDF (cargado vía CDN en admin.html)

import { NOMBRE_RESTAURANTE, DIRECCION, TELEFONO } from './config.js';

/**
 * Exporta datos de historial a PDF usando jsPDF + autoTable
 */
export function exportarPDF(historial) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Encabezado del restaurante
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(NOMBRE_RESTAURANTE, 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(DIRECCION, 105, 27, { align: 'center' });
    doc.text(TELEFONO, 105, 32, { align: 'center' });

    // Línea separadora
    doc.setDrawColor(200);
    doc.line(14, 36, 196, 36);

    // Título del reporte
    const fechaReporte = new Date().toLocaleDateString('es-ES', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte de Ventas', 14, 45);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${fechaReporte}`, 14, 51);

    // Tabla de datos
    const rows = historial.map(c => [
        new Date(c.created_at).toLocaleString('es-ES'),
        `Mesa ${c.mesas?.numero || c.mesa_id || 'N/A'}`,
        `$${(c.total || 0).toFixed(2)}`,
        `$${(c.propina || 0).toFixed(2)}`,
        c.metodo_pago || 'N/A'
    ]);

    doc.autoTable({
        startY: 56,
        head: [['Fecha', 'Mesa', 'Total', 'Propina', 'Método']],
        body: rows,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [63, 147, 166], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 }
    });

    // Resumen al final
    const totalVentas = historial.reduce((sum, c) => sum + (c.total || 0), 0);
    const totalPropinas = historial.reduce((sum, c) => sum + (c.propina || 0), 0);
    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Ventas: $${totalVentas.toFixed(2)}`, 14, finalY);
    doc.text(`Total Propinas: $${totalPropinas.toFixed(2)}`, 14, finalY + 7);
    doc.text(`Gran Total: $${(totalVentas + totalPropinas).toFixed(2)}`, 14, finalY + 14);
    doc.text(`Comandas: ${historial.length}`, 120, finalY);

    // Pie de página
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`reporte_ventas_${new Date().toISOString().slice(0,10)}.pdf`);
}

/**
 * Exporta datos de historial a CSV (compatible con Excel)
 */
export function exportarCSV(historial) {
    // BOM para que Excel reconozca UTF-8
    let csv = '\uFEFF';
    csv += `${NOMBRE_RESTAURANTE} - Reporte de Ventas\n`;
    csv += `Generado: ${new Date().toLocaleString('es-ES')}\n\n`;
    csv += 'Fecha,Mesa,Total,Propina,Método de Pago\n';

    historial.forEach(c => {
        const fecha = new Date(c.created_at).toLocaleString('es-ES');
        const mesa = c.mesas?.numero || c.mesa_id || 'N/A';
        const total = (c.total || 0).toFixed(2);
        const propina = (c.propina || 0).toFixed(2);
        const metodo = c.metodo_pago || 'N/A';
        csv += `"${fecha}","Mesa ${mesa}","$${total}","$${propina}","${metodo}"\n`;
    });

    // Resumen
    const totalVentas = historial.reduce((sum, c) => sum + (c.total || 0), 0);
    const totalPropinas = historial.reduce((sum, c) => sum + (c.propina || 0), 0);
    csv += `\n"TOTAL","${historial.length} comandas","$${totalVentas.toFixed(2)}","$${totalPropinas.toFixed(2)}",""\n`;

    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_ventas_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}
