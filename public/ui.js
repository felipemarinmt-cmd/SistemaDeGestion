// ui.js - Renderizado del DOM independiente del estado y API

import { state } from './state.js';
import { escapeHtml } from './sanitize.js';

export function showToast(message, type = 'success', persist = false) {
    const container = document.getElementById('toast-container');
    if(!container) {
        alert(message);
        return;
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconSuccess = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    const iconError = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    const iconSync = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.22-10.27l-3.27 3.27"></path></svg>`;

    let activeIcon = type === 'success' ? iconSuccess : iconError;
    if (type === 'warning') activeIcon = iconSync;

    toast.innerHTML = `<span class="toast-icon-wrapper" style="display:flex; align-items:center;">${activeIcon}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    
    if(!persist) {
        setTimeout(() => {
            toast.style.animation = 'slideUpFade 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
    return toast; // Retorna por si queremos eliminarlo manual
}

export function renderMesas(onSeleccionarMesa) {
    const mesasContainer = document.getElementById('mesas-container');
    if(!mesasContainer) return;
    mesasContainer.innerHTML = '';
    
    const diccColores = {
        'Disponible': '#10b981',
        'Ocupada': '#f59e0b',
        'Esperando Comida': '#ef4444',
        'Por Pagar': '#3b82f6',
        'Limpiando': '#6b7280'
    };

    state.mesas.forEach(mesa => {
        const estadoLabel = mesa.estado || 'Disponible';
        const col = diccColores[estadoLabel] || diccColores['Disponible'];

        const btn = document.createElement('button');
        btn.className = `mesa-btn`;
        btn.style.borderLeft = `5px solid ${col}`;
        
        if (state.mesaSeleccionada === mesa.id) {
            btn.classList.add('mesa-seleccionada');
            btn.style.backgroundColor = `${col}15`; // 15% opacidad
            btn.style.transform = 'scale(0.98)';
            btn.style.boxShadow = `0 0 0 2px ${col}`;
        }

        btn.innerHTML = `
            <div style="font-weight:700; font-size:1.15rem; color:#1e293b;">Mesa ${escapeHtml(mesa.numero)}</div>
            <span style="background:${col}; color:white; padding:3px 10px; font-size:0.75rem; border-radius:12px; font-weight:700; display:inline-block; margin-top:8px;">${escapeHtml(estadoLabel)}</span>
        `;

        btn.addEventListener('click', () => onSeleccionarMesa(mesa));
        mesasContainer.appendChild(btn);
    });
}

export function renderCategories(onCategoryChange) {
    const filtersDiv = document.getElementById('category-filters');
    if(!filtersDiv) return;
    
    filtersDiv.innerHTML = '';
    const categorias = ['Todas', ...new Set(state.menu.map(m => m.categoria || 'Sin categoría'))];
    
    categorias.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `chip ${state.categoriaSeleccionada === cat ? 'active' : ''}`;
        btn.textContent = cat;
        btn.addEventListener('click', () => onCategoryChange(cat));
        filtersDiv.appendChild(btn);
    });
    filtersDiv.style.display = 'flex';
}

export function renderMenu(onAgregar, onRestar) {
    const productosContainer = document.getElementById('productos-container');
    if(!productosContainer) return;
    
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
            btnMinus.addEventListener('click', () => onRestar(prod.id));
            
            const spanQty = document.createElement('span');
            spanQty.textContent = qty;
            
            const btnPlus = document.createElement('button');
            btnPlus.className = 'stepper-btn';
            btnPlus.textContent = '+';
            btnPlus.addEventListener('click', () => onAgregar(prod));
            
            actionsDiv.appendChild(btnMinus);
            actionsDiv.appendChild(spanQty);
            actionsDiv.appendChild(btnPlus);
        } else {
            const btnAdd = document.createElement('button');
            btnAdd.className = 'add-btn';
            btnAdd.textContent = '+';
            btnAdd.addEventListener('click', () => onAgregar(prod));
            actionsDiv.appendChild(btnAdd);
        }
        
        item.appendChild(infoDiv);
        item.appendChild(actionsDiv);
        productosContainer.appendChild(item);
    });
}
