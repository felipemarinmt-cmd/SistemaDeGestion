/**
 * seed.js - Script de Datos de Prueba (Seed Data)
 * 
 * Inyecta datos falsos en Supabase para simular un restaurante en plena operación:
 * - 10 mesas con estados variados
 * - 15 platillos en el menú
 * - 50+ comandas con distintos estados y productos
 * - 1 turno de caja abierto con transacciones
 * 
 * USO: node scripts/seed.js
 * REQUISITOS: Variables de entorno SUPABASE_URL y SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// Usa la SERVICE KEY (no la anon key) para bypass de RLS
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://enwvsqjymtesmhpllctp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'TU_SERVICE_ROLE_KEY_AQUI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================
// DATA FIXTURES
// ============================

const MESAS = Array.from({ length: 10 }, (_, i) => ({
    numero: i + 1,
    estado: 'Disponible'
}));

const MENU_ITEMS = [
    { nombre: 'Tacos al Pastor', precio: 85.00, categoria: 'Plato Principal' },
    { nombre: 'Enchiladas Verdes', precio: 95.00, categoria: 'Plato Principal' },
    { nombre: 'Pozole Rojo', precio: 110.00, categoria: 'Plato Principal' },
    { nombre: 'Chiles en Nogada', precio: 145.00, categoria: 'Plato Principal' },
    { nombre: 'Sopa Azteca', precio: 65.00, categoria: 'Plato Principal' },
    { nombre: 'Guacamole con Totopos', precio: 55.00, categoria: 'Acompañamiento' },
    { nombre: 'Arroz Rojo', precio: 30.00, categoria: 'Acompañamiento' },
    { nombre: 'Frijoles Charros', precio: 35.00, categoria: 'Acompañamiento' },
    { nombre: 'Agua de Horchata', precio: 35.00, categoria: 'Bebida' },
    { nombre: 'Limonada Natural', precio: 30.00, categoria: 'Bebida' },
    { nombre: 'Cerveza Artesanal', precio: 65.00, categoria: 'Bebida' },
    { nombre: 'Margarita Clásica', precio: 95.00, categoria: 'Bebida' },
    { nombre: 'Flan Napolitano', precio: 45.00, categoria: 'Postre' },
    { nombre: 'Churros con Chocolate', precio: 50.00, categoria: 'Postre' },
    { nombre: 'Pastel de Tres Leches', precio: 55.00, categoria: 'Postre' },
];

const ESTADOS_COMANDA = ['Pendiente', 'Preparando', 'Lista', 'Pagada'];
const ESTADOS_MESA = ['Disponible', 'Ocupada', 'Esperando Comida', 'Por Pagar', 'Limpiando'];
const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Mixto'];

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(hoursBack = 12) {
    const now = new Date();
    const past = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime())).toISOString();
}

// ============================
// SEED FUNCTIONS
// ============================

async function limpiarDatos() {
    console.log('🗑️  Limpiando datos existentes...');
    await supabase.from('comandas').delete().neq('id', 0);
    await supabase.from('turnos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('mesas').delete().neq('id', 0);
    await supabase.from('menu').delete().neq('id', 0);
    console.log('   ✅ Tablas limpiadas');
}

async function seedMesas() {
    console.log('🪑 Insertando 10 mesas...');
    const { data, error } = await supabase.from('mesas').insert(MESAS).select();
    if (error) throw error;
    
    // Asignar estados variados a las primeras mesas para darle vida visual
    const estadosVisual = ['Ocupada', 'Esperando Comida', 'Ocupada', 'Por Pagar', 'Disponible', 'Limpiando', 'Disponible', 'Ocupada', 'Disponible', 'Disponible'];
    for (let i = 0; i < data.length && i < estadosVisual.length; i++) {
        await supabase.from('mesas').update({ estado: estadosVisual[i] }).eq('id', data[i].id);
    }
    
    console.log(`   ✅ ${data.length} mesas creadas con estados variados`);
    return data;
}

async function seedMenu() {
    console.log('🍽️  Insertando 15 platillos del menú...');
    const { data, error } = await supabase.from('menu').insert(MENU_ITEMS).select();
    if (error) throw error;
    console.log(`   ✅ ${data.length} platillos insertados`);
    return data;
}

async function seedComandas(mesas, menuItems, cantidad = 50) {
    console.log(`📝 Generando ${cantidad} comandas concurrentes...`);
    
    const comandas = [];
    
    for (let i = 0; i < cantidad; i++) {
        const mesa = randomItem(mesas);
        const numItems = randomInt(1, 5);
        const productosSeleccionados = [];
        let total = 0;
        
        for (let j = 0; j < numItems; j++) {
            const prod = randomItem(menuItems);
            productosSeleccionados.push(prod.id);
            total += prod.precio;
        }
        
        const estado = randomItem(ESTADOS_COMANDA);
        const comanda = {
            mesa_id: mesa.id,
            productos: productosSeleccionados,
            total: total,
            estado: estado,
            created_at: randomDate(12)
        };
        
        // Si está pagada, añadir datos de pago
        if (estado === 'Pagada') {
            const metodo = randomItem(METODOS_PAGO);
            comanda.metodo_pago = metodo;
            if (metodo === 'Efectivo') {
                comanda.pago_efectivo = total;
                comanda.pago_tarjeta = 0;
            } else if (metodo === 'Tarjeta') {
                comanda.pago_efectivo = 0;
                comanda.pago_tarjeta = total;
            } else {
                const mitad = Math.round(total / 2 * 100) / 100;
                comanda.pago_efectivo = mitad;
                comanda.pago_tarjeta = total - mitad;
            }
        }
        
        comandas.push(comanda);
    }
    
    // Insertar en lotes de 25 para evitar timeouts
    for (let i = 0; i < comandas.length; i += 25) {
        const batch = comandas.slice(i, i + 25);
        const { error } = await supabase.from('comandas').insert(batch);
        if (error) {
            console.error(`   ❌ Error en lote ${i / 25 + 1}:`, error.message);
        } else {
            console.log(`   📦 Lote ${Math.floor(i / 25) + 1} insertado (${batch.length} comandas)`);
        }
    }
    
    const pagadas = comandas.filter(c => c.estado === 'Pagada').length;
    const pendientes = comandas.filter(c => c.estado === 'Pendiente').length;
    const preparando = comandas.filter(c => c.estado === 'Preparando').length;
    const listas = comandas.filter(c => c.estado === 'Lista').length;
    
    console.log(`   ✅ ${comandas.length} comandas generadas:`);
    console.log(`      🟡 Pendientes: ${pendientes}`);
    console.log(`      🟠 Preparando: ${preparando}`);
    console.log(`      🟢 Listas: ${listas}`);
    console.log(`      💰 Pagadas: ${pagadas}`);
    
    return comandas;
}

// ============================
// MAIN
// ============================

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('   🌱 SEED: Sistema POS Restaurante');
    console.log('═══════════════════════════════════════════');
    console.log('');
    
    if (SUPABASE_SERVICE_KEY === 'TU_SERVICE_ROLE_KEY_AQUI') {
        console.error('❌ ERROR: Configura SUPABASE_SERVICE_KEY antes de ejecutar.');
        console.error('   Encuéntrala en: Supabase Dashboard > Settings > API > Service Role Key');
        console.error('');
        console.error('   Uso: SUPABASE_SERVICE_KEY=tu_clave node scripts/seed.js');
        process.exit(1);
    }
    
    try {
        await limpiarDatos();
        const mesas = await seedMesas();
        const menuItems = await seedMenu();
        await seedComandas(mesas, menuItems, 50);
        
        console.log('');
        console.log('═══════════════════════════════════════════');
        console.log('   ✅ SEED COMPLETADO CON ÉXITO');
        console.log('   Abre tu navegador en localhost:3000');
        console.log('   para ver el Dashboard poblado.');
        console.log('═══════════════════════════════════════════');
        console.log('');
    } catch (error) {
        console.error('');
        console.error('❌ ERROR FATAL:', error.message);
        console.error(error);
        process.exit(1);
    }
}

main();
