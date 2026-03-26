const express = require('express');
const router = express.Router();
const { db, saveData } = require('./data');

// GET /api/mesas
router.get('/mesas', (req, res) => {
    res.json(db.mesas);
});

// GET /api/menu
router.get('/menu', (req, res) => {
    res.json(db.menu);
});

// POST /api/menu
router.post('/menu', (req, res) => {
    const { nombre, precio } = req.body;
    if (!nombre || precio === undefined) return res.status(400).json({ error: 'Debes proporcionar nombre y precio.' });
    
    const newId = (db.menu.length > 0) ? Math.max(...db.menu.map(m => m.id)) + 1 : 1;
    const newItem = { id: newId, nombre, precio: parseFloat(precio) };
    
    db.menu.push(newItem);
    saveData();
    res.status(201).json(newItem);
});

// DELETE /api/menu/:id
router.delete('/menu/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = db.menu.findIndex(m => m.id === id);
    if (index === -1) return res.status(404).json({ error: 'Producto no encontrado.' });
    
    db.menu.splice(index, 1);
    saveData();
    res.json({ mensaje: 'Producto eliminado.' });
});

// GET /api/comandas/activas/:mesaId
router.get('/comandas/activas/:mesaId', (req, res) => {
    const comanda = db.comandas.find(c => c.mesaId === parseInt(req.params.mesaId) && c.activa);
    if (comanda) {
        res.json(comanda);
    } else {
        res.json({ items: [], total: 0 }); // No hay orden activa
    }
});

// POST /api/comandas (Append or create)
router.post('/comandas', (req, res) => {
    const { mesaId, productos } = req.body;

    if (!mesaId || !productos || !Array.isArray(productos)) {
        return res.status(400).json({ error: 'Faltan datos de la comanda (mesaId, productos formados como Array).' });
    }

    // Ubicamos la mesa
    const mesa = db.mesas.find(m => m.id === mesaId);
    if (!mesa) {
        return res.status(404).json({ error: 'Mesa no encontrada.' });
    }

    const items = productos.map(id => db.menu.find(m => m.id === id)).filter(Boolean);
    const sumaNuevos = items.reduce((acc, item) => acc + item.precio, 0);

    let comanda = db.comandas.find(c => c.mesaId === mesaId && c.activa);

    if (comanda) {
        // Appending
        comanda.items.push(...items);
        comanda.total += sumaNuevos;
    } else {
        // Creating
        comanda = {
            id: db.comandas.length + 1,
            mesaId,
            items,
            total: sumaNuevos,
            fecha: new Date().toISOString(),
            activa: true
        };
        db.comandas.push(comanda);
        mesa.estado = 'Ocupada';
    }

    saveData();
    res.status(201).json({ mensaje: 'Comanda procesada con éxito.', comanda });
});

// POST /api/mesas/:id/cobrar
router.post('/mesas/:id/cobrar', (req, res) => {
    const mesaId = parseInt(req.params.id);
    const mesa = db.mesas.find(m => m.id === mesaId);
    
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada.' });

    const comanda = db.comandas.find(c => c.mesaId === mesaId && c.activa);
    
    mesa.estado = 'Disponible';
    if (comanda) {
        comanda.activa = false;
    }

    saveData();
    res.json({ mensaje: 'Cuenta cobrada y mesa liberada con éxito.' });
});

// GET /api/comandas/historial
router.get('/comandas/historial', (req, res) => {
    const cerradas = db.comandas.filter(c => !c.activa);
    res.json(cerradas.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)));
});

// GET /api/admin/resumen
router.get('/admin/resumen', (req, res) => {
    const ventasTotales = db.comandas.reduce((acc, current) => acc + current.total, 0);
    const mesasOcupadas = db.mesas.filter(m => m.estado === 'Ocupada').length;
    const mesasDisponibles = db.mesas.filter(m => m.estado === 'Disponible').length;
    
    // Conteo de ítems vendidos
    const conteoItems = {};
    db.comandas.forEach(comanda => {
        comanda.items.forEach(item => {
            if (!conteoItems[item.id]) {
                conteoItems[item.id] = { nombre: item.nombre, cantidad: 0, ingresos: 0 };
            }
            conteoItems[item.id].cantidad += 1;
            conteoItems[item.id].ingresos += item.precio;
        });
    });

    res.json({
        ventasTotales,
        mesasOcupadas,
        mesasDisponibles,
        totalComandas: db.comandas.length,
        itemsVendidos: Object.values(conteoItems)
    });
});

module.exports = router;
