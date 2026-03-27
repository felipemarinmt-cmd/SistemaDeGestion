require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./src/routes');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Configuración de Middlewares
app.use(cors());
app.use(express.json());

// Inyectar io en las rutas
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Servir la carpeta estática del frontend
app.use(express.static('public'));

// Enrutamiento de la API
app.use('/api', apiRoutes);

io.on('connection', (socket) => {
    console.log('CLiente WebSocket conectado:', socket.id);
});

server.listen(PORT, () => {
    console.log(`Servidor de Comandas corriendo en http://localhost:${PORT}`);
    console.log(`- Vista móvil: http://localhost:${PORT}/comandas.html`);
    console.log(`- Vista admin: http://localhost:${PORT}/admin.html`);
    console.log(`- Vista cocina: http://localhost:${PORT}/cocina.html`);
});
