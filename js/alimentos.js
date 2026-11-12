// APP GIMNASIO — tabla de alimentos y estimación de proteína y calorías a partir del texto de "¿Qué comiste?".
// La arma la nutricionista deportóloga. La estimación es orientativa: usa porciones típicas cuando no se escribe la cantidad.
//
// Fuente de los alimentos base: BEDCA (Base de Datos Española de Composición de Alimentos, www.bedca.net),
// valores por 100 g de porción comestible consultados el 12/11/2026. Energía: kJ de BEDCA / 4,184, redondeada.
// `fuente` lleva el número y el nombre del alimento en BEDCA. `estimado: true` marca lo que no sale directo de BEDCA
// (recetas con proporciones típicas, rendimientos de cocción o un dato de otra tabla) y `nota` dice por qué.
//
// Platos y recetas (argentinas y españolas): se definen por sus ingredientes en gramos crudos por porción y el peso
// de la porción ya hecha; la proteína y las calorías se calculan con los ingredientes de BEDCA.
//
// Cómo agregar un alimento: una línea en BASE (con su número de BEDCA) o en RECETAS (con sus ingredientes),
// sinónimos en minúscula como se escriben en la calle (tildes y mayúsculas no importan) y `node --test tests/`.

// ---------------------------------------------------------------- alimentos base (BEDCA, por 100 g)
// [clave, nombre, proteína g/100 g, kcal/100 g, fuente, opciones]
// opciones: sin (sinónimos; un sinónimo puede ser [texto, gramos de una unidad]), porcion (g de la porción típica),
// unidad (g de una unidad: "2 huevos"), medidas ({ loncha, rebanada, taza, vaso, cucharada, lata... } en g),
// estimado y nota. Sin sinónimos = solo se usa como ingrediente de recetas.
const BASE = [
  // Huevos
  ['huevo', 'Huevo', 12.5, 145, 'BEDCA 2126: Huevo de gallina, hervido, duro', { sin: ['huevo', 'huevo duro', 'huevo cocido', 'huevo hervido', 'huevo pasado por agua', 'huevo poche', 'huevo escalfado'], porcion: 50, unidad: 50 }],
  ['huevo_crudo', 'Huevo (crudo, para recetas)', 12.5, 149, 'BEDCA 2127: Huevo de gallina fresco', {}],
  ['huevo_frito', 'Huevo frito', 13.4, 185, 'BEDCA 759: Huevo de gallina, frito', { sin: ['huevo frito', 'huevo a la plancha'], porcion: 50, unidad: 50 }],
  ['huevos_revueltos', 'Huevos revueltos', 10.2, 228, 'BEDCA 761: Huevo de gallina, revuelto, con mantequilla', { sin: ['huevos revueltos', 'huevo revuelto', 'revuelto de huevo', 'revuelto'], porcion: 120, unidad: 60 }],
  ['clara', 'Clara de huevo', 10.5, 45, 'BEDCA 1173: Huevo de gallina, clara, cruda', { sin: ['clara', 'clara de huevo'], porcion: 33, unidad: 33 }],
  ['tortilla_francesa', 'Tortilla francesa', 14.6, 170, 'BEDCA 779: Tortilla, a la francesa', { sin: ['tortilla francesa', 'tortilla a la francesa', 'omelette', 'omelet', 'tortilla de huevo'], porcion: 110 }],
  // Aves
  ['pechuga_pollo', 'Pechuga de pollo a la plancha', 22.2, 145, 'BEDCA 2297: Pollo, pechuga, plancha', { sin: ['pechuga', 'pechuga de pollo', 'pechuga a la plancha', 'pollo a la plancha', 'pollo plancha', 'filete de pollo', 'suprema', 'suprema de pollo'], porcion: 150, unidad: 150 }],
  ['pechuga_pollo_cruda', 'Pechuga de pollo (cruda, para recetas)', 23.1, 104, 'BEDCA 994: Pollo, pechuga, con piel, crudo', {}],
  ['pollo_asado', 'Pollo asado', 32.6, 177, 'BEDCA 980: Pollo, entero, con piel, asado', { sin: ['pollo', 'pollo asado', 'pollo al horno', 'pollo con piel', 'cuarto de pollo'], porcion: 150 }],
  ['muslo_pollo', 'Muslo de pollo asado', 26.3, 226, 'BEDCA 992: Pollo, muslo, con piel, asado', { sin: ['muslo', 'muslo de pollo', 'contramuslo', 'pata muslo', 'pata de pollo'], porcion: 100, unidad: 100 }],
  ['pollo_empanado', 'Pollo empanado frito', 17.6, 227, 'BEDCA 2290: Pollo empanado, frito', { sin: ['pollo empanado', 'pollo rebozado', 'pollo frito', 'nuggets', 'nuggets de pollo'], porcion: 120 }],
  ['pavo', 'Pechuga de pavo a la plancha', 29.9, 145, 'BEDCA 990: Pavo, pechuga, sin piel, a la plancha', { sin: ['pavo', 'pechuga de pavo', 'pavo a la plancha', 'filete de pavo'], porcion: 150, unidad: 150 }],
  ['pavo_fiambre', 'Fiambre de pavo', 15.3, 147, 'BEDCA 2286: Pavo, fiambre', { sin: ['fiambre de pavo', 'pavo en lonchas', 'lonchas de pavo', 'pechuga de pavo en lonchas', 'jamon de pavo'], porcion: 45, medidas: { loncha: 15 } }],
  // Carnes
  ['ternera', 'Carne de ternera asada', 29.5, 221, 'BEDCA 989: Ternera, parte s/e, asada', { sin: ['ternera', 'carne', 'carne de vaca', 'carne vacuna', 'carne de ternera', 'carne asada', 'carne a la plancha', 'filete', 'filete de ternera', 'bistec', 'bife', 'bife de chorizo', 'churrasco', 'entrecot', 'vacio', 'entrana', 'nalga', 'cuadril', 'peceto'], porcion: 150, unidad: 150 }],
  ['solomillo', 'Solomillo de ternera asado', 28.4, 156, 'BEDCA 984: Ternera, solomillo, asado', { sin: ['solomillo', 'solomillo de ternera', 'lomo de ternera', 'lomo vacuno'], porcion: 150, unidad: 150 }],
  ['ternera_magra_cruda', 'Ternera magra (cruda, para recetas)', 20.2, 109, 'BEDCA 1029: Ternera, solomillo, sin grasa, crudo', {}],
  ['ternera_cruda', 'Ternera con grasa (cruda, para recetas)', 16.7, 254, 'BEDCA 2315: Ternera, parte sin especificar, cruda, con grasa separable', {}],
  ['costilla_ternera_cruda', 'Costilla de ternera (cruda, para recetas)', 20, 140, 'BEDCA 1030: Ternera, costilla, cruda', {}],
  ['carne_picada_cruda', 'Carne picada (cruda, para recetas)', 15.2, 243, 'BEDCA 2680: Carne picada', {}],
  ['cerdo', 'Lomo de cerdo asado', 27, 236, 'BEDCA 688: Cerdo, lomo, asado', { sin: ['cerdo', 'lomo', 'lomo de cerdo', 'cinta de lomo', 'chuleta', 'chuleta de cerdo', 'carne de cerdo', 'filete de cerdo', 'solomillo de cerdo'], porcion: 150, unidad: 150 }],
  ['panceta_cruda', 'Panceta (cruda, para recetas)', 12.5, 465, 'BEDCA 2260: Cerdo, panceta, cruda', {}],
  // Fiambres y embutidos
  ['jamon_cocido', 'Jamón cocido', 21, 113, 'BEDCA 965: Jamón cocido, categoría s/e', { sin: ['jamon cocido', 'jamon york', 'jamon de york', 'fiambre de jamon'], porcion: 40, medidas: { loncha: 20 } }],
  ['jamon_serrano', 'Jamón serrano', 28.8, 318, 'BEDCA 2273: Jamón serrano', { sin: ['jamon', 'jamon serrano', 'jamon iberico', 'jamon crudo'], porcion: 30, medidas: { loncha: 10 } }],
  ['salchicha', 'Salchicha tipo Frankfurt', 12.7, 287, 'BEDCA 2309: Salchicha, tipo "frankfurt"', { sin: ['salchicha', 'salchicha frankfurt', 'frankfurt', 'salchicha de viena'], porcion: 40, unidad: 40 }],
  ['salchicha_fresca', 'Salchicha fresca o chorizo parrillero', 13.1, 306, 'BEDCA 2305: Salchicha, fresca', { sin: ['salchicha fresca', 'chorizo parrillero', 'chorizo criollo', 'longaniza'], porcion: 100, unidad: 100 }],
  ['chorizo', 'Chorizo curado', 27, 322, 'BEDCA 2264: Chorizo', { sin: ['chorizo', 'chorizo curado'], porcion: 30, medidas: { loncha: 6 } }],
  ['morcilla', 'Morcilla', 11, 323, 'BEDCA 2280: Morcilla', { sin: ['morcilla'], porcion: 75, unidad: 75 }],
  ['mortadela', 'Mortadela', 14, 294, 'BEDCA 2282: Mortadela', { sin: ['mortadela'], porcion: 30, medidas: { loncha: 15 } }],
  // Pescados y mariscos
  ['atun', 'Atún al natural', 23.5, 101, 'BEDCA 2133: Atún, al natural', { sin: ['atun', 'atun al natural'], porcion: 60, medidas: { lata: 60 } }],
  ['atun_aceite', 'Atún en aceite', 26.5, 179, 'BEDCA 2130: Atún en aceite de oliva', { sin: ['atun en aceite', 'atun en aceite de oliva', 'atun en aceite de girasol'], porcion: 60, medidas: { lata: 60 } }],
  ['merluza', 'Merluza', 11.9, 64, 'BEDCA 2347: Merluza fresca', { sin: ['merluza', 'pescado', 'pescado blanco', 'filete de merluza', 'filete de pescado', 'pescadilla'], porcion: 150, unidad: 150 }],
  ['merluza_rebozada', 'Merluza rebozada frita', 10.7, 149, 'BEDCA 2348: Merluza, rebozada, frita', { sin: ['merluza rebozada', 'pescado rebozado', 'pescado frito', 'milanesa de merluza', 'milanesa de pescado'], porcion: 120, unidad: 120 }],
  ['bacalao', 'Bacalao al horno', 22.1, 99, 'BEDCA 795: Bacalao, fresco, al horno', { sin: ['bacalao'], porcion: 150 }],
  ['salmon', 'Salmón a la plancha', 20.2, 179, 'BEDCA 2628: Salmón, plancha', { sin: ['salmon', 'filete de salmon'], porcion: 150, unidad: 150 }],
  ['sardinas', 'Sardinas en aceite (lata)', 23.9, 237, 'BEDCA 2632: Sardina, enlatada, en aceite, escurrida', { sin: ['sardina', 'sardinas en lata', 'sardinillas'], porcion: 60, medidas: { lata: 60 } }],
  ['gambas', 'Gambas o langostinos hervidos', 19.8, 95, 'BEDCA 2337: Gamba, hervida', { sin: ['gamba', 'langostino', 'camaron'], porcion: 100 }],
  // Lácteos
  ['leche', 'Leche entera', 3.1, 65, 'BEDCA 2493: Leche de vaca, entera', { sin: ['leche', 'leche entera'], porcion: 200, medidas: { taza: 250 } }],
  ['leche_semi', 'Leche semidesnatada', 3.2, 46, 'BEDCA 916: Leche, semidesnatada, pasteurizada', { sin: ['leche semidesnatada', 'leche semi', 'semidesnatada'], porcion: 200, medidas: { taza: 250 } }],
  ['leche_desnatada', 'Leche desnatada', 3.3, 34, 'BEDCA 915: Leche, desnatada, pasteurizada', { sin: ['leche desnatada', 'leche descremada', 'desnatada'], porcion: 200, medidas: { taza: 250 } }],
  ['yogur', 'Yogur natural', 3.2, 63, 'BEDCA 1143: Yogur, enriquecido, natural', { sin: ['yogur', 'yogurt', 'yoghurt', 'yogur natural'], porcion: 125, unidad: 125 }],
  ['yogur_desnatado', 'Yogur desnatado natural', 4.3, 46, 'BEDCA 2530: Yogur, desnatado, sabor natural', { sin: ['yogur desnatado', 'yogur natural desnatado', 'yogur descremado', 'yogur light'], porcion: 125, unidad: 125 }],
  ['yogur_sabores', 'Yogur de sabores', 5.3, 64, 'BEDCA 2532: Yogur, desnatado, aromatizado sabor s/e', { sin: ['yogur de sabores', 'yogur de sabor', 'yogur de fresa', 'yogur de vainilla', 'yogur de frutas', 'yogur con frutas'], porcion: 125, unidad: 125 }],
  ['yogur_liquido', 'Yogur líquido', 3, 70, 'BEDCA 1133: Yogur líquido, natural, azucarado', { sin: ['yogur liquido', 'yogur bebible'], porcion: 200, unidad: 200 }],
  ['yogur_griego', 'Yogur griego', 6.4, 138, 'BEDCA 2520: Yogur griego', { sin: ['yogur griego'], porcion: 125, unidad: 125 }],
  ['queso_fresco', 'Queso fresco', 12.4, 197, 'BEDCA 2507: Queso fresco de burgos', { sin: ['queso fresco', 'queso de burgos'], porcion: 60 }],
  ['mozzarella', 'Mozzarella', 19.5, 222, 'BEDCA 2510: Queso mozzarella', { sin: ['mozzarella', 'muzzarella', 'mozarella', 'muzarela', 'muzza'], porcion: 30 }],
  ['queso_tierno', 'Queso tierno', 26, 330, 'BEDCA 2516: Queso tierno, genérico', { sin: ['queso tierno', 'queso cremoso', 'queso por salut', 'queso de maquina', 'queso en lonchas', 'queso de sandwich', 'queso gouda', 'queso edam'], porcion: 30, medidas: { loncha: 20 } }],
  ['queso', 'Queso semicurado', 29, 389, 'BEDCA 2515: Queso semicurado, genérico', { sin: ['queso', 'queso semicurado', 'queso semi'], porcion: 30, medidas: { loncha: 20 } }],
  ['queso_curado', 'Queso curado (manchego)', 28.8, 388, 'BEDCA 2508: Queso manchego', { sin: ['queso manchego', 'manchego', 'queso curado', 'queso viejo'], porcion: 30, medidas: { loncha: 15 } }],
  ['queso_rallado', 'Queso rallado', 26.9, 393, 'BEDCA 2513: Queso rallado, genérico', { sin: ['queso rallado', 'parmesano', 'queso parmesano', 'reggianito'], porcion: 10, medidas: { cucharada: 7 } }],
  ['queso_untar', 'Queso para untar', 15.6, 359, 'BEDCA 2511: Queso para untar', { sin: ['queso para untar', 'queso de untar', 'queso crema', 'queso untable', 'philadelphia', 'queso blanco'], porcion: 20, medidas: { cucharada: 20 } }],
  ['requeson', 'Requesón o ricota', 12.3, 101, 'BEDCA 2517: Requesón', { sin: ['requeson', 'ricota', 'ricotta'], porcion: 60 }],
  // Panes, cereales y harinas
  ['pan', 'Pan blanco de barra', 8.3, 239, 'BEDCA 2160: Pan blanco, de barra', { sin: ['pan', 'pan blanco', 'pan de barra', ['barra de pan', 250], 'baguette', 'pan frances', 'pan casero', 'pan de pueblo', 'chapata'], porcion: 60, unidad: 60, medidas: { rebanada: 30 } }],
  ['pan_integral', 'Pan integral', 10.9, 250, 'BEDCA 2163: Pan integral', { sin: ['pan integral', 'pan multicereal'], porcion: 60, unidad: 60, medidas: { rebanada: 30 } }],
  ['pan_molde', 'Pan de molde', 7.3, 248, 'BEDCA 2161: Pan blanco, de molde, tostado', { sin: ['pan de molde', 'pan lactal', 'pan de sandwich'], porcion: 50, unidad: 25, medidas: { rebanada: 25 } }],
  ['pan_tostado', 'Tostada de pan', 10.1, 304, 'BEDCA 2165: Pan blanco, tostado', { sin: ['tostada', 'pan tostado', 'biscote'], porcion: 40, unidad: 40 }],
  ['pan_rallado', 'Pan rallado (para recetas)', 8.5, 258, 'BEDCA 2171: Pan rallado', {}],
  ['pan_hamburguesa', 'Pan de hamburguesa', 7.5, 265, 'BEDCA 2174: Pan, tipo hamburguesa', { sin: ['pan de hamburguesa', 'pan de perrito', 'pan de pancho'], porcion: 60, unidad: 60 }],
  ['croissant', 'Croissant', 7.5, 406, 'BEDCA 2669: Croissant', { sin: ['croissant', 'cruasan'], porcion: 50, unidad: 50 }],
  ['galletas', 'Galletas tipo María', 7.1, 477, 'BEDCA 2675: Galletas tipo maria', { sin: ['galleta', 'galletas maria', 'galletita', 'galletitas dulces', 'galletas dulces'], porcion: 30, unidad: 7 }],
  ['galletas_saladas', 'Galletas saladas', 9.4, 408, 'BEDCA 2672: Galleta salada', { sin: ['galletas saladas', 'galleta salada', 'crackers', 'galletitas de agua', 'galletas de agua'], porcion: 30, unidad: 5 }],
  ['arroz_crudo', 'Arroz (crudo, para recetas)', 7, 386, 'BEDCA 2660: Arroz', {}],
  ['arroz_integral', 'Arroz integral hervido', 2.6, 112, 'BEDCA 1009: Arroz integral, hervido', { sin: ['arroz integral'], porcion: 200, medidas: { taza: 160 } }],
  ['pasta', 'Pasta hervida', 4.7, 125, 'BEDCA 1072: Pasta alimenticia, con huevo, hervida', { sin: ['pasta', 'pasta hervida', 'fideo', 'macarron', 'espaguetis', 'espagueti', 'spaghetti', 'tallarin', 'tallarines', 'tirabuzon', 'mostachol', 'penne'], porcion: 200, medidas: { taza: 140 } }],
  ['pasta_cruda', 'Pasta seca (cruda)', 12.5, 352, 'BEDCA 1117: Pasta alimenticia, cruda', { sin: ['pasta cruda', 'pasta seca'], porcion: 80 }],
  ['avena', 'Copos de avena', 16.9, 399, 'BEDCA 1010: Avena, cruda', { sin: ['avena', 'copos de avena'], porcion: 40, medidas: { cucharada: 10 } }],
  ['muesli', 'Muesli o granola', 10.3, 370, 'BEDCA 2155: Cereales desayuno base muesli', { sin: ['muesli', 'granola'], porcion: 40 }],
  ['cereales', 'Cereales de desayuno', 6, 379, 'BEDCA 1032: Cereales desayuno base de maíz y trigo', { sin: ['cereales', 'cereales de desayuno', 'copos de maiz', 'corn flakes', 'cornflakes'], porcion: 30 }],
  ['harina_trigo', 'Harina de trigo (para recetas)', 10, 331, 'BEDCA 2677: Harina de trigo', {}],
  ['harina_maiz', 'Harina de maíz (para recetas)', 8.3, 328, 'BEDCA 2644: Harina de maíz', {}],
  ['maiz_seco', 'Maíz en grano seco (para recetas)', 8.4, 390, 'BEDCA 1114: Maíz, en mazorca, crudo', {}],
  // Platos preparados de BEDCA
  ['pizza', 'Pizza precocinada', 8.2, 210, 'BEDCA 2589: Pizza, precocinada', { sin: ['pizza', 'pizza congelada', 'pizza precocinada'], porcion: 120, unidad: 400, medidas: { porcion: 120 } }],
  ['empanada_gallega', 'Empanada gallega', 21.9, 298, 'BEDCA 2620: Empanada de carne', { sin: ['empanada gallega'], porcion: 150 }],
  ['empanadilla', 'Empanadilla', 4.8, 247, 'BEDCA 2619: Empanadilla', { sin: ['empanadilla'], porcion: 80, unidad: 40 }],
  ['lasana', 'Lasaña', 6.3, 137, 'BEDCA 2604: Lasaña', { sin: ['lasana', 'lasagna'], porcion: 300 }],
  ['paella', 'Paella', 12.4, 172, 'BEDCA 2597: Paella', { sin: ['paella'], porcion: 300 }],
  ['gazpacho', 'Gazpacho', 0.6, 34, 'BEDCA 2614: Gazpacho', { sin: ['gazpacho'], porcion: 250 }],
  ['croquetas', 'Croquetas', 5.8, 154, 'BEDCA 2268: Croquetas de pollo', { sin: ['croqueta', 'croquetas de pollo', 'croquetas de jamon'], porcion: 120, unidad: 30 }],
  ['churros', 'Churros', 4.6, 358, 'BEDCA 2668: Churro', { sin: ['churro', 'porra'], porcion: 100, unidad: 20 }],
  ['flan', 'Flan de huevo', 4.8, 132, 'BEDCA 2486: Flan de huevo', { sin: ['flan', 'flan de huevo'], porcion: 100, unidad: 100 }],
  ['arroz_con_leche', 'Arroz con leche', 3.3, 92, 'BEDCA 2479: Arroz con leche', { sin: ['arroz con leche'], porcion: 150 }],
  ['bizcocho', 'Bizcocho', 6.5, 381, 'BEDCA 2664: Bizcocho', { sin: ['bizcocho', 'bizcochuelo'], porcion: 60 }],
  ['magdalena', 'Magdalena', 6.1, 385, 'BEDCA 2678: Magdalena', { sin: ['magdalena', 'madalena', 'muffin'], porcion: 30, unidad: 30 }],
  ['donut', 'Donut', 6.1, 394, 'BEDCA 2670: Donut', { sin: ['donut', 'dona'], porcion: 50, unidad: 50 }],
  ['ensaimada', 'Ensaimada', 5.7, 456, 'BEDCA 2671: Ensaimada', { sin: ['ensaimada'], porcion: 60, unidad: 60 }],
  // Frutas
  ['platano', 'Plátano', 1.2, 89, 'BEDCA 2245: Plátano', { sin: ['platano', 'banana', 'banano'], porcion: 120, unidad: 120 }],
  ['manzana', 'Manzana', 0.3, 50, 'BEDCA 2231: Manzana', { sin: ['manzana'], porcion: 150, unidad: 150 }],
  ['mandarina', 'Mandarina', 0.8, 40, 'BEDCA 2229: Mandarina', { sin: ['mandarina'], porcion: 70, unidad: 70 }],
  ['naranja', 'Naranja', 0.8, 38, 'BEDCA 2235: Naranja', { sin: ['naranja'], porcion: 150, unidad: 150 }],
  ['pera', 'Pera', 0.4, 45, 'BEDCA 2241: Pera', { sin: ['pera'], porcion: 150, unidad: 150 }],
  ['fresa', 'Fresas', 0.7, 36, 'BEDCA 2225: Fresa', { sin: ['fresa', 'frutilla'], porcion: 150 }],
  ['uva', 'Uvas', 0.6, 68, 'BEDCA 2249: Uva blanca', { sin: ['uva'], porcion: 150 }],
  ['melocoton', 'Melocotón', 0.6, 39, 'BEDCA 2232: Melocotón', { sin: ['melocoton', 'durazno'], porcion: 150, unidad: 150 }],
  ['kiwi', 'Kiwi', 1.1, 52, 'BEDCA 2228: Kiwi', { sin: ['kiwi'], porcion: 75, unidad: 75 }],
  ['aguacate', 'Aguacate o palta', 1.5, 136, 'BEDCA 2216: Aguacate', { sin: ['aguacate', 'palta'], porcion: 70, unidad: 140 }],
  ['melon', 'Melón', 0.6, 27, 'BEDCA 2234: Melón', { sin: ['melon'], porcion: 200, medidas: { rebanada: 200 } }],
  ['sandia', 'Sandía', 0.4, 20, 'BEDCA 2247: Sandía', { sin: ['sandia'], porcion: 250, medidas: { rebanada: 250 } }],
  ['pina', 'Piña o ananá', 0.5, 49, 'BEDCA 2242: Piña', { sin: ['pina', 'anana'], porcion: 150, medidas: { rebanada: 80 } }],
  ['cereza', 'Cerezas', 0.8, 63, 'BEDCA 2220: Cereza', { sin: ['cereza'], porcion: 100 }],
  // Verduras y hortalizas
  ['lechuga', 'Lechuga', 1.1, 16, 'BEDCA 2399: Lechuga', { sin: ['lechuga'], porcion: 50 }],
  ['tomate', 'Tomate', 0.9, 19, 'BEDCA 2421: Tomate', { sin: ['tomate'], porcion: 120, unidad: 120 }],
  ['zanahoria', 'Zanahoria', 0.8, 34, 'BEDCA 2424: Zanahoria, cruda', { sin: ['zanahoria'], porcion: 70, unidad: 70 }],
  ['ensalada', 'Ensalada verde (sin aliñar)', 1.1, 19, 'BEDCA 2389: Ensalada', { sin: ['ensalada', 'ensalada verde', 'ensalada de lechuga', 'lechuga y tomate', 'ensalada de lechuga y tomate'], porcion: 150 }],
  ['patata_cruda', 'Patata (cruda, para recetas)', 2.2, 72, 'BEDCA 2403: Patata, cruda', {}],
  ['patata', 'Patata hervida', 2.4, 75, 'BEDCA 2404: Patata, hervida', { sin: ['patata', 'papa', 'patata hervida', 'patata cocida', 'papa hervida'], porcion: 200, unidad: 150 }],
  ['patatas_fritas', 'Patatas fritas', 3.8, 289, 'BEDCA 883: Patata, frita con aceite s/e, sin sal', { sin: ['patatas fritas', 'papas fritas', 'patata frita', 'papa frita'], porcion: 150 }],
  ['patatas_chips', 'Patatas chips', 6.5, 536, 'BEDCA 2594: Patatas, fritas, chips', { sin: ['patatas chips', 'chips', 'patatas de bolsa', 'papas fritas de bolsa', 'papitas'], porcion: 30 }],
  ['pure', 'Puré de patata', 2.2, 94, 'BEDCA 887: Puré, de patata, con leche', { sin: ['pure', 'pure de patata', 'pure de papa'], porcion: 200 }],
  ['boniato', 'Boniato o batata', 1.2, 101, 'BEDCA 731: Boniato, crudo', { sin: ['boniato', 'batata', 'camote'], porcion: 200, unidad: 200, estimado: true, nota: 'Valor del boniato crudo; asado concentra un poco más las calorías.' }],
  ['calabaza_cruda', 'Calabaza (cruda, para recetas)', 1.2, 32, 'BEDCA 2378: Calabaza, cruda', {}],
  ['calabaza', 'Calabaza hervida', 0.6, 12, 'BEDCA 1183: Calabaza, hervida', { sin: ['calabaza', 'zapallo'], porcion: 200 }],
  ['calabacin', 'Calabacín', 1.8, 17, 'BEDCA 2376: Calabacín', { sin: ['calabacin', 'zapallito', 'zucchini'], porcion: 150 }],
  ['brocoli', 'Brócoli hervido', 3.1, 24, 'BEDCA 2372: Brécol, hervido', { sin: ['brocoli', 'brecol'], porcion: 150 }],
  ['espinacas', 'Espinacas hervidas', 2.4, 22, 'BEDCA 2395: Espinaca, hervida', { sin: ['espinaca'], porcion: 150 }],
  ['acelgas', 'Acelgas hervidas', 1.9, 29, 'BEDCA 2360: Acelgas, hervidas', { sin: ['acelga'], porcion: 150 }],
  ['judias_verdes', 'Judías verdes', 2.2, 28, 'BEDCA 2198: Judía verde, cruda', { sin: ['judias verdes', 'judia verde', 'chaucha', 'vainita'], porcion: 150, estimado: true, nota: 'Se usa el valor crudo: el de "hervida" en BEDCA (83 kcal) no es coherente con el crudo.' }],
  ['cebolla', 'Cebolla', 1.1, 26, 'BEDCA 2381: Cebolla', { sin: ['cebolla'], porcion: 50, unidad: 100 }],
  ['pimiento', 'Pimiento', 1.3, 29, 'BEDCA 2409: Pimiento rojo, crudo', { sin: ['pimiento', 'pimiento rojo', 'morron'], porcion: 50, unidad: 150 }],
  ['berenjena', 'Berenjena', 0.7, 20, 'BEDCA 2370: Berenjena', { sin: ['berenjena'], porcion: 150 }],
  ['champinones', 'Champiñones', 1.8, 26, 'BEDCA 2384: Champiñon', { sin: ['champinon', 'champinones', 'seta', 'hongos'], porcion: 100 }],
  ['coliflor', 'Coliflor hervida', 2.8, 27, 'BEDCA 2387: Coliflor, hervida', { sin: ['coliflor'], porcion: 150 }],
  ['tomate_frito', 'Tomate frito o salsa de tomate', 1.5, 84, 'BEDCA 2560: Tomate frito', { sin: ['tomate frito', 'salsa de tomate', 'tuco'], porcion: 60 }],
  // Legumbres (secas para recetas; cocidas y de bote para el plato)
  ['lentejas_secas', 'Lentejas secas (crudas)', 24.8, 309, 'BEDCA 1065: Lenteja, seca, cruda', { sin: ['lentejas secas', 'lentejas crudas'], porcion: 70 }],
  ['garbanzos_secos', 'Garbanzos secos (crudos)', 19.3, 334, 'BEDCA 1020: Garbanzo, seco, crudo', { sin: ['garbanzos secos', 'garbanzos crudos'], porcion: 70 }],
  ['alubias_secas', 'Alubias secas (crudas)', 22.2, 271, 'BEDCA 899: Alubia blanca, seca, cruda', { sin: ['alubias secas', 'porotos secos'], porcion: 70 }],
  ['lentejas_bote', 'Lentejas de bote', 6.3, 74, 'BEDCA 1126: Lenteja, en conserva', { sin: ['lentejas de bote', 'lentejas en conserva', 'lentejas en lata'], porcion: 200 }],
  ['garbanzos_bote', 'Garbanzos de bote', 7.2, 133, 'BEDCA 2191: Garbanzo, en conserva', { sin: ['garbanzos de bote', 'garbanzos en conserva', 'garbanzos en lata'], porcion: 200 }],
  ['alubias_bote', 'Alubias de bote', 6.7, 93, 'BEDCA 898: Alubia blanca, en conserva', { sin: ['alubias de bote', 'alubias en conserva', 'judias de bote', 'porotos en lata'], porcion: 200 }],
  ['guisantes', 'Guisantes o arvejas', 6, 60, 'BEDCA 1045: Guisante, congelado, hervido', { sin: ['guisante', 'arveja'], porcion: 100 }],
  ['tofu', 'Tofu', 11.5, 119, 'BEDCA 1121: Tofu', { sin: ['tofu'], porcion: 100 }],
  ['bebida_soja', 'Bebida de soja', 3.2, 53, 'BEDCA 2491: Bebida de soja', { sin: ['bebida de soja', 'leche de soja'], porcion: 200 }],
  // Frutos secos
  ['cacahuetes', 'Cacahuetes o maní', 24.5, 597, 'BEDCA 2186: Cacahuete, tostado, salado', { sin: ['cacahuete', 'mani', 'manies'], porcion: 30, medidas: { punado: 30 } }],
  ['almendras', 'Almendras', 22.9, 588, 'BEDCA 2182: Almendra, tostada', { sin: ['almendra'], porcion: 30, medidas: { punado: 30 } }],
  ['nueces', 'Nueces', 14, 592, 'BEDCA 2201: Nuez', { sin: ['nuez', 'nueces'], porcion: 30, unidad: 5, medidas: { punado: 30 } }],
  ['avellanas', 'Avellanas', 12, 653, 'BEDCA 2219: Avellana', { sin: ['avellana'], porcion: 30, medidas: { punado: 30 } }],
  ['crema_cacahuete', 'Crema de cacahuete', 25.5, 600, 'BEDCA 979: Crema de cacahuete', { sin: ['crema de cacahuete', 'mantequilla de cacahuete', 'mantequilla de mani', 'pasta de mani', 'crema de mani'], porcion: 15, medidas: { cucharada: 15 } }],
  // Grasas
  ['aceite', 'Aceite de oliva', 0, 883, 'BEDCA 2543: Aceite de oliva', { sin: ['aceite', 'aceite de oliva', 'aove', 'aceite de oliva virgen extra', 'aceite de oliva virgen'], porcion: 10, medidas: { cucharada: 10, cucharadita: 4 } }],
  ['aceite_girasol', 'Aceite de girasol', 0, 883, 'BEDCA 2541: Aceite de girasol', { sin: ['aceite de girasol', 'aceite de maiz'], porcion: 10, medidas: { cucharada: 10, cucharadita: 4 } }],
  ['mantequilla', 'Mantequilla', 0.7, 730, 'BEDCA 756: Mantequilla salada', { sin: ['mantequilla', 'manteca'], porcion: 10, medidas: { cucharada: 12, cucharadita: 5 } }],
  ['mayonesa', 'Mayonesa', 2.1, 782, 'BEDCA 874: Mayonesa, aceite de oliva', { sin: ['mayonesa', 'mahonesa'], porcion: 15, medidas: { cucharada: 15 } }],
  // Dulces y untables
  ['mermelada', 'Mermelada', 0.3, 249, 'BEDCA 2656: Mermelada de fresa', { sin: ['mermelada', 'confitura'], porcion: 20, medidas: { cucharada: 20 } }],
  ['azucar', 'Azúcar', 0, 406, 'BEDCA 2642: Azúcar blanca', { sin: ['azucar'], porcion: 5, medidas: { cucharada: 12, cucharadita: 5, sobre: 8 } }],
  ['miel', 'Miel', 0.5, 314, 'BEDCA 2643: Miel', { sin: ['miel'], porcion: 20, medidas: { cucharada: 20, cucharadita: 7 } }],
  ['chocolate', 'Chocolate con leche', 9.2, 536, 'BEDCA 2651: Chocolate con leche', { sin: ['chocolate', 'chocolate con leche'], porcion: 20, medidas: { onza: 6 } }],
  ['chocolate_negro', 'Chocolate negro', 4.7, 541, 'BEDCA 788: Chocolate, negro', { sin: ['chocolate negro', 'chocolate amargo'], porcion: 20, medidas: { onza: 6 } }],
  ['crema_cacao', 'Crema de cacao con avellanas', 5.4, 541, 'BEDCA 783: Crema de chocolate con avellanas', { sin: ['crema de cacao', 'crema de chocolate', 'nocilla', 'nutella'], porcion: 15, medidas: { cucharada: 15 } }],
  ['helado', 'Helado', 3.9, 210, 'BEDCA 2489: Helado de nata', { sin: ['helado'], porcion: 100, medidas: { bola: 60 } }],
  // Bebidas
  ['cafe', 'Café solo', 0.1, 2, 'BEDCA 2433: Café, infusión', { sin: ['cafe', 'cafe solo', 'espresso', 'expreso', 'cafe americano', 'americano'], porcion: 100 }],
  ['cafe_con_leche', 'Café con leche', 1.7, 38, 'BEDCA 681: Café, con leche', { sin: ['cafe con leche', 'cortado', 'cafe cortado', 'lagrima'], porcion: 200 }],
  ['te_con_leche', 'Té con leche', 1.7, 38, 'BEDCA 1094: Té, infusión, con leche', { sin: ['te con leche'], porcion: 200 }],
  ['infusion', 'Té, mate o infusión', 0, 1, 'Estimado: infusión sin azúcar (BEDCA no tiene té ni mate solos; se toma el café infusión, BEDCA 2433, como referencia)', { sin: ['te', 'te verde', 'infusion', 'mate', 'mate cocido', 'manzanilla', 'poleo', 'tila', 'rooibos'], porcion: 250, estimado: true, nota: 'Sin azúcar. Con azúcar, escribila aparte.' }],
  ['agua', 'Agua', 0, 0, 'BEDCA 2425: Agua de la red', { sin: ['agua', 'agua mineral', 'agua con gas', 'soda'], porcion: 250 }],
  ['refresco', 'Refresco de cola', 0, 44, 'BEDCA 2457: Refresco, sabor cola', { sin: ['refresco', 'coca cola', 'cocacola', 'coca', 'cola', 'gaseosa', 'pepsi'], porcion: 330, medidas: { lata: 330 } }],
  ['refresco_zero', 'Refresco sin azúcar', 0, 0, 'BEDCA 2458: Refresco, sabor cola, bajo en calorías', { sin: ['coca cola zero', 'coca zero', 'coca light', 'coca cola light', 'cola zero', 'refresco zero', 'refresco light', 'gaseosa light', 'gaseosa zero', 'pepsi max'], porcion: 330, medidas: { lata: 330 } }],
  ['refresco_naranja', 'Refresco de naranja', 0, 44, 'BEDCA 2456: Refresco, con gas, sabor naranja', { sin: ['fanta', 'refresco de naranja', 'fanta de naranja'], porcion: 330, medidas: { lata: 330 } }],
  ['zumo', 'Zumo de naranja', 0.7, 41, 'BEDCA 2468: Zumo de naranja', { sin: ['zumo', 'zumo de naranja', 'zumo natural', 'jugo', 'jugo de naranja', 'jugo exprimido'], porcion: 200 }],
  ['cerveza', 'Cerveza', 0.5, 42, 'BEDCA 2437: Cerveza con alcohol', { sin: ['cerveza', ['cana', 200], ['tercio', 330], ['botellin', 250], ['jarra de cerveza', 500]], porcion: 330, unidad: 330, medidas: { lata: 330, cana: 200, tercio: 330, botellin: 250, pinta: 500 } }],
  ['cerveza_sin', 'Cerveza sin alcohol', 0.4, 26, 'BEDCA 2438: Cerveza sin alcohol', { sin: ['cerveza sin alcohol', 'cerveza sin', 'cerveza 0'], porcion: 330, unidad: 330, medidas: { lata: 330, cana: 200, tercio: 330, botellin: 250 } }],
  ['vino', 'Vino tinto', 0.2, 70, 'BEDCA 2465: Vino tinto', { sin: ['vino', 'vino tinto', 'tinto'], porcion: 150, unidad: 150 }],
  ['vino_blanco', 'Vino blanco', 0.1, 60, 'BEDCA 2462: Vino blanco', { sin: ['vino blanco', 'vino rosado'], porcion: 150, unidad: 150 }],
  // Fuera de BEDCA (estimados)
  ['maiz_dulce', 'Maíz dulce o choclo', 3.3, 86, 'Estimado: BEDCA no tiene maíz dulce cocido (solo grano seco); USDA FoodData Central SR Legacy 11167, Corn, sweet, yellow, raw', { sin: ['maiz', 'maiz dulce', 'choclo'], porcion: 80, estimado: true }],
  ['proteina_polvo', 'Proteína en polvo', 80, 400, 'Estimado: valor típico de etiqueta de proteína de suero; no está en BEDCA y cambia según la marca', { sin: ['proteina', 'proteina en polvo', 'batido de proteina', 'batido de proteinas', 'whey', 'suero de leche en polvo'], porcion: 30, medidas: { scoop: 30, cucharada: 15 }, estimado: true, nota: 'Si la etiqueta dice otra cosa, escribí los gramos de proteína en "Proteína del día".' }],
  ['fruta', 'Fruta (sin especificar)', 0.5, 50, 'Estimado: promedio de manzana, pera, naranja y plátano de BEDCA', { sin: ['fruta', 'fruta de estacion'], porcion: 150, unidad: 150, estimado: true }],
  ['verduras', 'Verduras (sin especificar)', 2.1, 26, 'Estimado: promedio de brócoli, calabacín, judía verde, zanahoria y coliflor de BEDCA', { sin: ['verdura', 'verduras', 'vegetales', 'verduras al vapor', 'verduras salteadas', 'verduras asadas', 'menestra', 'parrillada de verduras'], porcion: 200, estimado: true }],
];

