const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir la carpeta estática del frontend (ahora todo es Serverless)
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`⚡ Servidor de Frontend Estático desplegado`);
    console.log(`🌐 Ingresa tu navegador a: http://localhost:${PORT}`);
});
