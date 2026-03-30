// admin.js - Lógica Administrativa Premium (Serverless Supabase + Facturación Fase 3)

import { 
    supabase, 
    fetchDashboardResumen, 
    fetchMesas, 
    cobrarMesaConPago,
    fetchComandasActivasMesa,
    fetchMenu, 
    crearProductoMenu, 
    eliminarProductoMenu, 
    fetchHistorialComandas,
    abrirTurnoCaja,
    fetchTurnoActivo,
    cerrarTurnoCaja
} from './api.js';

import { imprimirReciboCliente } from './printer.js';
import { escapeHtml } from './sanitize.js';
import { showToast } from './ui.js';

// --- Estado interno del módulo ---
let turnoActivo = null;
let checkoutMesaId = null;
let checkoutTotal = 0;
let checkoutItems = []; // para el ticket

// showToast se importa desde ui.js (fuente única de verdad)
window.showToast = showToast;

// Utilidades: Dispositivo
function verificarDispositivo() {
    if (window.innerWidth < 768) {
        document.getElementById('pantalla-bloqueo')?.classList.remove('oculto');
        document.getElementById('app-container')?.classList.add('oculto');
    } else {
        document.getElementById('pantalla-bloqueo')?.classList.add('oculto');
        document.getElementById('app-container')?.classList.remove('oculto');
    }
}

let currentView = 'view-dashboard';

window.addEventListener('resize', verificarDispositivo);
window.addEventListener('load', async () => {
    verificarDispositivo();
    initSpaRouter();
    await cargarDashboard();
    await verificarTurnoActivo();
    
    // Supabase Realtime
    const channel = supabase.channel('admin-updates');
    
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, () => {
        if(currentView === 'view-dashboard') cargarDashboard();
        if(currentView === 'view-reportes') cargarReportes();
    });
    
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        if(currentView === 'view-dashboard') cargarDashboard();
    });

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, () => {
        if(currentView === 'view-inventario') cargarInventario();
    });

    channel.subscribe((status) => {
        if(status === 'SUBSCRIBED') {
            const btn = document.getElementById('btn-actualizar');
            if (btn) btn.innerHTML = '● Realtime Activo';
        }
    });

    // Limpiar canal al cerrar/recargar la pestaña
    window.addEventListener('beforeunload', () => {
        channel.unsubscribe();
    });
});

// Enrutador SPA
function initSpaRouter() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            navItems.forEach(i => i.classList.remove('activo'));
            e.currentTarget.classList.add('activo');
            
            const target = e.currentTarget.getAttribute('data-target');
            document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('oculto'));
            document.getElementById(target).classList.remove('oculto');
            
            currentView = target;
            
            if (target === 'view-dashboard') {
                document.getElementById('page-title').textContent = "Resumen del Negocio";
                document.getElementById('page-subtitle').textContent = "Monitoreo en tiempo real (Supabase)";
                cargarDashboard();
            } else if (target === 'view-inventario') {
                document.getElementById('page-title').textContent = "Inventario y Catálogo";
                document.getElementById('page-subtitle').textContent = "Administra los productos de tu negocio";
                cargarInventario();
            } else if (target === 'view-reportes') {
                document.getElementById('page-title').textContent = "Reportes e Historial";
                document.getElementById('page-subtitle').textContent = "Comandas cobradas y resumen histórico";
                cargarReportes();
            } else if (target === 'view-caja') {
                document.getElementById('page-title').textContent = "Control de Caja";
                document.getElementById('page-subtitle').textContent = "Apertura de turno y Corte Z";
                verificarTurnoActivo();
            }
        });
    });
}

// Botón manual de actualización
const btnActualizar = document.getElementById('btn-actualizar');
if (btnActualizar) {
    btnActualizar.addEventListener('click', () => {
        btnActualizar.innerHTML = '↻ Actualizando...';
        btnActualizar.disabled = true;
        
        let promise;
        if (currentView === 'view-dashboard') promise = cargarDashboard();
        else if (currentView === 'view-inventario') promise = cargarInventario();
        else if (currentView === 'view-reportes') promise = cargarReportes();
        else promise = Promise.resolve();

        promise.then(() => {
            setTimeout(() => {
                btnActualizar.innerHTML = '● Realtime Activo';
                btnActualizar.disabled = false;
            }, 500);
        });
    });
}

