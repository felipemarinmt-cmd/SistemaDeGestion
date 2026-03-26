const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, 'data.json');

const defaultData = {
    mesas: [
        { id: 1, numero: 1, estado: 'Disponible' }, // Disponible -> --secondary-ui
        { id: 2, numero: 2, estado: 'Disponible' }, // Ocupada -> --accent-warning
        { id: 3, numero: 3, estado: 'Disponible' },
        { id: 4, numero: 4, estado: 'Disponible' },
        { id: 5, numero: 5, estado: 'Disponible' },
        { id: 6, numero: 6, estado: 'Disponible' }
    ],
    menu: [
        { id: 1, nombre: 'Hamburguesa Sencilla', precio: 5.00 },
        { id: 2, nombre: 'Hamburguesa Doble', precio: 7.50 },
        { id: 3, nombre: 'Papas Fritas', precio: 2.50 },
        { id: 4, nombre: 'Gaseosa', precio: 1.50 },
        { id: 5, nombre: 'Cerveza', precio: 3.00 }
    ],
    comandas: []
};

let db;

try {
    if (fs.existsSync(dataFilePath)) {
        const raw = fs.readFileSync(dataFilePath, 'utf-8');
        db = JSON.parse(raw);
    } else {
        db = defaultData;
        fs.writeFileSync(dataFilePath, JSON.stringify(db, null, 2));
    }
} catch (e) {
    console.error('Error leyendo la base de datos JSON', e);
    db = defaultData;
}

function saveData() {
    try {
        fs.writeFileSync(dataFilePath, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('Error guardando en data.json', e);
    }
}

module.exports = { db, saveData };
