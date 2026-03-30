import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Funciones API relacionadas al POS ---

export async function fetchMesas() {
    const { data, error } = await supabase.from('mesas').select('*').order('numero');
    if (error) {
        console.error("Error obteniendo mesas:", error);
        throw error;
    }
    return data || [];
}

export async function actualizarEstadoMesa(id, nuevoEstado) {
    const { data, error } = await supabase.from('mesas').update({ estado: nuevoEstado }).eq('id', id).select();
    if (error) throw error;
    return data;
}

export async function fetchMenu() {
    const { data, error } = await supabase.from('menu').select('*');
    if (error) {
        console.error("Error obteniendo menú:", error);
        throw error;
    }
    return data || [];
}

export async function crearProductoMenu(producto) {
    const { data, error } = await supabase.from('menu').insert([producto]);
    if (error) throw error;
    return data;
}

export async function eliminarProductoMenu(id) {
    const { data, error } = await supabase.from('menu').delete().eq('id', id);
    if (error) throw error;
    return data;
}

export async function fetchComandasParaCocina() {
    // Solo traemos comandas que no esten terminadas o pagadas
    const { data, error } = await supabase.from('comandas')
        .select(`
            id, total, estado, mesa_id, created_at, productos,
            mesas(numero)
        `)
        .in('estado', ['Pendiente', 'Preparando', 'Lista'])
        .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
}

export async function actualizarEstadoComanda(id, nuevoEstado) {
    const { data, error } = await supabase.from('comandas').update({ estado: nuevoEstado }).eq('id', id);
    if (error) throw error;
    return data;
}

export async function enviarComanda(mesaId, productosIds, total) {
    const payload = {
        mesa_id: mesaId,
        productos: productosIds, 
        total: total,
        estado: 'Pendiente' // Estado inicial para KDS
    };
    
    // Asume tabla comandas con un esquema compatible
    const { data, error } = await supabase.from('comandas').insert([payload]).select();
    if (error) throw error;
    return data;
}

export async function fetchCuentaPrevia(mesaId) {
    const { data, error } = await supabase.from('comandas')
        .select('*')
        .eq('mesa_id', mesaId)
        .in('estado', ['Pendiente', 'Preparando', 'Lista']);
        
    if (error) throw error;
    
    const sumatoria = (data || []).reduce((acc, curr) => acc + (curr.total || 0), 0);
    return { total: sumatoria, detalles: data };
}

export async function cobrarMesaConPago(mesaId, pagoEfectivo, pagoTarjeta, turnoId = null) {
    // Determinar método de pago
    let metodo = 'Efectivo';
    if (pagoTarjeta > 0 && pagoEfectivo > 0) metodo = 'Mixto';
    else if (pagoTarjeta > 0) metodo = 'Tarjeta';

    // Cerrar todas las comandas de la mesa con datos de pago
    const updatePayload = { 
        estado: 'Pagada', 
        pago_efectivo: pagoEfectivo, 
        pago_tarjeta: pagoTarjeta, 
        metodo_pago: metodo 
    };
    if (turnoId) updatePayload.turno_id = turnoId;

    const { error: errComandas } = await supabase.from('comandas')
        .update(updatePayload)
        .eq('mesa_id', mesaId)
        .in('estado', ['Pendiente', 'Preparando', 'Lista']);
    
    if (errComandas) throw errComandas;

    // Liberar la mesa
    const { error: errMesa } = await supabase.from('mesas')
        .update({ estado: 'Limpiando' })
        .eq('id', mesaId);

    if (errMesa) throw errMesa;
    return true;
}

export async function fetchComandasActivasMesa(mesaId) {
    const { data, error } = await supabase.from('comandas')
        .select('*, mesas(numero)')
        .eq('mesa_id', mesaId)
        .in('estado', ['Pendiente', 'Preparando', 'Lista']);
    if (error) throw error;
    return data || [];
}

export async function fetchHistorialComandas() {
    const { data, error } = await supabase.from('comandas')
        .select('*, mesas(numero)')
        .eq('estado', 'Pagada')
        .order('created_at', { ascending: false })
        .limit(50);
    if (error) throw error;
    return data || [];
}

// --- Funciones de Turnos de Caja (Corte Z) ---

