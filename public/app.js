// app.js - Lógica principal del módulo de Comandas (Móvil)

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return alert(message);
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '🔴'}</span> ${message}`;
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
        total: 0
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
        statusIndicador.textContent = '🟡 Conectando...';
        await fetchDatosIniciales();
        renderMesas();
        statusIndicador.textContent = '🟢 Activo';
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

    function renderMenu() {
        productosContainer.innerHTML = '';
        state.menu.forEach(prod => {
            const item = document.createElement('div');
            item.className = 'producto-item';
            
            // Identificar si existe pre-seleccionado en carrito
            const enCarritoObj = state.carritoActual.find(i => i.idProducto === prod.id);
            const contador = enCarritoObj ? ` <span style="font-size:0.8rem; color:#666">x${enCarritoObj.cantidad}</span>` : '';
            
            item.innerHTML = `
                <div class="producto-info">
                    <h3>${prod.nombre}${contador}</h3>
                    <div class="producto-precio">$${prod.precio.toFixed(2)}</div>
                </div>
                <button class="add-btn" aria-label="Añadir">+</button>
            `;

            item.querySelector('.add-btn').addEventListener('click', () => agregarProducto(prod));
            productosContainer.appendChild(item);
        });
    }

    // 5. Interacciones
    async function uiSeleccionarMesa(idMesa) {
        state.mesaSeleccionada = idMesa;
        // Al interactuar con otra mesa, limpiamos el pedido activo temporar
        state.carritoActual = []; 
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
        renderMenu();
        
        // Auto scroll en móvil
        setTimeout(() => menuSection.scrollIntoView({ behavior: 'smooth' }), 100);
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