// =============================================
// VISTA: DASHBOARD
// =============================================
async function cargarDashboard() {
    try {
        const [data, mesasInfo] = await Promise.all([
            fetchDashboardResumen(),
            fetchMesas()
        ]);
        
        document.getElementById('kpi-ventas').textContent = `$${data.ventasTotales.toFixed(2)}`;
        document.getElementById('kpi-mesas-ocupadas').textContent = data.mesasOcupadas;
        document.getElementById('kpi-mesas-disponibles').textContent = data.mesasDisponibles;
        document.getElementById('kpi-comandas').textContent = data.totalComandas;
        
        const tbody = document.getElementById('tabla-inventario');
        if (tbody) {
            tbody.innerHTML = '';
            if (!data.itemsVendidos || data.itemsVendidos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888; padding: 2rem;">Aún no hay ventas registradas.</td></tr>';
            } else {
                data.itemsVendidos.sort((a, b) => b.cantidad - a.cantidad).slice(0, 5).forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${escapeHtml(item.nombre)}</strong></td>
                        <td><span style="background:#e0f7fa; color:var(--primary-hover); padding:2px 8px; border-radius:12px; font-weight:bold;">${escapeHtml(item.cantidad)}</span> uds.</td>
                        <td style="font-weight:600; color:var(--success);">$${escapeHtml(item.ingresos.toFixed(2))}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        const container = document.getElementById('mesas-activas-container');
        if (container) {
            container.innerHTML = '';
            const activas = mesasInfo.filter(m => ['Ocupada', 'Esperando Comida', 'Por Pagar'].includes(m.estado));
            if (activas.length === 0) {
                container.innerHTML = '<p style="color:#888; padding: 1rem;">No hay mesas ocupadas actualmente.</p>';
            } else {
                activas.forEach(mesa => {
                    const statusColor = mesa.estado === 'Por Pagar' ? '#3b82f6' : (mesa.estado === 'Esperando Comida' ? '#ef4444' : '#f59e0b');
                    const div = document.createElement('div');
                    div.className = 'mesa-activa-card';
                    div.innerHTML = `
                        <div style="display:flex; justify-content:space-between; width:100%; margin-bottom: 0.5rem;">
                            <h3>Mesa ${escapeHtml(mesa.numero)}</h3>
                            <span style="background:${statusColor}; color:white; padding:2px 6px; font-size:0.75rem; border-radius:12px; font-weight:bold;">${escapeHtml(mesa.estado)}</span>
                        </div>
                        <button class="btn-cobrar" data-mesa-id="${escapeHtml(mesa.id)}" data-mesa-numero="${escapeHtml(mesa.numero)}">Cobrar Cuenta</button>
                    `;
                    div.querySelector('.btn-cobrar').addEventListener('click', () => abrirCheckoutHandler(mesa.id, mesa.numero));
                    container.appendChild(div);
                });
            }
        }
    } catch (e) {
        console.error("Dashboard error:", e);
        showToast('Error cargando el dashboard', 'error');
    }
}

// =============================================
// MODAL DE CHECKOUT (PAGO DIVIDIDO)
// =============================================
async function abrirCheckoutHandler(mesaId, mesaNumero) {
    checkoutMesaId = mesaId;
    document.getElementById('checkout-mesa-label').textContent = `Mesa ${mesaNumero}`;
    document.getElementById('checkout-efectivo').value = '';
    document.getElementById('checkout-tarjeta').value = '';
    document.getElementById('checkout-error').textContent = '';
    document.getElementById('checkout-cambio-box').classList.add('oculto');

    try {
        const comandas = await fetchComandasActivasMesa(mesaId);
        const menuData = await fetchMenu();
        const menuDict = {};
        menuData.forEach(m => { menuDict[m.id] = m; });

        checkoutTotal = comandas.reduce((acc, c) => acc + (c.total || 0), 0);
        document.getElementById('checkout-total').textContent = `$${checkoutTotal.toFixed(2)}`;
        
        // Construir items para el ticket
        checkoutItems = [];
        comandas.forEach(c => {
            if(c.productos && Array.isArray(c.productos)) {
                const counts = {};
                c.productos.forEach(pid => { counts[pid] = (counts[pid] || 0) + 1; });
                for(let pid in counts) {
                    const info = menuDict[pid];
                    checkoutItems.push({
                        nombre: info ? info.nombre : `Platillo #${pid}`,
                        cantidad: counts[pid],
                        precio: info ? info.precio : 0
                    });
                }
            }
        });

        document.getElementById('modal-checkout').classList.remove('oculto');
    } catch(e) {
        showToast('Error cargando datos de la mesa', 'error');
    }
}

function calcularCambioCheckout() {
    const efectivo = parseFloat(document.getElementById('checkout-efectivo').value) || 0;
    const tarjeta = parseFloat(document.getElementById('checkout-tarjeta').value) || 0;
    const pagado = efectivo + tarjeta;
    const cambio = pagado - checkoutTotal;
    const cambioBox = document.getElementById('checkout-cambio-box');
    const errorBox = document.getElementById('checkout-error');

    errorBox.textContent = '';

    if (pagado > 0 && cambio >= 0) {
        cambioBox.classList.remove('oculto');
        document.getElementById('checkout-cambio').textContent = `$${cambio.toFixed(2)}`;
    } else {
        cambioBox.classList.add('oculto');
    }
}

function cerrarCheckout() {
    document.getElementById('modal-checkout').classList.add('oculto');
    checkoutMesaId = null;
    checkoutTotal = 0;
    checkoutItems = [];
}

async function confirmarCobroHandler() {
    const efectivo = parseFloat(document.getElementById('checkout-efectivo').value) || 0;
    const tarjeta = parseFloat(document.getElementById('checkout-tarjeta').value) || 0;
    const pagado = efectivo + tarjeta;
    const errorBox = document.getElementById('checkout-error');

    if (pagado < checkoutTotal) {
        errorBox.textContent = `Monto insuficiente. Faltan $${(checkoutTotal - pagado).toFixed(2)} por cubrir.`;
        return;
    }
    if (efectivo < 0 || tarjeta < 0) {
        errorBox.textContent = 'Los montos de pago no pueden ser negativos.';
        return;
    }
    if (pagado > 999999) {
        errorBox.textContent = 'El monto ingresado es demasiado alto. Verifica los datos.';
        return;
    }

    const btn = document.getElementById('btn-confirmar-cobro');
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        const turnoId = turnoActivo ? turnoActivo.id : null;
        await cobrarMesaConPago(checkoutMesaId, efectivo, tarjeta, turnoId);
        
        const cambio = pagado - checkoutTotal;
        let metodo = 'Efectivo';
        if (tarjeta > 0 && efectivo > 0) metodo = 'Mixto';
        else if (tarjeta > 0) metodo = 'Tarjeta';

        showToast(`¡Cobro exitoso! Cambio: $${cambio.toFixed(2)}`);

        // Imprimir recibo de cliente
        imprimirReciboCliente({
            mesaNumero: document.getElementById('checkout-mesa-label').textContent.replace('Mesa ', ''),
            items: checkoutItems,
            total: checkoutTotal,
            pagoEfectivo: efectivo,
            pagoTarjeta: tarjeta,
            metodo: metodo,
            cambio: cambio,
            fecha: new Date().toLocaleString('es-ES')
        });

        cerrarCheckout();
        cargarDashboard();
    } catch(e) {
        console.error(e);
        showToast('Error al procesar el cobro', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar Cobro';
    }
}

// =============================================
// VISTA: CAJA (Turnos y Corte Z)
// =============================================
async function verificarTurnoActivo() {
    try {
        turnoActivo = await fetchTurnoActivo();
        const cajaCerrada = document.getElementById('caja-cerrada');
        const cajaAbierta = document.getElementById('caja-abierta');
        const corteResultado = document.getElementById('corte-z-resultado');

        if (turnoActivo) {
            cajaCerrada?.classList.add('oculto');
            cajaAbierta?.classList.remove('oculto');
            corteResultado?.classList.add('oculto');

            document.getElementById('caja-info-apertura').textContent = 
                `Abierto: ${new Date(turnoActivo.fecha_apertura).toLocaleString('es-ES')}`;
            document.getElementById('caja-kpi-base').textContent = `$${parseFloat(turnoActivo.base_efectivo).toFixed(2)}`;
            
            // Consultar ventas REALES del turno desglosadas por método de pago
            const { data: cmdTurno } = await supabase.from('comandas')
                .select('pago_efectivo, pago_tarjeta')
                .eq('turno_id', turnoActivo.id)
                .eq('estado', 'Pagada');
            
            let ventasEfectivo = 0;
            let ventasTarjeta = 0;
            (cmdTurno || []).forEach(c => {
                ventasEfectivo += c.pago_efectivo || 0;
                ventasTarjeta += c.pago_tarjeta || 0;
            });

            document.getElementById('caja-kpi-efectivo').textContent = `$${ventasEfectivo.toFixed(2)}`;
            document.getElementById('caja-kpi-tarjeta').textContent = `$${ventasTarjeta.toFixed(2)}`;
            document.getElementById('caja-kpi-total').textContent = `$${(parseFloat(turnoActivo.base_efectivo) + ventasEfectivo + ventasTarjeta).toFixed(2)}`;
        } else {
            cajaCerrada?.classList.remove('oculto');
            cajaAbierta?.classList.add('oculto');
        }
    } catch(e) {
        console.error('Error verificando turno', e);
    }
}

async function abrirCajaHandler() {
    const baseInput = document.getElementById('input-base-caja');
    const base = parseFloat(baseInput.value);
    if (isNaN(base) || base < 0) {
        showToast('Ingresa un monto válido para la base de caja', 'error');
        return;
    }

    try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;
        turnoActivo = await abrirTurnoCaja(userId, base);
        showToast(`Caja abierta con base de $${base.toFixed(2)}`);
        verificarTurnoActivo();
    } catch(e) {
        showToast(e.message || 'Error abriendo caja', 'error');
    }
}

async function corteZHandler() {
    if (!turnoActivo) return;
    if (!confirm('¿Seguro que deseas realizar el Corte Z? Esto cerrará el turno de caja del día.')) return;

    try {
        const resultado = await cerrarTurnoCaja(turnoActivo.id);
        
        const baseInicial = parseFloat(turnoActivo.base_efectivo);
        const efectivoEsperado = baseInicial + resultado.totalEfectivo;

        document.getElementById('caja-abierta').classList.add('oculto');
        const corteDiv = document.getElementById('corte-z-resultado');
        corteDiv.classList.remove('oculto');

        document.getElementById('corte-z-detalle').innerHTML = `
            <div class="kpi-grid" style="margin-bottom:1.5rem;">
                <div class="kpi-card">
                    <h3>Base Inicial</h3>
                    <p class="counter" style="color:#3b82f6;">$${baseInicial.toFixed(2)}</p>
                </div>
                <div class="kpi-card stat-ventas">
                    <h3>Ventas Efectivo</h3>
                    <p class="counter">$${resultado.totalEfectivo.toFixed(2)}</p>
                </div>
                <div class="kpi-card">
                    <h3>Ventas Tarjeta</h3>
                    <p class="counter" style="color:var(--primary-action);">$${resultado.totalTarjeta.toFixed(2)}</p>
                </div>
                <div class="kpi-card">
                    <h3>Total Ventas</h3>
                    <p class="counter" style="color:var(--accent-warning);">$${resultado.totalVentas.toFixed(2)}</p>
                </div>
            </div>
            <div style="background:#f0fdf4; border:2px solid #86efac; border-radius:12px; padding:1.5rem; text-align:center;">
                <div style="font-size:0.9rem; color:#555; margin-bottom:0.5rem;">Efectivo esperado en caja</div>
                <div style="font-size:2.5rem; font-weight:800; color:#16a34a;">$${efectivoEsperado.toFixed(2)}</div>
                <div style="font-size:0.8rem; color:#888; margin-top:0.5rem;">Base ($${baseInicial.toFixed(2)}) + Ventas Efectivo ($${resultado.totalEfectivo.toFixed(2)})</div>
            </div>
        `;

        showToast('Corte Z completado exitosamente');
        turnoActivo = null;
    } catch(e) {
        console.error(e);
        showToast('Error realizando el Corte Z', 'error');
    }
}

// =============================================
// VISTA: INVENTARIO
// =============================================
async function cargarInventario() {
    try {
        const menu = await fetchMenu();
        const tbody = document.getElementById('tabla-catalogo');
        if(!tbody) return;

        tbody.innerHTML = '';
        
        menu.forEach(item => {
            const tr = document.createElement('tr');
            
            const tdId = document.createElement('td'); tdId.textContent = `#${item.id}`;
            const tdNombre = document.createElement('td'); 
            const strong = document.createElement('strong'); strong.textContent = item.nombre;
            tdNombre.appendChild(strong);
            
            const tdCat = document.createElement('td');
            const spanCat = document.createElement('span');
            spanCat.className = 'cat-chip';
            spanCat.textContent = item.categoria || 'Sin categoría';
            tdCat.appendChild(spanCat);

            const tdPrecio = document.createElement('td'); tdPrecio.textContent = `$${item.precio.toFixed(2)}`;
            
            const tdAcciones = document.createElement('td');
            const btnElim = document.createElement('button');
            btnElim.className = 'btn-eliminar';
            btnElim.textContent = 'Eliminar';
            btnElim.addEventListener('click', () => eliminarProductoHandler(item.id));
            tdAcciones.appendChild(btnElim);

            tr.appendChild(tdId);
            tr.appendChild(tdNombre);
            tr.appendChild(tdCat);
            tr.appendChild(tdPrecio);
            tr.appendChild(tdAcciones);

            tbody.appendChild(tr);
        });
    } catch(e) {
        showToast('Error cargando catálogo', 'error');
    }
}

function abrirModalNuevoProducto() {
    document.getElementById('modal-producto').classList.remove('oculto');
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-precio').value = '';
    document.getElementById('prod-categoria').value = 'Plato Principal';
    document.getElementById('prod-nombre').focus();
}

function cerrarModal() {
    document.getElementById('modal-producto').classList.add('oculto');
}

async function guardarProducto() {
    const nombre = document.getElementById('prod-nombre').value.trim();
    const precio = parseFloat(document.getElementById('prod-precio').value);
    const categoria = document.getElementById('prod-categoria').value;
    
    if(!nombre || isNaN(precio) || !categoria) {
        showToast('Llena todos los campos obligatorios', 'error');
        return;
    }
    if (nombre.length > 100) {
        showToast('El nombre no puede superar 100 caracteres', 'error');
        return;
    }
    if (precio <= 0 || precio > 99999) {
        showToast('El precio debe estar entre $0.01 y $99,999', 'error');
        return;
    }
    
    try {
        await crearProductoMenu({ nombre, precio, categoria });
        showToast('Producto añadido exitosamente');
        cerrarModal();
    } catch(e) {
        showToast('Error añadiendo el producto', 'error');
    }
}

async function eliminarProductoHandler(id) {
    if(!confirm('¿Eliminar producto del sistema permanentemente?')) return;
    try {
        await eliminarProductoMenu(id);
        showToast('Producto eliminado');
    } catch(e) {
        showToast('No se pudo eliminar el producto', 'error');
    }
}

// =============================================
// VISTA: REPORTES
// =============================================
async function cargarReportes() {
    try {
        const historial = await fetchHistorialComandas();
        const tbody = document.getElementById('tabla-historial');
        if(!tbody) return;

        tbody.innerHTML = '';
        
        if(historial.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:#888;">No hay historial de comandas pagadas.</td></tr>';
            return;
        }

        historial.forEach(c => {
            const tr = document.createElement('tr');
            const fecha = new Date(c.created_at).toLocaleString('es-ES');
            const nMesa = c.mesas ? c.mesas.numero : (c.mesa_id || 'N/A');
            const metodo = c.metodo_pago || 'N/A';
            
            tr.innerHTML = `
                <td style="color:#666; font-size:0.9rem;">${escapeHtml(fecha)}</td>
                <td><strong>Mesa ${escapeHtml(nMesa)}</strong></td>
                <td style="color:var(--success); font-weight:600;">$${escapeHtml(c.total.toFixed(2))}</td>
                <td>
                    <span class="cat-chip">${escapeHtml(metodo)}</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        console.error(e);
        showToast('Error cargando historial', 'error');
    }
}

// =============================================
// EVENT LISTENERS (reemplazan onclick inline)
// =============================================
document.getElementById('btn-nuevo-producto')?.addEventListener('click', abrirModalNuevoProducto);
document.getElementById('btn-cancelar-producto')?.addEventListener('click', cerrarModal);
document.getElementById('btn-guardar-producto')?.addEventListener('click', guardarProducto);
document.getElementById('btn-abrir-caja')?.addEventListener('click', abrirCajaHandler);
document.getElementById('btn-corte-z')?.addEventListener('click', corteZHandler);
document.getElementById('btn-cancelar-checkout')?.addEventListener('click', cerrarCheckout);
document.getElementById('btn-confirmar-cobro')?.addEventListener('click', confirmarCobroHandler);
document.getElementById('checkout-efectivo')?.addEventListener('input', calcularCambioCheckout);
document.getElementById('checkout-tarjeta')?.addEventListener('input', calcularCambioCheckout);