export async function abrirTurnoCaja(cajeroId, baseEfectivo) {
    // Verificar si ya hay un turno abierto
    const { data: activo } = await supabase.from('turnos')
        .select('*')
        .eq('estado', 'Abierto')
        .limit(1)
        .maybeSingle();
    
    if (activo) throw new Error('Ya existe un turno de caja abierto. Ciérralo primero.');

    const { data, error } = await supabase.from('turnos').insert([{
        cajero_id: cajeroId,
        base_efectivo: baseEfectivo,
        estado: 'Abierto'
    }]).select();
    
    if (error) throw error;
    return data[0];
}

export async function fetchTurnoActivo() {
    const { data, error } = await supabase.from('turnos')
        .select('*')
        .eq('estado', 'Abierto')
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data; // null si no hay turno abierto
}

export async function cerrarTurnoCaja(turnoId) {
    // Buscar todas las comandas pagadas vinculadas a este turno
    const { data: comandasTurno, error: errCmd } = await supabase.from('comandas')
        .select('total, pago_efectivo, pago_tarjeta, metodo_pago')
        .eq('turno_id', turnoId)
        .eq('estado', 'Pagada');
    
    if (errCmd) throw errCmd;

    let totalEfectivo = 0;
    let totalTarjeta = 0;
    (comandasTurno || []).forEach(c => {
        totalEfectivo += c.pago_efectivo || 0;
        totalTarjeta += c.pago_tarjeta || 0;
    });

    const { data, error } = await supabase.from('turnos')
        .update({
            estado: 'Cerrado',
            efectivo_cierre: totalEfectivo,
            tarjeta_cierre: totalTarjeta,
            fecha_cierre: new Date().toISOString()
        })
        .eq('id', turnoId)
        .select();
    
    if (error) throw error;
    return { turno: data[0], totalEfectivo, totalTarjeta, totalVentas: totalEfectivo + totalTarjeta };
}

export async function fetchDashboardResumen() {
    // Intentar RPC server-side primero (ejecuta 03_dashboard_rpc.sql para activar)
    try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('dashboard_resumen');
        if (!rpcError && rpcData) {
            return {
                ventasTotales: rpcData.ventasTotales || 0,
                mesasOcupadas: rpcData.mesasOcupadas || 0,
                mesasDisponibles: rpcData.mesasDisponibles || 0,
                totalComandas: rpcData.totalComandas || 0,
                itemsVendidos: rpcData.itemsVendidos || []
            };
        }
    } catch(e) { /* RPC no existe aún, fallback abajo */ }

    // Fallback: cálculo client-side (funciona sin ejecutar el script SQL)
    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    const [mesasRes, comandasRes, menuRes] = await Promise.all([
        supabase.from('mesas').select('*'),
        supabase.from('comandas').select('*').gte('created_at', hoy.toISOString()),
        supabase.from('menu').select('id, nombre, precio')
    ]);

    const mesas = mesasRes.data || [];
    const comandasHoy = comandasRes.data || [];
    const menuLista = menuRes.data || [];

    const menuDict = menuLista.reduce((acc, item) => {
        acc[item.id] = { nombre: item.nombre, precio: item.precio };
        return acc;
    }, {});

    let ventasTotales = 0;
    let mesasOcupadas = 0;
    const mapaProductosVendidos = {};

    mesas.forEach(m => { if (m.estado !== 'Disponible') mesasOcupadas++; });

    comandasHoy.forEach(c => {
        if (c.estado === 'Pagada' || c.estado === 'Lista') {
            ventasTotales += c.total || 0;
        }
        if(c.productos && Array.isArray(c.productos)) {
            c.productos.forEach(prodId => {
                if(!mapaProductosVendidos[prodId]) {
                    mapaProductosVendidos[prodId] = { cantidad: 0, ingresos: 0, nombre: menuDict[prodId]?.nombre || 'Artículo '+prodId };
                }
                mapaProductosVendidos[prodId].cantidad += 1;
                mapaProductosVendidos[prodId].ingresos += menuDict[prodId]?.precio || 0;
            });
        }
    });

    return {
        ventasTotales,
        mesasOcupadas,
        mesasDisponibles: mesas.length - mesasOcupadas,
        totalComandas: comandasHoy.length,
        itemsVendidos: Object.values(mapaProductosVendidos)
    };
}

// --- Funciones Auth ---

export async function initAuth() {
    return await supabase.auth.getSession();
}

export async function loginWithEmail(email, password) {
    return await supabase.auth.signInWithPassword({ email, password });
}

export async function logout() {
    return await supabase.auth.signOut();
}
