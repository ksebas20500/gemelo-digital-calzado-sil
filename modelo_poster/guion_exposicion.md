# Guion de exposición del póster (10 minutos)

Ritmo aproximado: unas 1.300 palabras habladas. Cada bloque indica qué parte del póster señalar.

---

## 0:00 – 1:00 · Apertura

**Expositor:** _por asignar_ · *señalar el título*

"Buenos días. Somos Yenderson Josué Rangel, Kevin Medina y Cristian Camargo, de Ingeniería de Sistemas de la Universidad de Pamplona, con el acompañamiento del profesor Jesús Enrique Durán Villamizar, del semillero GIIDAC.

Nuestro proyecto en una frase: **construimos una línea de inspección de calzado hecha 100 % en software**. Una cámara virtual le toma una foto a cada pieza de cuero, un modelo que **aprendió solo con piezas buenas** decide si tiene defecto y de qué tipo, y un **gemelo digital** muestra todo en tiempo real."

---

## 1:00 – 2:00 · Introducción: el problema

**Expositor:** _por asignar_ · *señalar Introducción*

"En una fábrica de calzado, la calidad del cuero se revisa a ojo. Eso tiene tres problemas: es **lento**, es **subjetivo** porque dos operarios no siempre coinciden, y se **degrada con la fatiga**: al final del turno se escapan más defectos.

La Industria 4.0 propone automatizar esa inspección. Pero comprar cámaras, bandas y actuadores para probar una idea es caro. Por eso trabajamos con un gemelo digital y con Software-in-the-Loop."

---

## 2:00 – 3:30 · Marco teórico

**Expositor:** _por asignar_ · *señalar Marco teórico*

"Tres conceptos:

- **Gemelo digital:** una copia virtual que refleja el estado de un sistema real, como el GPS que muestra su carro moviéndose en el mapa.
- **Software-in-the-Loop:** el software de control es el real y la planta es simulada. Es como un simulador de vuelo: el piloto es real, el avión no.
- **Detección de anomalías con PatchCore:** el modelo divide cada foto de cuero bueno en parches pequeños y guarda una *memoria de lo normal*. Ante una pieza nueva, mide qué tan lejos está cada parche del parche normal más parecido. Eso dice esta fórmula *(señalarla)*: si la distancia es grande, el parche es raro.

Si la puntuación de la pieza supera un umbral *t*, se rechaza. Ese umbral no lo pusimos a mano: lo calibramos con el **índice de Youden**, que busca atrapar la mayor cantidad de defectos rechazando la menor cantidad de piezas buenas.

Después, otro modelo pequeño, una ResNet-18 con regresión logística, mira la zona sospechosa y dice **qué tipo** de defecto es."

---

## 3:30 – 5:00 · Metodología

**Expositor:** _por asignar_ · *recorrer el diagrama de izquierda a derecha*

"La arquitectura tiene cinco bloques:

1. **La planta virtual**, hecha en Python con SimPy, simula la banda y la cámara y envía la foto de cada pieza. Usamos imágenes reales de cuero del dataset MVTec AD que el modelo **nunca vio** al entrenar.
2. **MQTT**, el protocolo de mensajería de la Industria 4.0. Los módulos no se llaman entre sí: solo intercambian mensajes, y cada mensaje cumple un contrato JSON.
3. **El controlador SIL**, una máquina de estados: espera, captura, inferencia y decisión.
4. **La visión**: PatchCore más el clasificador de tipo.
5. **El gemelo**, que guarda cada decisión y la muestra en una interfaz web en vivo.

La ventaja de este diseño es que **podemos cambiar el modelo de visión sin tocar la planta ni el gemelo**.

Usamos Python, PyTorch y Anomalib para la visión, React con TypeScript para la interfaz y Docker para el broker. También apoyamos el desarrollo con agentes de IA generativa y **auditamos lo que produjeron**, que era uno de nuestros objetivos específicos."

