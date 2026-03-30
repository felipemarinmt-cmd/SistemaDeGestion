// state.js - Estado Global de la App en Memoria

export const state = {
    mesas: [],
    menu: [],
    mesaSeleccionada: null,
    carritoActual: [], // Arreglo de { idProducto, nombre, precio, cantidad }
    total: 0,
    categoriaSeleccionada: 'Todas'
};

export const mutators = {
    setMesas: (mesas) => state.mesas = mesas,
    setMenu: (menu) => state.menu = menu,
    seleccionarMesa: (idMesa) => {
        state.mesaSeleccionada = idMesa;
        // Al interactuar con otra mesa, limpiamos el pedido activo temporal
        state.carritoActual = []; 
        state.categoriaSeleccionada = 'Todas';
        mutators.actualizarTotal();
    },
    setCategoriaSeleccionada: (cat) => state.categoriaSeleccionada = cat,
    addProductoAlCarrito: (producto) => {
        const MAX_QTY = 50;
        const itemExistente = state.carritoActual.find(i => i.idProducto === producto.id);
        if (itemExistente) {
            if (itemExistente.cantidad >= MAX_QTY) return; // Tope de seguridad
            itemExistente.cantidad += 1;
        } else {
            state.carritoActual.push({
                idProducto: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                cantidad: 1
            });
        }
        mutators.actualizarTotal();
    },
    restarProductoDelCarrito: (idProducto) => {
        const itemExistente = state.carritoActual.find(i => i.idProducto === idProducto);
        if (itemExistente) {
            itemExistente.cantidad -= 1;
            if (itemExistente.cantidad <= 0) {
                state.carritoActual = state.carritoActual.filter(i => i.idProducto !== idProducto);
            }
        }
        mutators.actualizarTotal();
    },
    actualizarTotal: () => {
        state.total = state.carritoActual.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
    },
    limpiarPedido: () => {
        state.carritoActual = [];
        state.mesaSeleccionada = null;
        mutators.actualizarTotal();
    }
};
