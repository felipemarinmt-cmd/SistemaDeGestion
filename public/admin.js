// admin.js - Lógica Administrativa Premium y SPA

// Utilidades: Toasts (Premium Notifications)
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> ${message}`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Utilidades: Dispositivo
function verificarDispositivo() {
    if (window.innerWidth < 768) {
        document.getElementById('pantalla-bloqueo').classList.remove('oculto');
        document.getElementById('app-container').classList.add('oculto');
    } else {
        document.getElementById('pantalla-bloqueo').classList.add('oculto');
        document.getElementById('app-container').classList.remove('oculto');
    }
}

window.addEventListener('resize', verificarDispositivo);
window.addEventListener('load', () => {
    verificarDispositivo();
    cargarDashboard();
    initSpaRouter();
    
    // Auto-refresh data cada 10 seg
    setInterval(() => {
        if(currentView === 'view-dashboard') cargarDashboard();
        if(currentView === 'view-reportes') cargarReportes();
    }, 10000);
});

// Enrutador SPA
let currentView = 'view-dashboard';
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
                document.getElementById('page-subtitle').textContent = "Monitoreo en tiempo real";
                cargarDashboard();
            } else if (target === 'view-inventario') {
                document.getElementById('page-title').textContent = "Inventario y Catálogo";
                document.getElementById('page-subtitle').textContent = "Administra los productos de tu negocio";
                cargarInventario();
            } else if (target === 'view-reportes') {
                document.getElementById('page-title').textContent = "Reportes e Historial";
                document.getElementById('page-subtitle').textContent = "Comandas cobradas y resumen histórico";
                cargarReportes();
            }
        });
    });
}

// Boton manual de actualizacion
document.getElementById('btn-actualizar').addEventListener('click', () => {
    const btn = document.getElementById('btn-actualizar');
    btn.innerHTML = '↻ Actualizando...';
    btn.disabled = true;
    
    let promise;
    if (currentView === 'view-dashboard') promise = cargarDashboard();
    else if (currentView === 'view-inventario') promise = cargarInventario();
    else if (currentView === 'view-reportes') promise = cargarReportes();
    else promise = Promise.resolve();

    promise.then(() => {
        setTimeout(() => {
            btn.innerHTML = '↻ Actualizar Datos';
            btn.disabled = false;
        }, 500);
    });
});

// VISTA: DASHBOARD
async function cargarDashboard() {
    try {
        const [resResumen, resMesas] = await Promise.all([
            fetch('/api/admin/resumen'),
            fetch('/api/mesas')
        ]);
        if (!resResumen.ok) throw new Error('Network ERROR');
        
        const data = await resResumen.json();
        const mesasInfo = await resMesas.json();
        
        // KPIs (Counter animation simulada seteando el txt)
        document.getElementById('kpi-ventas').textContent = `$${data.ventasTotales.toFixed(2)}`;
        document.getElementById('kpi-mesas-ocupadas').textContent = data.mesasOcupadas;
        document.getElementById('kpi-mesas-disponibles').textContent = data.mesasDisponibles;
        document.getElementById('kpi-comandas').textContent = data.totalComandas;
        
        // Top Sold Info
        const tbody = document.getElementById('tabla-inventario');
        tbody.innerHTML = '';
        if (data.itemsVendidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888; padding: 2rem;">Aún no hay ventas registradas.</td></tr>';
        } else {
            const itemsOrdenados = data.itemsVendidos.sort((a, b) => b.cantidad - a.cantidad).slice(0, 5); // top 5
            itemsOrdenados.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${item.nombre}</strong></td>
                    <td><span style="background:#e0f7fa; color:var(--primary-hover); padding:2px 8px; border-radius:12px; font-weight:bold;">${item.cantidad}</span> uds.</td>
                    <td style="font-weight:600; color:var(--success);">$${item.ingresos.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Active Tables
        const container = document.getElementById('mesas-activas-container');
        if (container) {
            container.innerHTML = '';
            const activas = mesasInfo.filter(m => m.estado === 'Ocupada');
            if (activas.length === 0) {
                container.innerHTML = '<p style="color:#888; padding: 1rem;">No hay mesas ocupadas actualmente.</p>';
            } else {
                activas.forEach(mesa => {
                    const div = document.createElement('div');
                    div.className = 'mesa-activa-card';
                    div.innerHTML = `
                        <h3>Mesa ${mesa.numero}</h3>
                        <button class="btn-cobrar" onclick="cobrarMesa(${mesa.id})">Cobrar Cuenta</button>
                    `;
                    container.appendChild(div);
                });
            }
        }
    } catch (e) {
        console.error(e);
        showToast('Error cargando el dashboard', 'error');
    }
}

window.cobrarMesa = async function(id) {
    if (!confirm('¿Seguro que deseas cobrar y liberar esta mesa?')) return;
    try {
        const res = await fetch(`/api/mesas/${id}/cobrar`, { method: 'POST' });
        if(res.ok) {
            showToast(`Mesa ${id} cobrada exitosamente`);
            cargarDashboard();
        } else throw new Error();
    } catch(e) {
        showToast('Error al cobrar la mesa', 'error');
    }
}

// VISTA: INVENTARIO
async function cargarInventario() {
    try {
        const res = await fetch('/api/menu');
        if(!res.ok) throw new Error();
        const menu = await res.json();
        const tbody = document.getElementById('tabla-catalogo');
        tbody.innerHTML = '';
        
        menu.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${item.id}</td>
                <td><strong>${item.nombre}</strong></td>
                <td>$${item.precio.toFixed(2)}</td>
                <td>
                    <button class="btn-eliminar" onclick="eliminarProducto(${item.id})">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        showToast('Error cargando catálogo', 'error');
    }
}

window.abrirModalNuevoProducto = function() {
    document.getElementById('modal-producto').classList.remove('oculto');
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-precio').value = '';
    document.getElementById('prod-nombre').focus();
}
window.cerrarModal = function() {
    document.getElementById('modal-producto').classList.add('oculto');
}
window.guardarProducto = async function() {
    const nombre = document.getElementById('prod-nombre').value.trim();
    const precio = document.getElementById('prod-precio').value;
    
    if(!nombre || !precio) {
        showToast('Llena todos los campos obligatorios', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/menu', {
            method: 'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ nombre, precio })
        });
        if(res.ok) {
            showToast('Producto añadido exitosamente');
            cerrarModal();
            cargarInventario();
        } else throw new Error();
    } catch(e) {
        showToast('Error añadiendo el producto', 'error');
    }
}

window.eliminarProducto = async function(id) {
    if(!confirm('¿Eliminar producto del sistema permanentemente?')) return;
    try {
        const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
        if(res.ok) {
            showToast('Producto eliminado');
            cargarInventario();
        } else throw new Error();
    } catch(e) {
        showToast('No se pudo eliminar el producto', 'error');
    }
}

// VISTA: REPORTES
async function cargarReportes() {
    try {
        const res = await fetch('/api/comandas/historial');
        const historial = await res.json();
        const tbody = document.getElementById('tabla-historial');
        tbody.innerHTML = '';
        
        if(historial.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:#888;">No hay historial de comandas cobradas.</td></tr>';
            return;
        }

        historial.forEach(c => {
            const tr = document.createElement('tr');
            const fecha = new Date(c.fecha).toLocaleString('es-ES');
            const lisItems = c.items.map(i => i.nombre).join(', ');
            
            tr.innerHTML = `
                <td style="color:#666; font-size:0.9rem;">${fecha}</td>
                <td><strong>Mesa ${c.mesaId}</strong></td>
                <td style="color:var(--success); font-weight:600;">$${c.total.toFixed(2)}</td>
                <td style="font-size:0.85rem; color:#555; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${lisItems}">
                    ${lisItems}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        showToast('Error cargando historial', 'error');
    }
}
