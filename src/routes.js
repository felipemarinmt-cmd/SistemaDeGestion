const express = require('express');
const router = express.Router();
const sql = require('./db');

// GET /api/mesas
router.get('/mesas', async (req, res) => {
    try {
        const mesas = await sql`SELECT * FROM mesas ORDER BY numero`;
        res.json(mesas);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// GET /api/menu
router.get('/menu', async (req, res) => {
    try {
        const menu = await sql`SELECT * FROM menu ORDER BY id`;
        menu.forEach(m => m.precio = parseFloat(m.precio));
        res.json(menu);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// POST /api/menu
router.post('/menu', async (req, res) => {
    const { nombre, precio, categoria } = req.body;
    if (!nombre || precio === undefined || !categoria) return res.status(400).json({ error: 'Debes proporcionar nombre, precio y categoría.' });
    
    try {
        const [newItem] = await sql`
            INSERT INTO menu (nombre, precio, categoria) 
            VALUES (${nombre}, ${parseFloat(precio)}, ${categoria}) 
            RETURNING *
        `;
        newItem.precio = parseFloat(newItem.precio);
        req.io.emit('update_menu');
        res.status(201).json(newItem);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// DELETE /api/menu/:id
router.delete('/menu/:id', async (req, res) => {
    try {
        await sql`DELETE FROM menu WHERE id = ${req.params.id}`;
        req.io.emit('update_menu');
        res.json({ mensaje: 'Producto eliminado.' });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// GET /api/comandas/activas/:mesaId
router.get('/comandas/activas/:mesaId', async (req, res) => {
    try {
        const comandas = await sql`SELECT * FROM comandas WHERE mesa_id = ${req.params.mesaId} AND activa = true LIMIT 1`;
        if (comandas.length > 0) {
            const comanda = comandas[0];
            const items = await sql`SELECT * FROM comanda_items WHERE comanda_id = ${comanda.id}`;
            
            comanda.items = items.map(i => ({
                id: i.menu_id, 
                nombre: i.nombre, 
                precio: parseFloat(i.precio), 
                categoria: i.categoria 
            }));
            
            comanda.total = parseFloat(comanda.total);
            res.json(comanda);
        } else {
            res.json({ items: [], total: 0 }); 
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// POST /api/comandas
router.post('/comandas', async (req, res) => {
    const { mesaId, productos } = req.body;
    if (!mesaId || !productos || !Array.isArray(productos)) return res.status(400).json({ error: 'Faltan datos.' });

    try {
        const comandaResult = await sql.begin(async sql => {
            const menuItems = await sql`SELECT * FROM menu WHERE id IN ${ sql(productos) }`;
            const itemsMap = {};
            menuItems.forEach(i => itemsMap[i.id] = i);
            
            const detailedItems = productos.map(id => itemsMap[id]).filter(Boolean);
            const sumaNuevos = detailedItems.reduce((acc, item) => acc + parseFloat(item.precio), 0);
            
            let comanda;
            const activas = await sql`SELECT * FROM comandas WHERE mesa_id = ${mesaId} AND activa = true LIMIT 1`;
            
            if (activas.length > 0) {
                comanda = activas[0];
                const newTotal = parseFloat(comanda.total) + sumaNuevos;
                const [updated] = await sql`UPDATE comandas SET total = ${newTotal} WHERE id = ${comanda.id} RETURNING *`;
                comanda = updated;
            } else {
                const [created] = await sql`
                    INSERT INTO comandas (mesa_id, total, activa, estado_cocina)
                    VALUES (${mesaId}, ${sumaNuevos}, true, 'Pendiente')
                    RETURNING *
                `;
                comanda = created;
                await sql`UPDATE mesas SET estado = 'Ocupada' WHERE id = ${mesaId}`;
            }

            if (detailedItems.length > 0) {
                const inserts = detailedItems.map(item => ({
                    comanda_id: comanda.id,
                    menu_id: item.id,
                    nombre: item.nombre,
                    precio: parseFloat(item.precio),
                    categoria: item.categoria
                }));
                await sql`INSERT INTO comanda_items ${ sql(inserts) }`;
            }
            return comanda;
        });

        req.io.emit('update_mesas');
        req.io.emit('update_dashboard');
        req.io.emit('update_cocina');
        res.status(201).json({ mensaje: 'Comanda procesada', comanda: comandaResult });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// POST /api/mesas/:id/cobrar
router.post('/mesas/:id/cobrar', async (req, res) => {
    try {
        await sql.begin(async sql => {
            await sql`UPDATE mesas SET estado = 'Disponible' WHERE id = ${req.params.id}`;
            await sql`UPDATE comandas SET activa = false WHERE mesa_id = ${req.params.id} AND activa = true`;
        });
        req.io.emit('update_mesas');
        req.io.emit('update_dashboard');
        req.io.emit('update_cocina');
        res.json({ mensaje: 'Cuenta cobrada y mesa liberada con éxito.' });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// GET /api/comandas/cocina
router.get('/comandas/cocina', async (req, res) => {
    try {
        const pendientes = await sql`
            SELECT c.*, m.numero as "numeroMesa" 
            FROM comandas c
            JOIN mesas m ON c.mesa_id = m.id
            WHERE c.activa = true AND (c.estado_cocina = 'Pendiente' OR c.estado_cocina = 'Preparando')
            ORDER BY c.fecha ASC
        `;
        
        for (let c of pendientes) {
            const items = await sql`SELECT nombre FROM comanda_items WHERE comanda_id = ${c.id}`;
            c.items = items;
            c.numeroMesa = c.numeroMesa;
            c.mesaId = c.mesa_id;
            c.estadoCocina = c.estado_cocina;
        }
        res.json(pendientes);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// PUT /api/comandas/:id/cocina
router.put('/comandas/:id/cocina', async (req, res) => {
    try {
        const { estado } = req.body;
        const [comanda] = await sql`
            UPDATE comandas SET estado_cocina = ${estado} 
            WHERE id = ${req.params.id} 
            RETURNING *
        `;
        
        req.io.emit('update_cocina');
        if(estado === 'Listo') {
            const [mesa] = await sql`SELECT numero FROM mesas WHERE id = ${comanda.mesa_id}`;
            req.io.emit('comanda_lista', { mesa: mesa ? mesa.numero : '?', mesaId: comanda.mesa_id });
        }
        res.json({ mensaje: 'Estado en cocina actualizado' });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// GET /api/comandas/historial
router.get('/comandas/historial', async (req, res) => {
    try {
        const cerradas = await sql`
            SELECT c.*, m.numero as "numeroMesa"
            FROM comandas c
            JOIN mesas m ON c.mesa_id = m.id
            WHERE c.activa = false
            ORDER BY c.fecha DESC
            LIMIT 50
        `;
        for (let c of cerradas) {
            const items = await sql`SELECT nombre, precio FROM comanda_items WHERE comanda_id = ${c.id}`;
            c.items = items.map(i => ({ nombre: i.nombre, precio: parseFloat(i.precio) }));
            c.total = parseFloat(c.total);
            c.mesaId = c.mesa_id;
        }
        res.json(cerradas);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// GET /api/admin/resumen
router.get('/admin/resumen', async (req, res) => {
    try {
        const [ingresosData] = await sql`SELECT SUM(total) as total FROM comandas`;
        const ventasTotales = parseFloat(ingresosData.total) || 0;
        
        const mesasOcupadasResp = await sql`SELECT COUNT(*) as count FROM mesas WHERE estado = 'Ocupada'`;
        const mesasDisponiblesResp = await sql`SELECT COUNT(*) as count FROM mesas WHERE estado = 'Disponible'`;
        const totalComandasResp = await sql`SELECT COUNT(*) as count FROM comandas`;

        const items = await sql`
            SELECT menu_id, nombre, COUNT(id) as cantidad, SUM(precio) as ingresos
            FROM comanda_items
            GROUP BY menu_id, nombre
            ORDER BY cantidad DESC
        `;
        
        const itemsVendidos = items.map(i => ({
            nombre: i.nombre,
            cantidad: parseInt(i.cantidad),
            ingresos: parseFloat(i.ingresos)
        }));

        res.json({
            ventasTotales,
            mesasOcupadas: parseInt(mesasOcupadasResp[0].count),
            mesasDisponibles: parseInt(mesasDisponiblesResp[0].count),
            totalComandas: parseInt(totalComandasResp[0].count),
            itemsVendidos
        });
    } catch(e) { res.status(500).json({error: e.message}); }
});

module.exports = router;
