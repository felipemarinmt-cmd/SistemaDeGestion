// app.js - Lógica principal del módulo de Comandas (Móvil)

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return alert(message);
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Iconos SVG para el toast
    const iconSuccess = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    const iconError = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    
    toast.innerHTML = `<span class="toast-icon-wrapper" style="display:flex; align-items:center;">${type === 'success' ? iconSuccess : iconError}</span> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideUpFade 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Estado Global de la App en Memoria
    const state = {
        mesas: [],
        menu: [],
        mesaSeleccionada: null,
        carritoActual: [], // Arreglo de { idProducto, nombre, precio, cantidad }
        total: 0,
        categoriaSeleccionada: 'Todas'
    };

    // 2. Referencias a Elementos del DOM
    const mesasContainer = document.getElementById('mesas-container');
    const menuSection = document.getElementById('menu-section');
    const mesaActivaLabel = document.getElementById('mesa-activa-label');
    const productosContainer = document.getElementById('productos-container');
    const floatingCart = document.getElementById('floating-cart');
    const cartTotal = document.getElementById('cart-total');
    const cartMesaLabel = document.getElementById('cart-mesa-label');
    const btnEnviarComanda = document.getElementById('btn-enviar-comanda');
    const statusIndicador = document.getElementById('status-indicador');

    // 3. Inicialización
    async function init() {
        const iconConectando = `<svg class="status-icon pulse-anim" width="10" height="10" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#EAB308"/></svg>`;
        const iconActivo = `<svg class="status-icon" width="10" height="10" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#22C55E"/></svg>`;
        
        statusIndicador.style.display = 'flex';
        statusIndicador.style.alignItems = 'center';
        statusIndicador.style.gap = '6px';
        statusIndicador.innerHTML = `${iconConectando} Conectando...`;
        
        await fetchDatosIniciales();
        renderMesas();
        
        // Conexión WebSockets
        const socket = io();
        socket.on('connect', () => {
            statusIndicador.innerHTML = `${iconActivo} Activo`;
        });
        socket.on('disconnect', () => {
            statusIndicador.innerHTML = `${iconConectando} Re-conectando...`;
        });
        
        socket.on('update_mesas', async () => {
            const resMesas = await fetch('/api/mesas');
            state.mesas = await resMesas.json();
            renderMesas();
            
            // Si la vista de menú está activa y la mesa actual fue liberada por el admin
            if (state.mesaSeleccionada) {
                const mesaAct = state.mesas.find(m => m.id === state.mesaSeleccionada);
                if (mesaAct && mesaAct.estado === 'Disponible') {
                    const cuentaPreviaDiv = document.getElementById('cuenta-previa');
                    if (cuentaPreviaDiv) cuentaPreviaDiv.style.display = 'none';
                }
            }
        });
        
        socket.on('update_menu', async () => {
            const resMenu = await fetch('/api/menu');
            state.menu = await resMenu.json();
            renderCategories();
            renderMenu();
        });
        
        socket.on('comanda_lista', (data) => {
            showToast(`¡La orden de la Mesa ${data.mesa} está LISTA en cocina!`, 'success');
        });
    }

    // Llamadas al backend API
    async function fetchDatosIniciales() {
        try {
            const [resMesas, resMenu] = await Promise.all([
                fetch('/api/mesas'),
                fetch('/api/menu')
            ]);
            state.mesas = await resMesas.json();
            state.menu = await resMenu.json();
        } catch (error) {
            console.error('Error al conectar:', error);
            showToast('Error cargando datos del servidor.', 'error');
        }
    }

    // 4. Renderizado Visual
    function renderMesas() {
        mesasContainer.innerHTML = '';
        state.mesas.forEach(mesa => {
            const btn = document.createElement('button');
            
            // Lógica visual basada en variables CSS del proyecto
            const estadoClase = mesa.estado === 'Disponible' ? 'mesa-disponible' : 'mesa-ocupada';
            btn.className = `mesa-btn ${estadoClase}`;
            
            // Resaltar la seleccionada
            if (state.mesaSeleccionada === mesa.id) {
                btn.classList.add('mesa-seleccionada');
            }

            // Etiqueta de estado
            const estadoLabel = mesa.estado;

            btn.innerHTML = `
                M${mesa.numero}
                <span class="mesa-label">${estadoLabel}</span>
            `;

            btn.addEventListener('click', () => uiSeleccionarMesa(mesa.id));
            mesasContainer.appendChild(btn);
        });
    }

    function renderCategories() {
        const filtersDiv = document.getElementById('category-filters');
        filtersDiv.innerHTML = '';
        const categorias = ['Todas', ...new Set(state.menu.map(m => m.categoria || 'Sin categoría'))];
        
        categorias.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `chip ${state.categoriaSeleccionada === cat ? 'active' : ''}`;
            btn.textContent = cat;
            btn.addEventListener('click', () => {
                state.categoriaSeleccionada = cat;
                renderCategories();
                renderMenu();
            });
            filtersDiv.appendChild(btn);
        });
        filtersDiv.style.display = 'flex';
    }

    function renderMenu() {
        productosContainer.innerHTML = '';
        const productosMostrados = state.categoriaSeleccionada === 'Todas' ? state.menu : state.menu.filter(p => (p.categoria || 'Sin categoría') === state.categoriaSeleccionada);
        
        productosMostrados.forEach(prod => {
            const item = document.createElement('div');
            item.className = 'producto-item';
            
            const enCarritoObj = state.carritoActual.find(i => i.idProducto === prod.id);
            const qty = enCarritoObj ? enCarritoObj.cantidad : 0;
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'producto-info';
            
            const h3 = document.createElement('h3');
            h3.textContent = prod.nombre;
            const precioDiv = document.createElement('div');
            precioDiv.className = 'producto-precio';
            precioDiv.textContent = `$${prod.precio.toFixed(2)}`;
            
            infoDiv.appendChild(h3);
            infoDiv.appendChild(precioDiv);
            
            const actionsDiv = document.createElement('div');
            if (qty > 0) {
                actionsDiv.className = 'stepper-controls';
                
                const btnMinus = document.createElement('button');
                btnMinus.className = 'stepper-btn minus';
                btnMinus.textContent = '-';
                btnMinus.addEventListener('click', () => restarProducto(prod.id));
                
                const spanQty = document.createElement('span');
                spanQty.textContent = qty;
                
                const btnPlus = document.createElement('button');
                btnPlus.className = 'stepper-btn';
                btnPlus.textContent = '+';
                btnPlus.addEventListener('click', () => agregarProducto(prod));
                
                actionsDiv.appendChild(btnMinus);
                actionsDiv.appendChild(spanQty);
                actionsDiv.appendChild(btnPlus);
            } else {
                const btnAdd = document.createElement('button');
                btnAdd.className = 'add-btn';
                btnAdd.textContent = '+';
                btnAdd.addEventListener('click', () => agregarProducto(prod));
                actionsDiv.appendChild(btnAdd);
            }
            
            item.appendChild(infoDiv);
            item.appendChild(actionsDiv);
            productosContainer.appendChild(item);
        });
    }

    // 5. Interacciones
    async function uiSeleccionarMesa(idMesa) {
        state.mesaSeleccionada = idMesa;
        // Al interactuar con otra mesa, limpiamos el pedido activo temporar
        state.carritoActual = []; 
        state.categoriaSeleccionada = 'Todas';
        actualizarTotal();
        
        renderMesas(); // Update visual state

        const mesaSeleccionadaObj = state.mesas.find(m => m.id === idMesa);
        mesaActivaLabel.textContent = mesaSeleccionadaObj.numero;
        cartMesaLabel.textContent = mesaSeleccionadaObj.numero;
        
        const cuentaPreviaDiv = document.getElementById('cuenta-previa');
        if (cuentaPreviaDiv) cuentaPreviaDiv.style.display = 'none';

        if (mesaSeleccionadaObj.estado === 'Ocupada') {
            try {
                const res = await fetch(`/api/comandas/activas/${idMesa}`);
                const data = await res.json();
                if (data.total > 0 && cuentaPreviaDiv) {
                    cuentaPreviaDiv.style.display = 'block';
                    cuentaPreviaDiv.innerHTML = `<strong>Cuenta Registrada:</strong> $${data.total.toFixed(2)}<br><small style="color:#666">Nuevos productos se sumarán a la cuenta existente.</small>`;
                }
            } catch(e) { console.error('Error cargando cuenta previa', e); }
        }
        
        menuSection.classList.add('active');
        renderCategories();
        renderMenu();
        
        // Auto scroll en móvil
        setTimeout(() => menuSection.scrollIntoView({ behavior: 'smooth' }), 100);
    }

    function restarProducto(idProducto) {
        const itemExistente = state.carritoActual.find(i => i.idProducto === idProducto);
        if (itemExistente) {
            itemExistente.cantidad -= 1;
            if (itemExistente.cantidad <= 0) {
                state.carritoActual = state.carritoActual.filter(i => i.idProducto !== idProducto);
            }
        }
        actualizarTotal();
        renderMenu();
    }

    function agregarProducto(producto) {
        const itemExistente = state.carritoActual.find(i => i.idProducto === producto.id);
        
        if (itemExistente) {
            itemExistente.cantidad += 1;
        } else {
            state.carritoActual.push({
                idProducto: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                cantidad: 1
            });
        }
        
        actualizarTotal();
        renderMenu(); // Actualiza los contadores visualmente en el DOM
    }

    function actualizarTotal() {
        state.total = state.carritoActual.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
        cartTotal.textContent = state.total.toFixed(2);
        
        // Mostrar/ocultar carrito flotante basado en si hay total
        if (state.total > 0) {
            floatingCart.classList.add('visible');
        } else {
            floatingCart.classList.remove('visible');
        }
    }

    // 6. Enviar Pedido
    btnEnviarComanda.addEventListener('click', async () => {
        if (state.carritoActual.length === 0) return;

        btnEnviarComanda.disabled = true;
        btnEnviarComanda.textContent = 'Procesando...';

        // Expandir productos basado en cantidad
        const productosIds = [];
        state.carritoActual.forEach(item => {
            for (let i = 0; i < item.cantidad; i++) {
                productosIds.push(item.idProducto);
            }
        });

        const payload = {
            mesaId: state.mesaSeleccionada,
            productos: productosIds
        };

        try {
            const response = await fetch('/api/comandas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error('Error al enviar la orden');

            // Refrescar mesas desde el servidor
            const mesasRes = await fetch('/api/mesas');
            state.mesas = await mesasRes.json();

            showToast(`¡Orden enviada exitosamente! Total: $${state.total.toFixed(2)}`);
            
            // Clean up visual
            state.carritoActual = [];
            state.mesaSeleccionada = null;
            menuSection.classList.remove('active');
            actualizarTotal();
            renderMesas();
            
            // Volver arriba de la página
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            showToast('Error al enviar la orden.', 'error');
        } finally {
            btnEnviarComanda.disabled = false;
            btnEnviarComanda.innerHTML = 'Enviar Orden';
        }
    });

    // Iniciar aplicación
    init();
});
