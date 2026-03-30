// cocina.js - Kitchen Display System con Supabase Realtime Serverless

import { supabase, fetchComandasParaCocina, fetchMenu, actualizarEstadoComanda, actualizarEstadoMesa } from './api.js';
import { escapeHtml } from './sanitize.js';

document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board-tickets');
    const statusIndicador = document.getElementById('status-indicador');
    let menuCache = {};

    async function init() {
        if(statusIndicador) statusIndicador.innerHTML = `<span style="color:#fbbf24">● Conectando a DB...</span>`;
        
        // Cachear menú para pintar los nombres
        try {
            const menuData = await fetchMenu();
            menuData.forEach(m => { menuCache[m.id] = m.nombre; });
        } catch(e) { console.error('Error pre-cargando menú', e); }

        await cargarTickets();
        
        // Supabase Realtime Subscription
        const channel = supabase.channel('cocina-updates');
        
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comandas' }, payload => {
            cargarTickets(); // Refresca lista ante nueva orden
        });
        
        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comandas' }, payload => {
            // Refresca si una comanda fue cancelada o modificada (ej. por admin)
            cargarTickets();
        });

        channel.subscribe((status) => {
            if(status === 'SUBSCRIBED' && statusIndicador) {
                statusIndicador.innerHTML = `<span style="color:#4ade80">● KDS Activo</span>`;
            } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
                if(statusIndicador) statusIndicador.innerHTML = `<span style="color:#ef4444">● Sin Conexión</span>`;
            }
        });

        window.addEventListener('beforeunload', () => channel.unsubscribe());
    }

    async function cargarTickets() {
        try {
            const comandas = await fetchComandasParaCocina();
            renderTickets(comandas);
        } catch(e) { 
            console.error('Error KDS', e); 
        }
    }

    function timeAgo(dateString) {
        if (!dateString) return 'Justo ahora';
        const ms = new Date() - new Date(dateString);
        const mins = Math.floor(ms / 60000);
        if (mins < 1) return 'Justo ahora';
        return `hace ${mins} min`;
    }

    function renderTickets(comandas) {
        if(!board) return;
        board.innerHTML = '';
        
        if(comandas.length === 0) {
            board.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#64748b; margin-top:10vh;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5; margin-bottom:1rem;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <h2>No hay comandas pendientes</h2>
                <p>La cocina está al día.</p>
            </div>`;
            return;
        }

        // Ya no activamos 100 intervalos, mantenemos un singleton de timer o delegamos
        if (!window.kdsTimerInterval) {
            window.kdsTimerInterval = setInterval(renderTimeAgos, 60000);
        }

        comandas.forEach(comanda => {
            const estado = comanda.estado || 'Pendiente';
            
            // Agrupar items idénticos (sabiendo que productos es arreglo de IDs numéricos/strings)
            const mapItems = {};
            if(comanda.productos && Array.isArray(comanda.productos)) {
                comanda.productos.forEach(id => {
                    const nombreStr = menuCache[id] || `Platillo #${id}`;
                    if(!mapItems[nombreStr]) mapItems[nombreStr] = 0;
                    mapItems[nombreStr]++;
                });
            }

            const ticket = document.createElement('div');
            ticket.className = `ticket ${estado === 'Preparando' ? 'preparando' : ''}`;
            
            let lis = '';
            for(let name in mapItems) {
                lis += `<li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    <strong>x${escapeHtml(mapItems[name])}</strong> ${escapeHtml(name)}
                </li>`;
            }

            // Acciones KDS directas a Supabase (Fase 2)
            let actions = '';
            if(estado === 'Pendiente') {
                actions = `
                    <button class="btn-kds btn-preparando" onclick="cambiarEstadoHandler(${comanda.id}, 'Preparando')">Preparar</button>
                    <button class="btn-kds btn-listo" onclick="cambiarEstadoHandler(${comanda.id}, 'Lista', ${comanda.mesa_id})">¡Listo!</button>
                `;
            } else if (estado === 'Preparando') {
                actions = `
                    <button class="btn-kds btn-listo" onclick="cambiarEstadoHandler(${comanda.id}, 'Lista', ${comanda.mesa_id})">¡Comanda Lista!</button>
                `;
            }

            const nMesa = comanda.mesas ? comanda.mesas.numero : comanda.mesa_id;

            ticket.innerHTML = `
                <div class="ticket-header">
                    <div class="ticket-mesa">Mesa ${escapeHtml(nMesa)}</div>
                    <div class="ticket-tiempo" data-time="${escapeHtml(comanda.created_at)}">${escapeHtml(timeAgo(comanda.created_at))}</div>
                </div>
                <ul class="ticket-items">
                    ${lis}
                </ul>
                <div class="ticket-actions">${actions}</div>
            `;
            board.appendChild(ticket);
        });
    }

    function renderTimeAgos() {
        document.querySelectorAll('.ticket-tiempo').forEach(el => {
            el.textContent = timeAgo(el.getAttribute('data-time'));
        });
    }

    window.cambiarEstadoHandler = async function(idComanda, nuevoEstado, idMesa = null) {
        try {
            await actualizarEstadoComanda(idComanda, nuevoEstado);
            if (nuevoEstado === 'Lista' && idMesa) {
                // Al estar lista la comida, pero sin pagarse, actualizamos solo para que el mesero sepa
                // La mesa en ese momento sigue siendo Ocupada (o cambia a "Comida Entregada").
                // Por requerimiento Workflow Fase 2: los estados son Disponible, Ocupada, Esperando Comida, Por Pagar, Limpiando.
                // Si la comida ya salió, la mesa vuelve de 'Esperando Comida' a 'Ocupada'.
                await actualizarEstadoMesa(idMesa, 'Ocupada');
            }
            
            // El canal realtime hará que todo se refresque, pero optimista:
            cargarTickets();
        } catch(e) {
            alert('Error al actualizar registro en base de datos');
            console.error(e);
        }
    };

    init();
});