// ---------------------------------------------------------------- recetas y platos
// [clave, nombre, porción hecha en g, ingredientes [[clave, g crudos por porción]], opciones]
// opciones: sin, unidad (g de una unidad hecha), medidas, nota. Todas las recetas son estimadas (proporciones típicas).
const RECETAS = [
  // Cocciones (rendimiento: cuánto pesa cocido lo que entra crudo)
  ['arroz', 'Arroz blanco hervido', 200, [['arroz_crudo', 71]], { sin: ['arroz', 'arroz blanco', 'arroz hervido', 'arroz cocido'], medidas: { taza: 160 }, nota: 'Arroz crudo de BEDCA con rendimiento ×2,8. El dato de BEDCA "arroz hervido" coincide con el crudo y no se usa.' }],
  ['lentejas', 'Lentejas cocidas', 200, [['lentejas_secas', 80]], { sin: ['lenteja', 'lentejas cocidas'], nota: 'Lentejas secas de BEDCA con rendimiento ×2,5 (el dato "hervida" de BEDCA coincide con el seco).' }],
  ['garbanzos', 'Garbanzos cocidos', 200, [['garbanzos_secos', 83]], { sin: ['garbanzo', 'garbanzos cocidos'], nota: 'Garbanzos secos de BEDCA con rendimiento ×2,4.' }],
  ['alubias', 'Alubias o porotos cocidos', 200, [['alubias_secas', 80]], { sin: ['alubia', 'alubias blancas', 'judias', 'judias blancas', 'judias pintas', 'frijol', 'poroto'], nota: 'Alubias secas de BEDCA con rendimiento ×2,5.' }],
  ['carne_picada', 'Carne picada cocinada', 100, [['carne_picada_cruda', 133]], { sin: ['carne picada', 'carne molida'], nota: 'Carne picada cruda de BEDCA; pierde un 25% de peso al cocinarse.' }],
  ['hamburguesa', 'Hamburguesa de carne', 90, [['carne_picada_cruda', 120]], { sin: ['hamburguesa', 'burger', 'medallon de carne'], unidad: 90, nota: 'Medallón de 120 g crudo, sin pan.' }],
  // Platos argentinos
  ['milanesa', 'Milanesa de carne', 130, [['ternera_magra_cruda', 120], ['pan_rallado', 20], ['huevo_crudo', 15], ['aceite_girasol', 10]], { sin: ['milanesa', 'milanesa de carne', 'milanesa de ternera', 'milanesa frita', 'escalope', 'escalope de ternera', 'filete empanado', 'filete rebozado'], unidad: 130, nota: 'Frita: absorbe unos 10 g de aceite. Al horno tiene unas 80 kcal menos.' }],
  ['milanesa_pollo', 'Milanesa de pollo', 130, [['pechuga_pollo_cruda', 120], ['pan_rallado', 20], ['huevo_crudo', 15], ['aceite_girasol', 10]], { sin: ['milanesa de pollo', 'escalope de pollo', 'pechuga empanada', 'pechuga rebozada'], unidad: 130, nota: 'Frita: absorbe unos 10 g de aceite. Al horno tiene unas 80 kcal menos.' }],
  ['empanada_carne', 'Empanada de carne', 80, [['harina_trigo', 25], ['mantequilla', 5], ['carne_picada_cruda', 30], ['cebolla', 15], ['huevo', 5], ['aceite_girasol', 2]], { sin: ['empanada', 'empanada de carne', 'empanada criolla', 'empanada saltena', 'empanada tucumana'], unidad: 80, nota: 'Al horno. Frita suma unas 60 kcal.' }],
  ['empanada_humita', 'Empanada de humita', 80, [['harina_trigo', 27], ['mantequilla', 5], ['maiz_dulce', 30], ['leche', 10], ['cebolla', 10], ['queso_tierno', 5]], { sin: ['empanada de humita', 'empanada de choclo'], unidad: 80, nota: 'Al horno. El choclo es un dato estimado (no está en BEDCA).' }],
  ['empanada_jyq', 'Empanada de jamón y queso', 80, [['harina_trigo', 25], ['mantequilla', 5], ['jamon_cocido', 20], ['mozzarella', 20]], { sin: ['empanada de jamon y queso'], unidad: 80, nota: 'Al horno.' }],
  ['asado', 'Asado de tira', 180, [['costilla_ternera_cruda', 250]], { sin: ['asado', 'asado de tira', 'tira de asado', 'costillar', 'costilla de ternera', 'parrillada'], nota: 'Porción de 250 g crudos sin hueso; pierde un 30% de peso en la parrilla.' }],
  ['locro', 'Locro', 350, [['maiz_seco', 35], ['alubias_secas', 15], ['calabaza_cruda', 100], ['ternera_cruda', 50], ['panceta_cruda', 15], ['chorizo', 15], ['cebolla', 25], ['aceite_girasol', 5]], { sin: ['locro'], nota: 'Plato hondo. El chorizo colorado se aproxima con el chorizo de BEDCA.' }],
  ['guiso_lentejas', 'Guiso de lentejas', 350, [['lentejas_secas', 60], ['ternera_cruda', 40], ['chorizo', 10], ['patata_cruda', 60], ['zanahoria', 30], ['cebolla', 30], ['tomate_frito', 30], ['pimiento', 15], ['aceite', 7]], { sin: ['guiso de lentejas', 'guiso', 'lentejas guisadas', 'lentejas estofadas', 'potaje de lentejas', 'lentejas con chorizo'], nota: 'Plato hondo.' }],
  ['tarta_jyq', 'Tarta de jamón y queso', 150, [['harina_trigo', 30], ['mantequilla', 10], ['jamon_cocido', 30], ['queso_tierno', 30], ['huevo_crudo', 30], ['leche', 15]], { sin: ['tarta de jamon y queso', 'tarta salada', 'quiche'], nota: 'Una porción: un sexto de una tarta de 24 cm.' }],
  ['tortilla_patatas', 'Tortilla de patatas', 180, [['patata_cruda', 150], ['huevo_crudo', 60], ['cebolla', 20], ['aceite', 12]], { sin: ['tortilla', 'tortilla de patatas', 'tortilla de papas', 'tortilla espanola', 'pincho de tortilla'], nota: 'Una porción: un cuarto de una tortilla de 4 huevos. Absorbe unos 12 g de aceite por porción.' }],
  ['mate_cocido_leche', 'Mate cocido con leche', 250, [['infusion', 150], ['leche', 100]], { sin: ['mate cocido con leche', 'mate con leche'], nota: 'Taza grande, sin azúcar.' }],
  ['dulce_de_leche', 'Dulce de leche', 20, [['leche', 38], ['azucar', 10]], { sin: ['dulce de leche'], medidas: { cucharada: 20, cucharadita: 7 }, nota: 'Leche entera y azúcar (4:1) reducidas a la mitad del peso.' }],
  ['medialuna', 'Medialuna', 40, [['harina_trigo', 20], ['mantequilla', 8], ['azucar', 8], ['leche', 6], ['huevo_crudo', 3]], { sin: ['medialuna', 'factura'], unidad: 40, nota: 'Medialuna de manteca con almíbar. Otras facturas se toman igual.' }],
  ['pizza_muzzarella', 'Pizza de muzzarella', 110, [['harina_trigo', 40], ['aceite', 5], ['tomate_frito', 15], ['mozzarella', 35]], { sin: ['pizza de muzzarella', 'pizza de mozzarella', 'pizza muzzarella', 'pizza margarita', 'pizza casera'], unidad: 880, medidas: { porcion: 110 }, nota: 'Una porción: un octavo de una pizza grande.' }],
  ['choripan', 'Choripán', 160, [['pan', 70], ['salchicha_fresca', 110]], { sin: ['choripan', 'chori'], unidad: 160 }],
  ['noquis', 'Ñoquis de papa', 250, [['patata_cruda', 180], ['harina_trigo', 60], ['huevo_crudo', 15]], { sin: ['noquis', 'noqui', 'gnocchi'], nota: 'Sin salsa.' }],
  ['ravioles', 'Ravioles de ricota', 250, [['harina_trigo', 70], ['huevo_crudo', 25], ['requeson', 60], ['queso_rallado', 10]], { sin: ['ravioles', 'ravioli', 'raviolis', 'sorrentinos'], nota: 'Sin salsa.' }],
  ['polenta', 'Polenta', 250, [['harina_maiz', 50], ['queso_rallado', 5], ['mantequilla', 5]], { sin: ['polenta'], nota: 'Con un poco de queso y manteca, sin salsa.' }],
  ['alfajor', 'Alfajor', 50, [['galletas', 25], ['dulce_de_leche', 15], ['chocolate', 10]], { sin: ['alfajor'], unidad: 50, nota: 'Alfajor de chocolate de 50 g.' }],
  // Platos españoles y de todos los días
  ['sandwich_mixto', 'Sándwich de jamón y queso', 100, [['pan_molde', 50], ['jamon_cocido', 25], ['queso_tierno', 20], ['mantequilla', 5]], { sin: ['sandwich', 'sandwich mixto', 'sandwich de jamon y queso', 'sanguche de jamon y queso', 'tostado', 'tostado de jamon y queso', 'mixto', 'bikini'], unidad: 100 }],
  ['bocadillo_jamon', 'Bocadillo de jamón', 140, [['pan', 100], ['jamon_serrano', 40]], { sin: ['bocadillo', 'bocadillo de jamon', 'bocadillo de jamon serrano', 'bocata', 'bocata de jamon'], unidad: 140 }],
  ['pan_con_tomate', 'Tostada con tomate y aceite', 95, [['pan', 60], ['tomate', 30], ['aceite', 5]], { sin: ['pan con tomate', 'pan con tomate y aceite', 'tostada con tomate', 'tostada con tomate y aceite', 'pan tumaca'], unidad: 95 }],
  ['ensalada_mixta', 'Ensalada mixta', 200, [['lechuga', 60], ['tomate', 60], ['cebolla', 15], ['atun', 30], ['huevo', 25], ['aceite', 10]], { sin: ['ensalada mixta', 'ensalada completa'], nota: 'Lechuga, tomate, cebolla, atún, huevo y una cucharada de aceite.' }],
];

