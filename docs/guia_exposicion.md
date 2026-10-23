# Guía para la exposición

Cómo contar el proyecto en unos 12 minutos, entendiendo la idea y la matemática sin entrar en detalles de código. Para los detalles técnicos, ver la [guía del sistema](guia_del_sistema.md).

---

## 1. El mensaje en una frase

> Construimos una **línea de inspección de calzado 100 % en software**: una cámara virtual le toma una foto a cada pieza de cuero, un **modelo que aprendió solo con piezas buenas** detecta cuál tiene defecto y de qué tipo, y un **gemelo digital** muestra todo en tiempo real. Medimos que no rechaza piezas buenas, que detecta todos los defectos de prueba y que responde en unos 50 ms.

Si el público solo recuerda una cosa, que sea esta.

---

## 2. Tres conceptos que hay que explicar primero

| Concepto | Explicación corta | Analogía |
|---|---|---|
| **Gemelo digital** | Copia virtual que refleja en tiempo real el estado de un sistema físico. | Como el GPS que muestra tu auto moviéndose en el mapa mientras manejas. |
| **SIL (Software-in-the-Loop)** | Probar el software de control conectado a una planta *simulada*, sin hardware real. | Como un simulador de vuelo: el piloto (el software) es real, el avión no. |
| **Detección de anomalías** | Aprender cómo es lo *normal* y marcar lo que se aleja de eso. | Un catador que probó cientos de vinos buenos y nota de inmediato cuando uno está mal, aunque nunca haya probado ese defecto en particular. |

---

## 3. La arquitectura en un dibujo

```
 Simulador (planta)        Broker MQTT          Controlador SIL            Gemelo digital
 banda + cámara    ──foto──▶  (mensajes)  ──foto──▶  visión: ¿defecto?  ──decisión──▶  base de datos
 imágenes de cuero                                   máquina de estados          interfaz web en vivo
```

Puntos a decir:
- **Las piezas no se llaman entre sí; solo intercambian mensajes** (MQTT, el protocolo de la industria 4.0). Por eso se puede cambiar el modelo de visión sin tocar nada más.
- **El controlador es una máquina de estados:** espera → captura → inferencia → decisión.
- **Cada mensaje cumple un contrato** (un esquema JSON). Si un mensaje llega mal formado, se descarta.

---

## 4. El modelo matemático

Hay **dos modelos en cadena**:

1. **PatchCore** responde *"¿esta pieza tiene defecto?"* y *"¿dónde?"*.
2. **Un clasificador** responde *"¿qué tipo de defecto?"*.

### 4.1 PatchCore: aprender cómo es lo normal

**Idea:** cortar cada imagen buena en parches pequeños y guardar una "memoria" de cómo se ven los parches normales. Ante una pieza nueva, cada parche que no se parezca a nada de la memoria es sospechoso.

**Paso 1: convertir cada parche en un vector.**
Una red neuronal ya entrenada con millones de fotos (ImageNet; aquí *Wide ResNet-50*) transforma cada parche $p$ de la imagen en un vector de características:

$$\phi(p) \in \mathbb{R}^{d}$$

Ese vector resume textura, bordes y patrones. **No se entrena nada en este paso:** se reutiliza lo que la red ya sabe "ver".

**Paso 2: construir la memoria de lo normal.**
Se juntan los vectores de todos los parches de las piezas buenas de entrenamiento: 196 imágenes × 1024 parches, unos 200.000 vectores. Para no guardarlos todos, se elige el **10 % más representativo** con un *coreset*: se van escogiendo, uno a uno, los puntos más lejanos a los ya escogidos, para cubrir todo el espacio con pocos puntos. Así queda la memoria $\mathcal{M}$, de unos 20.000 vectores.

> Esta es toda la "fase de entrenamiento": **no hay gradientes ni épocas**; solo se calculan vectores y se guardan.

**Paso 3: puntuar una pieza nueva.**
Para cada parche $p$ de la imagen nueva, su **puntuación de anomalía** es la distancia a su vecino más cercano en la memoria:

$$s(p) = \min_{m \in \mathcal{M}} \; \lVert \phi(p) - m \rVert_2$$

- Si el parche se parece a algo normal, la distancia es chica.
- Si es una mancha, un corte o una burbuja, no se parece a nada guardado y la distancia es grande.

La **puntuación de la imagen** es la del parche más raro, con un pequeño ajuste de confianza:

$$S(x) = w \cdot \max_{p} s(p)$$

donde $w \in (0,1]$ baja el valor si ese parche está en una zona "poco poblada" de la memoria, para no exagerar.

**Paso 4: el mapa de calor.**
Las puntuaciones $s(p)$ de todos los parches, puestas en su lugar y suavizadas, forman un **mapa de calor** que muestra *dónde* está el defecto. Este es el dibujo ideal para una diapositiva.

