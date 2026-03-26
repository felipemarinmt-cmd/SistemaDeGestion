const express = require('express');
const cors = require('cors');
const apiRoutes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares
app.use(cors());
app.use(express.json());

// Servir la carpeta estática del frontend
app.use(express.static('public'));

// Enrutamiento de la API
app.use('/api', apiRoutes);

app.listen(PORT, () => {
    console.log(`Servidor de Comandas corriendo en http://localhost:${PORT}`);
    console.log(`- Vista móvil: http://localhost:${PORT}/comandas.html`);
    console.log(`- Vista admin: http://localhost:${PORT}/admin.html`);
});
