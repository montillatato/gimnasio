// APP GIMNASIO — objetivo alimentario de cada persona (lo decide la nutricionista deportóloga, no el entrenador).
// objetivoComida: clave de OBJETIVOS_COMIDA en motor.js (ahí están los números que usa la evaluación).
// texto: párrafos para mostrar en la sección Comida. Sin datos personales: los números salen del perfil al evaluar.
// Si se cambia un número acá, cambiarlo también en OBJETIVOS_COMIDA (motor.js) y al revés.

export const NUTRICION = {
  'USR-001': {
    objetivoComida: 'superavit_chico',
    titulo: 'Comida: músculo sin grasa visible',
    texto: [
      'Objetivo: ganar músculo en todo el cuerpo sin que se vea grasa, con mucho cardio en la semana. Calorías: superávit chico, meta +5% sobre mantenimiento; en línea de 0 a +10%. No es una etapa de volumen: arriba de +10% se suma más grasa que músculo.',
      'Por qué: en personas entrenadas, un superávit de ~5% y uno de ~15% durante 8 semanas dieron un crecimiento muscular parecido, y el grande sumó más grasa (Helms y col., 2023). Para quien ya entrena, lo recomendado es un superávit moderado y una suba de peso lenta, del orden de 0.25 a 0.5% del peso por semana (Iraki y col., 2019). Como el objetivo es no ganar grasa visible, se apunta al piso: 0.25% por semana.',
      'El cardio sube el gasto: tu mantenimiento real es más alto que en un plan solo de fuerza. Si el peso promedio de la semana no sube en 3 a 4 semanas, el superávit no existe: sumá unas 150 kcal por día (una colación). Si sube más de 0.5% por semana o la cintura crece, sacá esas 150 kcal.',
      'Proteína: de 1.6 a 2.2 g por kilo por día; meta, 1.8 g/kg. Desde 1.6 g/kg el beneficio se aplana en promedio y 2.2 es el techo útil (Morton y col., 2018). Repartida en 3 o 4 comidas de unos 0.4 g/kg cada una (Schoenfeld y Aragon, 2018): una después de entrenar y otra antes de dormir.',
      'Carbohidratos: de 4 a 6 g por kilo por día, más los días de piernas y de intervalos, y siempre una porción en la comida antes de los intervalos. La referencia de consenso es 3 a 5 g/kg con cargas bajas y 5 a 7 con alrededor de una hora diaria de ejercicio moderado (Thomas y col., 2016); fuerza de 80 a 90 minutos más cardio queda en el medio. Grasas: entre 20 y 35% de las calorías (misma fuente). El resto, verduras en medio plato de almuerzo y cena, 1 o 2 frutas y agua con cada comida.',
      'Cómo se evalúa cada día. Calorías y proteína pesan más: son las que mueven la composición corporal. En línea: calorías de 0 a +10% sobre mantenimiento, proteína de 1.6 g/kg o más y nada faltante ni de más en el resto de la lista. Parcial: proteína entre 1.2 y 1.6 g/kg, calorías hasta 3 puntos fuera del rango (el margen de error de la carga), algunos ultraprocesados o 1 o 2 detalles. No en línea: proteína debajo de 1.2 g/kg, calorías más de 3 puntos fuera del rango, o tres o más cosas mal.',
      'Mantenimiento: si está cargado en el perfil, se usa ese. Si no, se estima con peso, altura, edad, sexo y días de entrenamiento (Mifflin-St Jeor; puede errar un 10%) y se muestra como estimado. Se corrige con la tendencia del peso: el número que sirve es el que mantiene el peso estable.',
      'Un día no define nada. Lo que se mira es la semana: cargas subiendo, peso promedio subiendo despacio y cintura estable.',
    ],
  },
  'USR-002': {
    objetivoComida: 'deficit_leve',
    titulo: 'Tu comida: ganar músculo y bajar grasa de a poco',
    texto: [
      'Tu objetivo principal es ganar músculo y el segundo, bajar grasa. Para lograr las dos cosas a la vez vas a comer apenas por debajo de lo que gastás: un déficit leve, de 5% en promedio y nunca más de 10%. En la práctica son unas 100 a 200 kcal menos por día: no se siente como una dieta.',
      'Por qué así: el músculo necesita energía para crecer, y un déficit grande (desde unas 500 kcal menos por día) frena ese crecimiento (Murphy y Koehler, 2022). Uno chico deja que la grasa baje despacio mientras el entrenamiento sigue construyendo músculo. En personas que ya entrenan, ganar músculo y perder grasa a la vez es posible, aunque más lento que al principio (Barakat y col., 2020). Y bajar despacio cuida el músculo mejor que bajar rápido (Garthe y col., 2011).',
      '¿Por qué no comer justo lo que gastás o un poquito más? Porque así la grasa casi no se mueve, y bajarla es tu segundo objetivo. Pero el primero manda: si las cargas se frenan 2 o 3 semanas seguidas, el primer ajuste es subir a mantenimiento, nunca entrenar menos.',
      'Proteína, tu aliada: de 1.8 a 2.2 g por kilo por día, con una meta de 2 g/kg. Sin déficit, el beneficio se aplana desde 1.6 g/kg (Morton y col., 2018); con déficit conviene estar más arriba para proteger el músculo (Helms y col., 2014). En mujeres que entrenaban fuerza, comer más proteína dio más músculo y menos grasa (Campbell y col., 2018). Repartila en 3 o 4 comidas, con una fuente de proteína en cada una (carne, pollo, pescado, huevos, lácteos o legumbres) y una cerca del entrenamiento.',
      'El resto del plato: carbohidratos de 3 a 5 g por kilo por día, con la porción más grande antes o después de entrenar, que es cuando más rinden (Thomas y col., 2016). Grasas entre 20 y 35% de las calorías, sin bajar de ahí: aceite medido, frutos secos, palta, huevo (misma fuente). Medio plato de verduras en almuerzo y cena, 1 o 2 frutas y agua con cada comida.',
      'Cómo se evalúa tu día. La app mira siete cosas: calorías, proteína, verduras y fruta, ultraprocesados, carbohidratos, grasas y agua. Calorías y proteína pesan más, porque son las que cambian tu cuerpo.',
      'Día en línea: calorías entre 10% por debajo de tu mantenimiento y tu mantenimiento, proteína de 1.8 g/kg o más, y nada faltante ni de más en el resto.',
      'Vas bien, con algo para ajustar: proteína entre 1.4 y 1.8 g/kg, calorías hasta 3 puntos fuera del rango (es el margen de error al cargar), algunos ultraprocesados o 1 o 2 detalles. Es un buen día con un paso concreto para mejorar.',
      'Día lejos del objetivo: proteína debajo de 1.4 g/kg, calorías más de 3 puntos fuera del rango, o tres o más cosas a corregir. Pasa, y se corrige con el próximo paso que te muestra la app.',
      'Para los números la app usa tu perfil: el peso para la proteína y el mantenimiento para las calorías. Si no cargaste el mantenimiento, lo estima con tu peso, altura, edad, sexo y días de entrenamiento, y te lo muestra como estimado (puede errar un 10%). Si falta alguno de esos datos, evalúa con lo que marques en la lista.',
      'Un día no define nada: lo que cuenta es la semana. Vas bien si las cargas y las repeticiones suben, la cintura baja de a poco y el peso promedio de la semana se mantiene o baja hasta 0.5% por semana. Si baja más rápido, comé un poco más. Si en 3 o 4 semanas no se mueven ni el peso ni la cintura, se recortan unas 100 kcal por día.',
    ],
  },
};