### 4.2 De la puntuación a la decisión: el umbral

$S(x)$ es un número; para decidir hace falta un **umbral** $t$:

$$\text{decisión} = \begin{cases} \text{RECHAZO} & \text{si } S(x) \ge t \\ \text{OK} & \text{si } S(x) < t \end{cases}$$

**Cómo elegimos $t$:** con un conjunto de calibración (49 piezas buenas que el modelo no memorizó y 54 defectos reales que **no** se usan para evaluar), se prueba cada valor posible y se elige el que maximiza el **índice de Youden**:

$$J(t) = \underbrace{\text{TPR}(t)}_{\text{defectos atrapados}} - \underbrace{\text{FPR}(t)}_{\text{buenas rechazadas}}$$

Si hay empate, gana el umbral que atrapa más defectos: en control de calidad, dejar pasar un defecto cuesta más que revisar una pieza buena.

Por último, la puntuación se **reescala** para que el umbral quede en 0,5. Así `score ≥ 0,5` siempre significa "defecto":

$$\text{score} = \begin{cases} 0{,}5 \cdot \dfrac{S}{t} & S < t \\[2mm] 0{,}5 + 0{,}5 \cdot \dfrac{S - t}{1 - t} & S \ge t \end{cases}$$

### 4.3 El clasificador de tipo de defecto

PatchCore dice *que* hay defecto y *dónde*, pero no *cuál*. Para eso:

1. Se **recorta** un cuadrado de 64×64 píxeles alrededor del punto más caliente del mapa. Así el defecto ocupa el recorte y no se diluye en el resto del cuero.
2. Otra red preentrenada (ResNet-18) convierte el recorte en un vector $z \in \mathbb{R}^{512}$.
3. Una **regresión logística multinomial** da la probabilidad de cada tipo:

$$P(y = k \mid z) = \frac{e^{\,w_k^\top z + b_k}}{\sum_{j} e^{\,w_j^\top z + b_j}}$$

Se elige el tipo $k$ con mayor probabilidad. Los pesos $w_k, b_k$ se aprenden con solo 54 ejemplos, lo que es posible porque las características de la red ya son muy informativas.

**Tipos de defecto:** mancha, pegado, corte, deformación y perforación. Vienen del dataset MVTec AD (cuero). Costura no tiene datos públicos.

### 4.4 Las métricas, en palabras simples

| Métrica | Qué pregunta responde |
|---|---|
| **Falsos rechazos** | ¿Cuántas piezas buenas se desperdician? |
| **Recall (sensibilidad)** | De los defectos reales, ¿cuántos atrapamos? |
| **Precisión** | De lo que rechazamos, ¿cuánto era realmente defectuoso? |
| **AUROC** | Si tomo una pieza buena y una mala al azar, ¿con qué probabilidad el modelo le da más puntuación a la mala? (1,0 = siempre) |
| **Latencia** | ¿Cuánto tarda en decidir una pieza? |

---

## 5. Resultados

Medidos sobre **70 imágenes que ningún modelo vio** (32 buenas y 38 con defecto):

| KPI | Resultado | Meta |
|---|---|---|
| Piezas buenas rechazadas | **0 de 32** | lo menor posible |
| Defectos detectados | **38 de 38** | todos |
| Tipo de defecto correcto | **78,9 %** | — |
| Latencia por pieza (p95) | **49,8 ms** | < 200 ms |
| AUROC | **1,000** | 1,0 = perfecto |

También corrimos la línea completa: simulador, broker, controlador e interfaz web. La auditoría comparó lo que decidió el gemelo con la verdad de cada pieza, y no hubo defectos sin detectar ni rechazos falsos.

---

## 6. La historia que vale la pena contar: auditar a la herramienta

Este es el momento más interesante de la exposición. Conecta directamente con el objetivo 5 (auditoría).

| Versión | Cómo se eligió el umbral | Piezas buenas rechazadas |
|---|---|---|
| 1 | Configuración por defecto de la biblioteca (Anomalib): con **las mismas imágenes de prueba** | 0 de 32 ← *demasiado bueno para ser cierto* |
| 2 | Con defectos **sintéticos** que genera la biblioteca | **19 de 32** |
| 3 (final) | Con **defectos reales** que no se usan para evaluar | 0 de 32 ✔ |

Qué decir:
- **La versión 1 hacía trampa sin querer.** Elegir el umbral mirando las respuestas del examen y después evaluar con ese mismo examen siempre sale perfecto. El error estaba en la configuración por defecto de la biblioteca, no en nuestro código.
- **La versión 2 mostró que el modelo sí distingue bien** (AUROC 1,0), pero que el umbral calibrado con defectos falsos no sirve para defectos reales.
- **La versión 3 obtiene un resultado bueno *y* honesto.**
- **Lección:** hay que auditar todo lo que no hicimos nosotros, sea código generado por IA o una biblioteca. Un resultado perfecto es motivo para revisar, no para celebrar.