---

## 5:00 – 6:00 · Gráficos y visualizaciones

**Expositor:** _por asignar_ · *señalar los mapas de calor*

"Estas imágenes son lo más visual del proyecto. A la izquierda de cada par está la pieza de cuero real. A la derecha, el **mapa de calor** de PatchCore.

Fíjense en el corte: el amarillo cae justo sobre la cortada. Y lo importante es que **el modelo nunca vio un defecto al entrenar**. Solo sabe cómo es el cuero bueno, y aun así ubica dónde está el problema. Eso sirve para la planta y para el operario: no solo sabe *que* hay defecto, sino *dónde*."

---

## 6:00 – 8:00 · Resultados

**Expositor:** _por asignar_ · *señalar los indicadores y luego la captura*

"Los números, todos medidos sobre imágenes que el modelo no vio al entrenar:

- **AUROC de 1,00:** el modelo separa perfectamente las piezas buenas de las malas en el conjunto de prueba.
- **Cero piezas buenas rechazadas:** en una fábrica, cada rechazo falso es material perdido.
- **70 de 70 piezas bien clasificadas** como buenas o defectuosas.
- **79 % de acierto en el tipo de defecto.** Es más difícil, y lo discutimos en un momento.
- **50 milisegundos de latencia**, contra una meta de 200: cuatro veces más rápido de lo necesario.

Y la prueba de punta a punta, todo conectado por MQTT: enviamos **100 piezas**, y el sistema atrapó **los 34 defectos**, no rechazó ninguna buena y no perdió ningún mensaje. Lo auditamos contra la verdad que guarda el simulador.

*(Señalar la captura.)* Esta es la interfaz del gemelo: la banda, la cámara, el actuador que desvía la pieza a RECHAZO y la última decisión con su puntuación."

---

## 8:00 – 9:00 · Análisis y discusión

**Expositor:** _por asignar_ · *señalar Análisis y discusión*

"Queremos ser honestos con lo que esto demuestra y lo que no:

- **Lo fuerte:** aprender solo de lo normal evita tener que etiquetar miles de defectos, que en una fábrica real casi nunca existen.
- **Lo difícil:** identificar el *tipo* de defecto. Perforación y deformación a veces se confunden.
- **Las limitaciones:** trabajamos con fotos de cuero, no de zapatos completos; el conjunto de prueba es pequeño, de 70 imágenes; y no hay datos públicos de defectos de costura, así que ese tipo no está."

---

## 9:00 – 10:00 · Conclusiones y cierre

**Expositor:** _por asignar_ · *señalar Conclusiones y recomendaciones*

"Concluimos tres cosas:

1. Con Software-in-the-Loop pudimos **construir y validar todo el control de calidad sin comprar hardware**.
2. Un modelo que solo aprendió de piezas buenas **atrapó todos los defectos sin rechazar piezas buenas**, y lo hizo en tiempo real.
3. El siguiente paso es entrenar con **fotos de calzado real**, incluir costura, conectar una **cámara física** (lo que se llama Hardware-in-the-Loop) y **extender el gemelo a toda la línea de producción**.

Muchas gracias. Con gusto respondemos sus preguntas."

---

## Preguntas probables

- **"¿Por qué un AUROC de 1,00? ¿No es sospechoso?"** El conjunto reservado es pequeño (32 buenas y 38 defectuosas). Por eso no afirmamos que sea perfecto en general, y lo pusimos como limitación.
- **"¿Por qué no un clasificador normal?"** Porque necesitaría muchos ejemplos de cada defecto. PatchCore solo necesita piezas buenas, que abundan.
- **"¿Funciona sin GPU?"** Sí, solo que más lento.
- **"¿Qué es lo que es de verdad 'gemelo'?"** El estado de la planta (piezas, decisiones, KPIs) se refleja en tiempo real en la base de datos y en la interfaz.
