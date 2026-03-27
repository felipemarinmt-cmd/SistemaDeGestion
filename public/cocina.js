document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board-tickets');
    const statusIndicador = document.getElementById('status-indicador');

    async function init() {
        const socket = io();
        
        socket.on('connect', () => {
            statusIndicador.innerHTML = `<span style="color:#4ade80">● Conectado</span>`;
            cargarTickets();
        });
        socket.on('disconnect', () => {
            statusIndicador.innerHTML = `<span style="color:#fbbf24">● Re-conectando...</span>`;
        });
        
        socket.on('update_mesas', cargarTickets);
        socket.on('update_cocina', cargarTickets);
        
        await cargarTickets();
    }

    async function cargarTickets() {
        try {
            const res = await fetch('/api/comandas/cocina');
            const comandas = await res.json();
            renderTickets(comandas);
        } catch(e) { console.error('Error KDS', e); }
    }

    function timeAgo(dateString) {
        const ms = new Date() - new Date(dateString);
        const mins = Math.floor(ms / 60000);
        if (mins < 1) return 'Justo ahora';
        return `hace ${mins} min`;
    }

    function renderTickets(comandas) {
        board.innerHTML = '';
        if(comandas.length === 0) {
            board.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#64748b; margin-top:10vh;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5; margin-bottom:1rem;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <h2>No hay comandas pendientes</h2>
                <p>La cocina está al día.</p>
            </div>`;
            return;
        }

        // Auto refresco del tiempo local (optimista) sin recargar del server
        setInterval(renderTimeAgos, 60000);

        comandas.forEach(comanda => {
            const estado = comanda.estadoCocina || 'Pendiente';
            
            // Agrupar items idénticos visualmente
            const mapItems = {};
            comanda.items.forEach(i => {
                if(!mapItems[i.nombre]) mapItems[i.nombre] = 0;
                mapItems[i.nombre]++;
            });

            const ticket = document.createElement('div');
            ticket.className = `ticket ${estado === 'Preparando' ? 'preparando' : ''}`;
            
            let lis = '';
            for(let name in mapItems) {
                lis += `<li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    <strong>x${mapItems[name]}</strong> ${name}
                </li>`;
            }

            // Acciones dependiendo del estado
            let actions = '';
            if(estado === 'Pendiente') {
                actions = `
                    <button class="btn-kds btn-preparando" onclick="cambiarEstado(${comanda.id}, 'Preparando')">Preparar</button>
                    <button class="btn-kds btn-listo" onclick="cambiarEstado(${comanda.id}, 'Listo')">¡Listo!</button>
                `;
            } else if (estado === 'Preparando') {
                actions = `
                    <button class="btn-kds btn-listo" onclick="cambiarEstado(${comanda.id}, 'Listo')">¡Comanda Lista!</button>
                `;
            }

            ticket.innerHTML = `
                <div class="ticket-header">
                    <div class="ticket-mesa">Mesa ${comanda.numeroMesa}</div>
                    <div class="ticket-tiempo" data-time="${comanda.fecha}">${timeAgo(comanda.fecha)}</div>
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

    window.cambiarEstado = async function(id, estado) {
        try {
            await fetch(`/api/comandas/${id}/cocina`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado })
            });
            // La recarga se hará automáticamente por WebSockets (update_cocina)
        } catch(e) {
            alert('Error al actualizar');
        }
    };

    init();
});
