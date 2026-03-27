require('dotenv').config();
const sql = require('./db');

async function initDB() {
    try {
        console.log("Iniciando creación de esquema en PostgreSQL...");
        
        // Destruir tablas en conflicto según autorización
        console.log("Limpiando tablas antiguas...");
        await sql`DROP TABLE IF EXISTS comanda_items, comandas, menu, mesas CASCADE`;
        
        // Tabla Mesas
        await sql`
            CREATE TABLE IF NOT EXISTS mesas (
                id SERIAL PRIMARY KEY,
                numero INTEGER NOT NULL UNIQUE,
                estado VARCHAR(50) DEFAULT 'Disponible'
            );
        `;

        // Tabla Menu
        await sql`
            CREATE TABLE IF NOT EXISTS menu (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                precio DECIMAL(10,2) NOT NULL,
                categoria VARCHAR(100)
            );
        `;

        // Tabla Comandas
        await sql`
            CREATE TABLE IF NOT EXISTS comandas (
                id SERIAL PRIMARY KEY,
                mesa_id INTEGER REFERENCES mesas(id),
                total DECIMAL(10,2) DEFAULT 0,
                fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                activa BOOLEAN DEFAULT true,
                estado_cocina VARCHAR(50) DEFAULT 'Pendiente'
            );
        `;

        // Tabla Comanda Items
        await sql`
            CREATE TABLE IF NOT EXISTS comanda_items (
                id SERIAL PRIMARY KEY,
                comanda_id INTEGER REFERENCES comandas(id) ON DELETE CASCADE,
                menu_id INTEGER REFERENCES menu(id) ON DELETE SET NULL,
                nombre VARCHAR(255) NOT NULL,
                precio DECIMAL(10,2) NOT NULL,
                categoria VARCHAR(100)
            );
        `;

        // Semillas Iniciales - Mesas
        const mesasCount = await sql`SELECT count(*) FROM mesas`;
        if (mesasCount[0].count === '0') {
            await sql`
                INSERT INTO mesas (numero, estado) VALUES 
                (1, 'Disponible'), (2, 'Disponible'), (3, 'Disponible'),
                (4, 'Disponible'), (5, 'Disponible'), (6, 'Disponible')
            `;
            console.log("Mesas iniciales creadas.");
        }

        // Semillas Iniciales - Menú
        const menuCount = await sql`SELECT count(*) FROM menu`;
        if (menuCount[0].count === '0') {
            await sql`
                INSERT INTO menu (nombre, precio, categoria) VALUES 
                ('Hamburguesa Sencilla', 5.00, 'Plato Principal'),
                ('Hamburguesa Doble', 7.50, 'Plato Principal'),
                ('Papas Fritas', 2.50, 'Acompañamiento'),
                ('Gaseosa', 1.50, 'Bebida'),
                ('Cerveza', 3.00, 'Bebida')
            `;
            console.log("Menú inicial creado.");
        }
        
        console.log("Esquema de base de datos inicializado correctamente.");
    } catch (err) {
        console.error("Error inicializando la base de datos:", err);
    } finally {
        await sql.end();
        process.exit(0);
    }
}

initDB();
