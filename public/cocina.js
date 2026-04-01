// cocina.js - Kitchen Display System con Supabase Realtime Serverless

import { supabase, fetchComandasParaCocina, fetchMenu, actualizarEstadoComanda, actualizarEstadoMesa } from './api.js';
import { escapeHtml } from './sanitize.js';
import { debounce } from './utils.js';

// --- Sonido con Web Audio API (sin archivo externo) ---
let sonidoActivo = localStorage.getItem('kds-sonido') !== 'off';
let audioCtx = null;

function playDing() {
    if (!sonidoActivo) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(830, audioCtx.currentTime);     // nota aguda
        osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1); // sube
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
    } catch(e) { /* browser bloqueó audio, ignorar */ }
}

document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board-tickets');
    const statusIndicador = document.getElementById('status-indicador');
    const btnSonido = document.getElementById('btn-toggle-sonido');
    let menuCache = {};

    // --- Toggle sonido ---
    function actualizarBotonSonido() {
        if (btnSonido) btnSonido.textContent = sonidoActivo ? '🔔' : '🔇';
        if (btnSonido) btnSonido.style.borderColor = sonidoActivo ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.2)';
    }
    actualizarBotonSonido();

    btnSonido?.addEventListener('click', () => {
        sonidoActivo = !sonidoActivo;
        localStorage.setItem('kds-sonido', sonidoActivo ? 'on' : 'off');
        actualizarBotonSonido();
        if (sonidoActivo) playDing(); // feedback inmediato al activar
    });

    async function init() {
        if(statusIndicador) statusIndicador.innerHTML = `<span style="color:#fbbf24">● Conectando a DB...</span>`;
        
        try {
            const menuData = await fetchMenu();
            menuData.forEach(m => { menuCache[m.id] = m.nombre; });
        } catch(e) { console.error('Error pre-cargando menú', e); }

        await cargarTickets();
        
        const channel = supabase.channel('cocina-updates');
        const debouncedFetch = debounce(cargarTickets, 500);
        
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comandas' }, payload => {
            playDing(); // 🔔 Notificación sonora
            debouncedFetch();
        });
        
        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comandas' }, payload => {
            debouncedFetch();
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

    function isNew(dateString) {
        if (!dateString) return true;
        return (new Date() - new Date(dateString)) < 15000; // < 15 segundos
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

        if (!window.kdsTimerInterval) {
            window.kdsTimerInterval = setInterval(renderTimeAgos, 60000);
        }

        comandas.forEach(comanda => {
            const estado = comanda.estado || 'Pendiente';
            
            const mapItems = {};
            if(comanda.productos && Array.isArray(comanda.productos)) {
                comanda.productos.forEach(id => {
                    const nombreStr = menuCache[id] || `Platillo #${id}`;
                    if(!mapItems[nombreStr]) mapItems[nombreStr] = 0;
                    mapItems[nombreStr]++;
                });
            }

            const ticket = document.createElement('div');
            const esNuevo = isNew(comanda.created_at);
            ticket.className = `ticket ${estado === 'Preparando' ? 'preparando' : ''} ${esNuevo ? 'ticket-nuevo' : ''}`;
            
            let lis = '';
            for(let name in mapItems) {
                lis += `<li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    <strong>x${escapeHtml(mapItems[name])}</strong> ${escapeHtml(name)}
                </li>`;
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
                <div class="ticket-actions"></div>
            `;

            // Botones con addEventListener (sin onclick inline)
            const actionsDiv = ticket.querySelector('.ticket-actions');
            if (estado === 'Pendiente') {
                const btnPrep = document.createElement('button');
                btnPrep.className = 'btn-kds btn-preparando';
                btnPrep.textContent = 'Preparar';
                btnPrep.addEventListener('click', () => cambiarEstadoHandler(comanda.id, 'Preparando'));
                actionsDiv.appendChild(btnPrep);

                const btnListo = document.createElement('button');
                btnListo.className = 'btn-kds btn-listo';
                btnListo.textContent = '¡Listo!';
                btnListo.addEventListener('click', () => cambiarEstadoHandler(comanda.id, 'Lista', comanda.mesa_id));
                actionsDiv.appendChild(btnListo);
            } else if (estado === 'Preparando') {
                const btnListo = document.createElement('button');
                btnListo.className = 'btn-kds btn-listo';
                btnListo.textContent = '¡Comanda Lista!';
                btnListo.addEventListener('click', () => cambiarEstadoHandler(comanda.id, 'Lista', comanda.mesa_id));
                actionsDiv.appendChild(btnListo);
            }

            board.appendChild(ticket);
        });
    }

    function renderTimeAgos() {
        document.querySelectorAll('.ticket-tiempo').forEach(el => {
            el.textContent = timeAgo(el.getAttribute('data-time'));
        });
    }

    async function cambiarEstadoHandler(idComanda, nuevoEstado, idMesa = null) {
        try {
            await actualizarEstadoComanda(idComanda, nuevoEstado);
            if (nuevoEstado === 'Lista' && idMesa) {
                await actualizarEstadoMesa(idMesa, 'Ocupada');
            }
            cargarTickets();
        } catch(e) {
            alert('Error al actualizar registro en base de datos');
            console.error(e);
        }
    }

    init();
});