// ---------------------------------------------------------------- tabla final
const r1 = (n) => Math.round(n * 10) / 10;

function construir() {
  const tabla = new Map();
  for (const [clave, nombre, p, kcal, fuente, o] of BASE) {
    tabla.set(clave, { clave, nombre, p100: p, kcal100: kcal, fuente, estimado: !!o.estimado, nota: o.nota || '', sinonimos: o.sin || [],
      porcionG: o.porcion || 100, unidadG: o.unidad || 0, medidas: o.medidas || {} });
  }
  for (const [clave, nombre, porcion, ingredientes, o] of RECETAS) {
    let p = 0, kcal = 0;
    for (const [ing, g] of ingredientes) {
      const a = tabla.get(ing);
      if (!a) throw new Error(`Receta ${clave}: falta el ingrediente ${ing}`);
      p += a.p100 * g / 100; kcal += a.kcal100 * g / 100;
    }
    tabla.set(clave, { clave, nombre, p100: r1(p / porcion * 100), kcal100: Math.round(kcal / porcion * 100),
      fuente: 'Receta estimada con ingredientes de BEDCA: ' + ingredientes.map(([i, g]) => `${tabla.get(i).nombre.replace(/ \((crud[oa]s?|seco|para recetas)[^)]*\)/, '')} ${g} g`).join(', '),
      estimado: true, nota: o.nota || '', sinonimos: o.sin || [], porcionG: porcion, unidadG: o.unidad || 0, medidas: o.medidas || {}, ingredientes });
  }
  for (const a of tabla.values()) {
    a.proteinaPorcion = r1(a.p100 * a.porcionG / 100);
    a.kcalPorcion = Math.round(a.kcal100 * a.porcionG / 100);
  }
  return tabla;
}
const TABLA = construir();

