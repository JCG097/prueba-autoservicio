# Bloquear espacios por mantenimiento

Como administrador del parqueadero quiero bloquear un espacio en mantenimiento para que no se asigne a ningún vehículo mientras se repara.

Criterios de aceptación:
- Dado el espacio libre C-03, cuando lo bloqueo con POST /api/espacios/C-03/bloqueo, entonces responde 200 y el espacio queda en estado "mantenimiento".
- Dado que C-01 y C-02 están ocupados y C-03 está en mantenimiento, cuando registro el ingreso de un carro, entonces se le asigna C-04.
- Dado el espacio ocupado C-01, cuando intento bloquearlo, entonces responde 409 con el mensaje "El espacio C-01 está ocupado."
- Dado un espacio en mantenimiento, cuando lo desbloqueo con DELETE /api/espacios/C-03/bloqueo, entonces responde 200 y vuelve a estado "libre".
- En el mapa del parqueadero, un espacio en mantenimiento muestra el texto "Mantenimiento" en lugar de "Libre".
