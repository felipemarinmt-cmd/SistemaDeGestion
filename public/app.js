// app.js - App POS Móvil y Manejo de Estados / Offline

import { state, mutators } from './state.js';
import { fetchMesas, fetchMenu, fetchCuentaPrevia, enviarComanda, actualizarEstadoMesa, supabase } from './api.js';
import { renderMesas, renderCategories, renderMenu, showToast } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const mesaActivaLabel = document.getElementById('mesa-activa-label');
    const menuSection = document.getElementById('menu-section');
    const cartTotal = document.getElementById('cart-total');
    const cartMesaLabel = document.getElementById('cart-mesa-label');
    const floatingCart = document.getElementById('floating-cart');
    const btnEnviarComanda = document.getElementById('btn-enviar-comanda');
    const statusIndicador = document.getElementById('status-indicador');
    
    // Contenedor dinámico de acciones de máquina de estado en la cabecera del menú
    let stateActionContainer = document.getElementById('state-actions');
    if(!stateActionContainer) {
        stateActionContainer = document.createElement('div');
        stateActionContainer.id = 'state-actions';
        stateActionContainer.style.marginBottom = '1.5rem';
        stateActionContainer.style.marginTop = '-0.5rem';
        menuSection.insertBefore(stateActionContainer, document.getElementById('category-filters'));
    }

    async function init() {
        if(statusIndicador) {
            statusIndicador.style.display = 'flex';
            statusIndicador.style.alignItems = 'center';
            statusIndicador.style.gap = '6px';
            statusIndicador.innerHTML = `<span style="color:#fbbf24">● Cargando DB...</span>`;
        }
        
        try {
            const [mesas, menu] = await Promise.all([fetchMesas(), fetchMenu()]);
            mutators.setMesas(mesas || []);
            mutators.setMenu(menu || []);
            renderMesas(manejarSeleccionMesa);
            
            if (statusIndicador) statusIndicador.innerHTML = navigator.onLine ? `<span style="color:#4ade80">● Conectado</span>` : `<span style="color:#ef4444">● Offline</span>`;
        } catch (error) {
            showToast('Error de red inicial', 'error');
        }

        // Supabase Realtime
        const channel = supabase.channel('pos-updates');
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
            softRefreshMesas();
        });
        channel.subscribe();
        window.addEventListener('beforeunload', () => channel.unsubscribe());

        // Listeners Offline
        window.addEventListener('online', () => {
            if(statusIndicador) statusIndicador.innerHTML = `<span style="color:#4ade80">● Conectado</span>`;
            sincronizarComandasOffline();
        });
        window.addEventListener('offline', () => {
            if(statusIndicador) statusIndicador.innerHTML = `<span style="color:#ef4444">● Offline</span>`;
        });
    }

    async function softRefreshMesas() {
        try {
            const mesas = await fetchMesas();
            mutators.setMesas(mesas || []);
            renderMesas(manejarSeleccionMesa);
            
            // Si hay una caja fuerte abierta y la cambiaron, reflejarlo indirectamente
            if(state.mesaSeleccionada) {
                const mesaAct = state.mesas.find(m => m.id === state.mesaSeleccionada);
                if(mesaAct) inyectarAccionesPorEstado(mesaAct);
            }
        } catch(e) {
            console.error('Error refrescando mesas:', e);
        }
    }

    async function manejarSeleccionMesa(mesaObj) {
        const idMesa = mesaObj.id;
        mutators.seleccionarMesa(idMesa);
        actualizarUI();
        renderMesas(manejarSeleccionMesa); 

        if (mesaActivaLabel) mesaActivaLabel.textContent = mesaObj.numero;
        if (cartMesaLabel) cartMesaLabel.textContent = mesaObj.numero;

        const cuentaPreviaDiv = document.getElementById('cuenta-previa');
        if (cuentaPreviaDiv) cuentaPreviaDiv.style.display = 'none';

        if(menuSection) menuSection.classList.add('active');
        
        inyectarAccionesPorEstado(mesaObj, cuentaPreviaDiv);

        renderCategories(manejarCambioCategoria);
        renderMenu(manejarAgregar, manejarRestar);

        // Si la mesa está Limpiando, NO mostramos menú de comidas, solo acción
        if(mesaObj.estado === 'Limpiando' || mesaObj.estado === 'Por Pagar') {
            document.getElementById('category-filters').style.display = 'none';
            document.getElementById('productos-container').style.display = 'none';
        } else {
            document.getElementById('category-filters').style.display = 'flex';
            document.getElementById('productos-container').style.display = 'grid';
        }

        setTimeout(() => menuSection && menuSection.scrollIntoView({ behavior: 'smooth' }), 100);
    }

    async function inyectarAccionesPorEstado(mesaObj, cuentaPreviaDiv = document.getElementById('cuenta-previa')) {
        stateActionContainer.innerHTML = ''; // reset
        
        // Reglas de la Máquina de Estados
        if (mesaObj.estado === 'Limpiando') {
            const btnDisp = document.createElement('button');
            btnDisp.className = 'btn-kds';
            btnDisp.style.backgroundColor = '#10b981';
            btnDisp.style.width = '100%';
            btnDisp.textContent = 'Marcar Mesa Lista (Disponible)';
            btnDisp.onclick = () => procesarCambioEstadoLocal(mesaObj.id, 'Disponible');
            stateActionContainer.appendChild(btnDisp);
        }

        if (mesaObj.estado === 'Ocupada' || mesaObj.estado === 'Esperando Comida') {
            try {
                // Consultamos deuda
                const cuentaInfo = await fetchCuentaPrevia(mesaObj.id);
                if (cuentaInfo && cuentaInfo.total > 0 && cuentaPreviaDiv) {
                    cuentaPreviaDiv.style.display = 'block';
                    cuentaPreviaDiv.innerHTML = `<strong>Cuenta Activa:</strong> $${cuentaInfo.total.toFixed(2)}`;
                    
                    const btnCuenta = document.createElement('button');
                    btnCuenta.className = 'btn-kds';
                    btnCuenta.style.backgroundColor = '#3b82f6';
                    btnCuenta.style.marginTop = '10px';
                    btnCuenta.style.width = '100%';
                    btnCuenta.textContent = 'Imprimir y Pedir Cuenta (Azul)';
                    btnCuenta.onclick = () => procesarCambioEstadoLocal(mesaObj.id, 'Por Pagar');
                    cuentaPreviaDiv.appendChild(btnCuenta);
                }
            } catch(e) {
                console.error('Error consultando cuenta previa:', e);
            }
        }
    }

    async function procesarCambioEstadoLocal(idMesa, nuevoEstado) {
        try {
            await actualizarEstadoMesa(idMesa, nuevoEstado);
            showToast(`Estado cambiado a ${nuevoEstado}`);
            softRefreshMesas(); // auto refresh
            if(menuSection) menuSection.classList.remove('active');
        } catch(e) { showToast('Error al cambiar de estado', 'error'); }
    }

    function manejarCambioCategoria(cat) {
        mutators.setCategoriaSeleccionada(cat);
        renderCategories(manejarCambioCategoria);
        renderMenu(manejarAgregar, manejarRestar);
    }

    function manejarAgregar(producto) {
        mutators.addProductoAlCarrito(producto);
        actualizarUI();
        renderMenu(manejarAgregar, manejarRestar);
    }

    function manejarRestar(idProducto) {
        mutators.restarProductoDelCarrito(idProducto);
        actualizarUI();
        renderMenu(manejarAgregar, manejarRestar);
    }

    function actualizarUI() {
        if(cartTotal) cartTotal.textContent = state.total.toFixed(2);
        if(floatingCart) {
            if (state.total > 0) {
                floatingCart.classList.add('visible');
            } else {
                floatingCart.classList.remove('visible');
            }
        }
    }

    // FLUJO MODO OFFLINE AL ENVIAR
    if (btnEnviarComanda) {
        btnEnviarComanda.addEventListener('click', async () => {
            if (state.carritoActual.length === 0) return;

            const productosIds = [];
            state.carritoActual.forEach(item => {
                for(let i=0; i < item.cantidad; i++) productosIds.push(item.idProducto);
            });

            const payload = {
                mesaId: state.mesaSeleccionada,
                productos: productosIds,
                total: state.total,
                ts: new Date().toISOString()
            };

            // Evaluar conectividad
            if (!navigator.onLine) {
                // MODO OFFLINE
                let queue = JSON.parse(localStorage.getItem('comandasOffline') || '[]');
                queue.push(payload);
                localStorage.setItem('comandasOffline', JSON.stringify(queue));
                
                showToast(`¡Sin Conexión! Orden M${state.mesaSeleccionada} guardada en caché.`, 'warning');
                limpiarVisual();
                return;
            }

            // MODO ONLINE BÁSICO
            btnEnviarComanda.disabled = true;
            btnEnviarComanda.textContent = 'Procesando...';
            try {
                await enviarComanda(payload.mesaId, payload.productos, payload.total);
                await actualizarEstadoMesa(payload.mesaId, 'Esperando Comida'); // Cambio status
                
                showToast(`¡Orden enviada! Total: $${payload.total.toFixed(2)}`);
                limpiarVisual();
                softRefreshMesas();
            } catch (error) {
                // Fallback dinámico
                let queue = JSON.parse(localStorage.getItem('comandasOffline') || '[]');
                queue.push(payload);
                localStorage.setItem('comandasOffline', JSON.stringify(queue));
                showToast(`El servidor falló. Orden guardada en modo offline.`, 'warning');
                limpiarVisual();
            } finally {
                btnEnviarComanda.disabled = false;
                btnEnviarComanda.innerHTML = 'Enviar Orden';
            }
        });
    }

    function limpiarVisual() {
        mutators.limpiarPedido();
        actualizarUI();
        if(menuSection) menuSection.classList.remove('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function sincronizarComandasOffline() {
        let queue = JSON.parse(localStorage.getItem('comandasOffline') || '[]');
        if(queue.length === 0) return;

        showToast(`Sincronizando ${queue.length} ordenes locales...`);
        let fallos = [];

        for(let i = 0; i < queue.length; i++) {
            const p = queue[i];
            try {
                await enviarComanda(p.mesaId, p.productos, p.total);
                await actualizarEstadoMesa(p.mesaId, 'Esperando Comida');
            } catch(e) {
                console.error("Fallo sincro", e);
                fallos.push(p);
            }
        }

        if(fallos.length === 0) {
            localStorage.removeItem('comandasOffline');
            showToast(`¡Sincronización completa sin errores!`);
            softRefreshMesas();
        } else {
            localStorage.setItem('comandasOffline', JSON.stringify(fallos));
            showToast(`${fallos.length} ordenes no pudieron sincronizarse.`, 'error');
        }
    }

    init();
});