// Lista para mostrar o revisar: solo los que se reconocen en el texto (los ingredientes sueltos de recetas quedan afuera).
export const ALIMENTOS = [...TABLA.values()].filter(a => a.sinonimos.length);
export const INGREDIENTES = TABLA;

// ---------------------------------------------------------------- texto
// Minúsculas y sin tildes (la ñ queda como n). Conserva el largo del texto para poder recortar el original.
export function normalizar(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CONECTORES = new Set(['de', 'del', 'con', 'y', 'al', 'a', 'la', 'el', 'en', 'sin', 'para', 'por']);
// Cada palabra acepta su plural (s / es): "huevos", "panes", "milanesas de pollo".
const patron = (sin) => normalizar(sin).trim().split(/\s+/).map(w => CONECTORES.has(w) ? escRe(w) : escRe(w) + '(?:es|s)?').join('\\s+');

// Sinónimos ordenados del más largo al más corto: "pechuga de pavo" gana sobre "pechuga".
const SINONIMOS = [];
for (const a of ALIMENTOS) {
  for (const s of a.sinonimos) {
    const [texto, gUnidad] = Array.isArray(s) ? s : [s, 0];
    SINONIMOS.push({ texto: normalizar(texto), alimento: a, gUnidad });
  }
}
SINONIMOS.sort((x, y) => y.texto.length - x.texto.length);
const RE_ALIMENTO = new RegExp('(^|[^a-z0-9])(?:' + SINONIMOS.map(s => '(' + patron(s.texto) + ')').join('|') + ')(?=$|[^a-z0-9])', 'g');
// Frases con " y " que no se cortan ("jamón y queso", "lechuga y tomate").
const PROTEGIDAS = SINONIMOS.filter(s => /\sy\s/.test(s.texto));
const RE_PROTEGIDAS = PROTEGIDAS.length ? new RegExp('(?:' + PROTEGIDAS.map(s => patron(s.texto)).join('|') + ')', 'g') : null;
const RE_CORTE = /[,;\n+|]|\.(?!\d)|\s+y\s+/g;

// Cantidades: "2", "1.5", "1/2", "un", "media"... y medidas: "150 g", "2 lonchas", "un vaso", "medio plato".
const NUMEROS = { un: 1, una: 1, uno: 1, medio: 0.5, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, 'un par': 2, 'un par de': 2 };
const MEDIDAS = {
  kg: 'kg', kilo: 'kg', kilos: 'kg', g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g', ml: 'ml', cc: 'ml', cl: 'cl', l: 'l', litro: 'l', litros: 'l',
  unidad: 'unidad', unidades: 'unidad', u: 'unidad', pieza: 'unidad', piezas: 'unidad', filete: 'unidad', filetes: 'unidad',
  feta: 'loncha', fetas: 'loncha', loncha: 'loncha', lonchas: 'loncha', lonja: 'loncha', lonjas: 'loncha',
  rodaja: 'rebanada', rodajas: 'rebanada', rebanada: 'rebanada', rebanadas: 'rebanada', tajada: 'rebanada', tajadas: 'rebanada',
  taza: 'taza', tazas: 'taza', tazon: 'taza', tazones: 'taza', vaso: 'vaso', vasos: 'vaso', copa: 'copa', copas: 'copa',
  cucharada: 'cucharada', cucharadas: 'cucharada', cda: 'cucharada', cdas: 'cucharada', cucharadita: 'cucharadita', cucharaditas: 'cucharadita', cdita: 'cucharadita',
  lata: 'lata', latas: 'lata', bote: 'porcion', botes: 'porcion', pote: 'porcion', potes: 'porcion', porcion: 'porcion', porciones: 'porcion',
  racion: 'porcion', raciones: 'porcion', plato: 'porcion', platos: 'porcion', trozo: 'porcion', trozos: 'porcion', pincho: 'porcion', pinchos: 'porcion',
  scoop: 'scoop', scoops: 'scoop', cacito: 'scoop', cacitos: 'scoop', cazo: 'scoop', cazos: 'scoop',
  cana: 'cana', canas: 'cana', tercio: 'tercio', tercios: 'tercio', botellin: 'botellin', botellines: 'botellin', pinta: 'pinta', pintas: 'pinta',
  onza: 'onza', onzas: 'onza', bola: 'bola', bolas: 'bola', punado: 'punado', punados: 'punado', sobre: 'sobre', sobres: 'sobre', chorrito: 'cucharada',
};
// Medidas comunes cuando el alimento no trae la suya (g o ml).
const MEDIDA_GENERAL = { taza: 200, vaso: 200, copa: 150, cucharada: 10, cucharadita: 5, scoop: 30, cana: 200, tercio: 330, botellin: 250, pinta: 500, onza: 6, bola: 60, punado: 30, sobre: 8 };
const NUM = '(\\d+(?:\\.\\d+)?|\\d+\\/\\d+|un par de|un par|una|uno|un|media|medio|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)';
const MED = '(' + Object.keys(MEDIDAS).sort((a, b) => b.length - a.length).map(escRe).join('|') + ')';
const RE_PREFIJO = new RegExp('(?:^|[^a-z0-9])' + NUM + '\\s*(?:' + MED + '(?![a-z0-9]))?\\s*(?:de(?:l)?\\s+)?(?:la\\s+|el\\s+|los\\s+|las\\s+)?$');
const RE_SUFIJO = /^\s*(?:x\s*(\d+(?:\.\d+)?)(?![a-z0-9])|\(?\s*(\d+(?:\.\d+)?)\s*(kg|kilos?|gramos?|grs?|g|ml|cc|l)(?![a-z0-9])\s*\)?)/;

const numero = (t) => {
  if (t in NUMEROS) return NUMEROS[t];
  if (t.includes('/')) { const [a, b] = t.split('/').map(Number); return b ? a / b : 0; }
  return parseFloat(t);
};
// Palabras que no son alimentos: comidas del día, formas de cocción, relleno del habla.
const VACIAS = new Set(('de del la las el los lo con sin al a en un una unos unas uno y o u mi mis su sus que para por poco poca pocos pocas algo algun alguna mas menos muy bien '
  + 'medio media mitad par casero casera caseros caseras natural tipo estilo casa bar restaurante menu dia hoy ayer manana tarde noche '
  + 'desayuno almuerzo comida cena merienda colacion tentempie snack aperitivo picoteo pre post entreno entrenamiento entrenar gimnasio gym antes despues durante '
  + 'comi tome bebi desayune almorce cene meriende picotee '
  + 'plato platos porcion porciones racion raciones vaso vasos taza tazas grande grandes mediano mediana chico chica pequeno pequena pequenos pequenas '
  + 'horno plancha parrilla hervido hervida hervidos hervidas cocido cocida cocidos cocidas asada asados asadas vapor salteado salteada salteados salteadas '
  + 'frito frita fritos fritas grill sarten microondas airfryer freidora integral entero entera enteros enteras '
  + 'sal pimienta oregano especias condimento condimentos limon vinagre ajo hielo edulcorante sacarina stevia perejil albahaca romero comino pimenton').split(' '));

// Busca todos los alimentos de una parte del texto y su cantidad.
function analizarParte(norm, orig, ini, fin) {
  const texto = norm.slice(ini, fin);
  const usado = []; // tramos [desde, hasta) consumidos (alimentos y cantidades), relativos a la parte
  const encontrados = [];
  RE_ALIMENTO.lastIndex = 0;
  let m, previo = 0;
  while ((m = RE_ALIMENTO.exec(texto))) {
    const desde = m.index + m[1].length, hasta = m.index + m[0].length;
    let k = 2; while (k < m.length && m[k] === undefined) k++;
    const sin = SINONIMOS[k - 2];
    const a = sin.alimento;
    // Cantidad antes ("2 huevos", "150 g de pollo", "medio plato de") o después ("pollo 150 g", "huevos x2").
    let gramos = 0, cantidad = '', dIni = desde, dFin = hasta;
    const pre = RE_PREFIJO.exec(texto.slice(previo, desde));
    const suf = RE_SUFIJO.exec(texto.slice(hasta));
    const gUnidad = sin.gUnidad || a.unidadG || a.porcionG;
    const conMedida = (n, med) => {
      const tipo = MEDIDAS[med];
      if (tipo === 'kg') return [n * 1000, `${r1(n * 1000)} g`];
      if (tipo === 'g' || tipo === 'ml') return [n, `${r1(n)} ${tipo}`];
      if (tipo === 'cl') return [n * 10, `${r1(n * 10)} ml`];
      if (tipo === 'l') return [n * 1000, `${r1(n * 1000)} ml`];
      const g = tipo === 'unidad' ? gUnidad : (a.medidas[tipo] ?? (tipo === 'porcion' ? a.porcionG : (tipo === 'loncha' || tipo === 'rebanada' ? gUnidad : MEDIDA_GENERAL[tipo] ?? a.porcionG)));
      return [n * g, `${r1(n)} ${med} (${Math.round(n * g)} g)`];
    };
    if (pre) {
      const n = numero(pre[1]);
      if (n > 0) {
        [gramos, cantidad] = pre[2] ? conMedida(n, pre[2]) : [n * gUnidad, `${r1(n)} ${(sin.gUnidad || a.unidadG) ? (n === 1 ? 'unidad' : 'unidades') : (n === 1 ? 'porción' : 'porciones')} (${Math.round(n * gUnidad)} g)`];
        dIni = previo + pre.index + (pre[0].match(/^[^a-z0-9]/) ? 1 : 0);
      }
    }
    if (!gramos && suf) {
      if (suf[1]) { const n = parseFloat(suf[1]); gramos = n * gUnidad; cantidad = `${r1(n)} ${n === 1 ? 'unidad' : 'unidades'} (${Math.round(gramos)} g)`; }
      else [gramos, cantidad] = conMedida(parseFloat(suf[2]), suf[3].replace(/s$/, '') === 'kilo' ? 'kilo' : suf[3]);
      dFin = hasta + suf[0].length;
    }
    if (!gramos) { gramos = sin.gUnidad || a.porcionG; cantidad = `${sin.gUnidad ? '1 unidad' : 'porción típica'} (${gramos} g)`; }
    usado.push([dIni, dFin]);
    encontrados.push({ nombre: a.nombre, clave: a.clave, cantidad, gramos: r1(gramos),
      proteinaG: a.p100 * gramos / 100, kcal: a.kcal100 * gramos / 100, estimado: a.estimado });
    previo = dFin;
    RE_ALIMENTO.lastIndex = dFin;
  }
  // Lo que sobra (sin palabras vacías ni números) no se pudo estimar.
  const sobra = [];
  const reP = /[a-z0-9]+/g; let w;
  while ((w = reP.exec(texto))) {
    const a = w.index, b = a + w[0].length;
    if (usado.some(([x, y]) => a >= x && b <= y)) continue;
    if (/^\d/.test(w[0]) || w[0].length < 3 || VACIAS.has(w[0]) || MEDIDAS[w[0]]) continue;
    sobra.push(orig.slice(ini + a, ini + b));
  }
  return { encontrados, sobra: sobra.join(' ') };
}

/**
 * Estima proteína y calorías de un texto libre ("2 huevos, 150 g de pollo y una ensalada").
 * Separa por comas, punto y coma, puntos, "+" e "y"; reconoce cada alimento por sus sinónimos (sin importar
 * mayúsculas ni tildes); usa la cantidad escrita o la porción típica. Lo que no reconoce queda en noReconocidos
 * y no suma nada. Devuelve { proteinaG, kcal, reconocidos: [{ nombre, cantidad, gramos, proteinaG, kcal, estimado }], noReconocidos }.
 */
export function estimarComida(texto) {
  let orig = String(texto ?? '').normalize('NFC');
  let norm = normalizar(orig).replace(/(\d),(\d)/g, '$1.$2');
  if (norm.length !== orig.length) orig = norm; // caracteres raros: se muestra el texto normalizado
  // Frases protegidas: un " y " dentro de "jamón y queso" no corta.
  const protegidas = [];
  if (RE_PROTEGIDAS) { RE_PROTEGIDAS.lastIndex = 0; let p; while ((p = RE_PROTEGIDAS.exec(norm))) protegidas.push([p.index, p.index + p[0].length]); }
  const partes = []; let ini = 0, c;
  RE_CORTE.lastIndex = 0;
  while ((c = RE_CORTE.exec(norm))) {
    const a = c.index, b = a + c[0].length;
    if (/y/.test(c[0]) && protegidas.some(([x, y]) => x < a && y > b)) continue;
    partes.push([ini, a]); ini = b;
  }
  partes.push([ini, norm.length]);

  const reconocidos = [], noReconocidos = [];
  for (const [a, b] of partes) {
    if (!norm.slice(a, b).trim()) continue;
    const { encontrados, sobra } = analizarParte(norm, orig, a, b);
    reconocidos.push(...encontrados);
    if (sobra) noReconocidos.push(sobra);
  }
  const proteinaG = Math.round(reconocidos.reduce((s, r) => s + r.proteinaG, 0));
  const kcal = Math.round(reconocidos.reduce((s, r) => s + r.kcal, 0));
  return {
    proteinaG, kcal,
    reconocidos: reconocidos.map(r => ({ ...r, proteinaG: r1(r.proteinaG), kcal: Math.round(r.kcal) })),
    noReconocidos,
  };
}

/** Suma lo estimado de varias comidas (textos o { texto }). Devuelve { proteinaG, kcal, noReconocidos, comidas }. */
export function estimarDia(comidas = []) {
  const ests = comidas.map(c => estimarComida(typeof c === 'string' ? c : c?.texto));
  return {
    proteinaG: ests.reduce((s, e) => s + e.proteinaG, 0),
    kcal: ests.reduce((s, e) => s + e.kcal, 0),
    noReconocidos: [...new Set(ests.flatMap(e => e.noReconocidos))],
    comidas: ests,
  };
}

export const AVISO_ESTIMACION = 'Estimación orientativa: sale de porciones típicas y de la tabla BEDCA. Para más precisión, escribí los gramos.';
