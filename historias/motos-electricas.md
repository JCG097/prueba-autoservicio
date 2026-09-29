# Tarifa diferenciada para motos eléctricas

Como administrador quiero cobrar una tarifa menor a las motos eléctricas para incentivar su uso.

Criterios de aceptación:
- Dado que registro el ingreso de una moto con placa ABC12D y el indicador electrica: true, cuando registro su salida después de 2 horas, entonces se cobran $2,000 ($1,000 por hora).
- Dada una moto sin el indicador electrica, cuando registro su salida después de 2 horas, entonces se cobran $3,000, como hoy.
- Dado un carro con el indicador electrica: true, cuando registro el ingreso, entonces responde 400 con el mensaje "El indicador eléctrico solo aplica a motos."
