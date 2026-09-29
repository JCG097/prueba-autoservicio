// Punto de entrada: arranca el servidor HTTP.
const { crearApp } = require('./app');

const PORT = process.env.PORT || 3000;

crearApp().listen(PORT, () => {
  console.log(`Parqueadero disponible en http://localhost:${PORT}`);
});
