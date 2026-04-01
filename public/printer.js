// printer.js - Módulo de Impresión Térmica (80mm / 58mm)
// Genera HTML formateado para impresoras térmicas y lanza la ventana nativa de impresión.

import { NOMBRE_RESTAURANTE, DIRECCION, TELEFONO, MENSAJE_PIE, LOGO_URL } from './config.js';
import { escapeHtml } from './sanitize.js';

/**
 * Imprime un ticket de cocina (comanda interna).
 * @param {{ mesaNumero: number, items: Array<{nombre: string, cantidad: number}>, fecha: string }} pedido
 */
export function imprimirTicketCocina(pedido) {
    const itemsHtml = pedido.items.map(i => `
        <tr>
            <td style="text-align:left; font-size:13px; padding:2px 0;">${escapeHtml(i.nombre)}</td>
            <td style="text-align:right; font-size:13px; font-weight:bold; padding:2px 0;">x${escapeHtml(i.cantidad)}</td>
        </tr>
    `).join('');

    const html = `
    <div style="width:72mm; font-family:'Courier New',monospace; padding:4mm;">
        <div style="text-align:center; border-bottom:2px dashed #000; padding-bottom:8px; margin-bottom:8px;">
            <div style="font-size:18px; font-weight:bold;">🍳 COCINA</div>
            <div style="font-size:12px; color:#555;">${pedido.fecha || new Date().toLocaleString('es-ES')}</div>
        </div>
        <div style="font-size:20px; font-weight:bold; text-align:center; margin:10px 0; background:#000; color:#fff; padding:6px; border-radius:4px;">
            MESA ${pedido.mesaNumero}
        </div>
        <table style="width:100%; border-collapse:collapse;">
            <thead><tr>
                <th style="text-align:left; border-bottom:1px solid #000; padding-bottom:4px; font-size:11px;">PLATILLO</th>
                <th style="text-align:right; border-bottom:1px solid #000; padding-bottom:4px; font-size:11px;">CTD</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
        </table>
        <div style="border-top:2px dashed #000; margin-top:10px; padding-top:8px; text-align:center; font-size:11px; color:#555;">
            Impreso: ${new Date().toLocaleTimeString('es-ES')}
        </div>
    </div>`;

    lanzarImpresion(html);
}

/**
 * Imprime un recibo de cliente (ticket fiscal/cuenta).
 * @param {{ mesaNumero: number, items: Array<{nombre:string, cantidad:number, precio:number}>, total:number, propina:number, pagoEfectivo:number, pagoTarjeta:number, metodo:string, cambio:number, fecha:string }} cuenta
 */
export function imprimirReciboCliente(cuenta) {
    const itemsHtml = cuenta.items.map(i => `
        <tr>
            <td style="text-align:left; font-size:12px; padding:2px 0;">${escapeHtml(i.cantidad)}x ${escapeHtml(i.nombre)}</td>
            <td style="text-align:right; font-size:12px; padding:2px 0;">$${escapeHtml((i.precio * i.cantidad).toFixed(2))}</td>
        </tr>
    `).join('');

    const desglosePago = [];
    if (cuenta.pagoEfectivo > 0) desglosePago.push(`<div>Efectivo: <strong>$${cuenta.pagoEfectivo.toFixed(2)}</strong></div>`);
    if (cuenta.pagoTarjeta > 0) desglosePago.push(`<div>Tarjeta: <strong>$${cuenta.pagoTarjeta.toFixed(2)}</strong></div>`);
    if (cuenta.cambio > 0) desglosePago.push(`<div style="font-size:14px; font-weight:bold; margin-top:4px;">CAMBIO: $${cuenta.cambio.toFixed(2)}</div>`);

    const html = `
    <div style="width:72mm; font-family:'Courier New',monospace; padding:4mm;">
        <!-- Cabecera del Restaurante -->
        <div style="text-align:center; margin-bottom:10px;">
            ${LOGO_URL ? `<img src="${LOGO_URL}" style="max-width:150px; margin-bottom:5px;" alt="Logo" />` : ''}
            <div style="font-size:16px; font-weight:bold; letter-spacing:1px;">${NOMBRE_RESTAURANTE}</div>
            <div style="font-size:10px; color:#555;">${DIRECCION}</div>
            <div style="font-size:10px; color:#555;">${TELEFONO}</div>
        </div>
        <div style="border-top:2px dashed #000; border-bottom:1px solid #000; padding:6px 0; margin-bottom:8px; text-align:center;">
            <div style="font-size:11px; color:#555;">Mesa ${cuenta.mesaNumero} | ${cuenta.fecha || new Date().toLocaleString('es-ES')}</div>
        </div>

        <!-- Detalle de Consumo -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
            <thead><tr>
                <th style="text-align:left; font-size:10px; border-bottom:1px dashed #999; padding-bottom:3px;">CONCEPTO</th>
                <th style="text-align:right; font-size:10px; border-bottom:1px dashed #999; padding-bottom:3px;">IMPORTE</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
        </table>

        <!-- Totales -->
        <div style="border-top:2px solid #000; padding-top:6px;">
            <div style="display:flex; justify-content:space-between; font-size:14px;">
                <span>Subtotal</span>
                <span>$${cuenta.total.toFixed(2)}</span>
            </div>
            ${cuenta.propina > 0 ? `
            <div style="display:flex; justify-content:space-between; font-size:14px; margin-top:2px;">
                <span>Propina</span>
                <span>$${cuenta.propina.toFixed(2)}</span>
            </div>
            ` : ''}
            <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:bold; margin-top:6px; border-top:1px dashed #000; padding-top:4px;">
                <span>TOTAL</span>
                <span>$${(cuenta.total + (cuenta.propina || 0)).toFixed(2)}</span>
            </div>
        </div>

        <!-- Desglose de Pago -->
        <div style="border-top:1px dashed #000; margin-top:6px; padding-top:6px; font-size:12px;">
            <div style="font-weight:bold; margin-bottom:4px;">Método: ${cuenta.metodo}</div>
            ${desglosePago.join('')}
        </div>

        <!-- Pie -->
        <div style="border-top:2px dashed #000; margin-top:10px; padding-top:8px; text-align:center;">
            <div style="font-size:12px; font-weight:bold;">${MENSAJE_PIE}</div>
            <div style="font-size:9px; color:#888; margin-top:4px;">Este NO es un comprobante fiscal</div>
        </div>
    </div>`;

    lanzarImpresion(html);
}

/**
 * Abre un iframe oculto, inyecta el HTML y lanza window.print() nativo.
 */
function lanzarImpresion(htmlContent) {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
        <title>Ticket</title>
        <style>
            @page {
                size: 80mm auto;
                margin: 0;
            }
            @media print {
                body { margin: 0; padding: 0; }
            }
            body { margin: 0; padding: 0; }
        </style>
    </head><body>${htmlContent}</body></html>`);
    doc.close();

    printFrame.contentWindow.focus();
    setTimeout(() => {
        printFrame.contentWindow.print();
        setTimeout(() => document.body.removeChild(printFrame), 1000);
    }, 250);
}