---

## 7. Limitaciones (decirlas antes de que las pregunten)

- **Cuero plano, no zapatos armados:** hay una brecha entre la simulación y la realidad.
- **Pocas imágenes:** los números tienen mucha incertidumbre.
- **Margen estrecho:** la pieza buena con puntuación más alta queda cerca del umbral (0,573 contra 0,6185).
- **Tipo de defecto débil en algunos casos:** confunde perforación con corte.
- **Costura:** no hay datos, así que no se detecta.

---

## 8. Guion sugerido (≈ 12 minutos)

| # | Diapositiva | Tiempo | Qué mostrar |
|---|---|---|---|
| 1 | Problema: control de calidad manual en calzado | 1 min | Foto de una línea real; costo de un defecto que llega al cliente |
| 2 | Gemelo digital + SIL | 1,5 min | Tabla de la sección 2, con las analogías |
| 3 | Arquitectura | 1,5 min | Diagrama de la sección 3 |
| 4 | Idea de PatchCore | 2 min | Imagen dividida en parches → memoria de lo normal → distancia al vecino más cercano |
| 5 | Fórmulas clave | 1,5 min | $s(p)$, el umbral y $J(t)$ |
| 6 | Tipo de defecto | 1 min | Recorte en el mapa de calor → ResNet-18 → probabilidades |
| 7 | Demo en vivo | 2 min | Ver sección 9 |
| 8 | Resultados + la historia del umbral | 1,5 min | Tablas de las secciones 5 y 6 |
| 9 | Limitaciones y trabajo futuro | 0,5 min | Sección 7 |

**Imágenes útiles para las diapositivas:**
- **Piezas reales:** una imagen buena y una con defecto de `data/MVTecAD/leather/test/`.
- **Mapa de calor:** `results/Patchcore/MVTecAD/leather/latest/images/test/<tipo>/` (se genera al entrenar). Cada archivo trae 4 paneles: imagen, máscara real del defecto, mapa de calor y contorno predicho. Buen ejemplo: `glue/000.png`.
- **Interfaz web:** una captura en modo "MQTT en vivo".

---

## 9. Demo en vivo (preparar antes)

```bash
docker compose up -d mosquitto                 # 1. broker
python -m controller.main                      # 2. controlador con el modelo (terminal 1)
cd web && pnpm dev                             # 3. interfaz → elegir "MQTT en vivo" (terminal 2)
INTERVALO_S=1.5 N_PIEZAS=20 P_DEFECTO=0.4 python -m simulator.main   # 4. arrancar la línea (terminal 3)
python -m twin.audit                           # 5. al final: verdad vs. decisiones
```

Qué señalar mientras corre:
- **Imagen real:** la imagen real del cuero en "Última captura".
- **Rechazos:** las piezas rechazadas que caen en la caja RECHAZO, con su tipo de defecto.
- **Latencia:** la latencia (~50 ms) en los KPIs.
- **Auditoría:** al final, el resultado de la auditoría (0 defectos no detectados).

**Plan B:** si algo falla en vivo, la interfaz web tiene el modo "Simulación local", que funciona sin broker ni modelo. También conviene llevar capturas de pantalla.

---

## 10. Preguntas probables

**¿Por qué no entrenaron una red para clasificar directamente buenas y malas?**
Porque casi no hay ejemplos de defectos (unos 90 frente a cientos de piezas buenas), y en una fábrica real los defectos son raros y variados. PatchCore aprende solo con piezas buenas, así que también detecta defectos que nunca vio.

**¿Qué es exactamente lo que "aprende" PatchCore si no hay entrenamiento con gradientes?**
Aprende una memoria: un conjunto representativo de vectores de parches normales. Decidir es medir distancias a esa memoria.

**¿El 100 % de detección significa que el sistema es perfecto?**
No. Es sobre 38 defectos de un solo dataset. Con más datos y zapatos reales seguramente habrá errores. Además, el margen del umbral es estrecho.

**¿Dónde está la IA generativa (objetivo 4)?**
Se usó para generar código y diseño (la interfaz con Figma Make, la integración con un agente de programación), y cada uso quedó registrado y auditado en `agents/`. Ahí aparecen los errores que encontramos en lo generado.

**¿Por qué MQTT?**
Es el protocolo ligero estándar en Industria 4.0 para que máquinas y sensores publiquen datos. Así el prototipo se parece a una planta real y cada componente se puede reemplazar por separado.

**¿Funcionaría con una cámara real?**
La arquitectura sí: bastaría con reemplazar el simulador por una cámara que publique en el mismo tópico y con el mismo formato. El modelo habría que reentrenarlo con fotos de esa línea.
