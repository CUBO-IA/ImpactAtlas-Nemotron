# 04 — Dev 1: frontend y visualización

**Responsable de todos los issues D1:** desarrollador 1. Dev 2 revisa contratos y exactitud de interpretación, sin implementar la misma interfaz.

**Estimación total:** 168 h individuales + 24 h compartidas = **192 h**. Reserva orientativa: 48 h durante las seis fases. En la tabla, S1–S6 identifican las fases 1–6, sin duración semanal.

## 1. Issues listos para crear

Cada fila proporciona título, prioridad, fase, esfuerzo estimado, dependencias y entregable. Añadir al issue el criterio de aceptación del mismo ID, el contrato relacionado y la definición de cierre del [README](./README.md).

| ID | Título | Prioridad | Fase | Esfuerzo | Dependencias | Entregable |
| --- | --- | --- | --- | --- | --- | --- |
| D1-01 | Crear shell de ImpactAtlas y navegación de las cuatro funciones | P1 | S1 | 10 h | Ninguna; shell independiente de API. | Layout, navegación, componentes reutilizados y estados de carga/error/vacío. |
| D1-02 | Implementar filtros tipados y persistencia en URL | P0 | S1 | 10 h | I-01, D1-01. | Panel de filtros de ingresos/educación/ocupación/metas y estado común. |
| D1-03 | Integrar esquemas compartidos y fixtures sintéticos | P0 | S1 | 8 h | I-01. | Consumir esquemas Zod compartidos, cliente `fetch` mínimo y fixtures de éxito/vacío/supresión/error/chat/PDF. |
| D1-04 | Integrar GeoJSON de 14 departamentos y mapa MapLibre | P1 | S2 | 14 h | D1-01, D1-03; mapeo inicial D2-01. | Geometría licenciada, selección, coropleta, leyenda y alternativa textual. |
| D1-05 | Crear panel departamental y gráficos ECharts | P1 | S2 | 10 h | D1-02, D1-03; contrato de estadísticas. | Tarjetas y distribuciones educativas/laborales/metas conectadas al mismo filtro. |
| D1-06 | Verificar mapa, filtros y cambios rápidos de selección | P0 | S2 | 4 h | D1-04, D1-05, D2-05. | Regresión de recorrido mapa/detalle, vacíos y respuestas fuera de orden. |
| D1-07 | Implementar selección múltiple y vista comparativa | P1 | S3 | 16 h | I-02; contrato comparador aprobado en I-01. | Comparación de 2–14 departamentos, tabla y gráficos de ingresos/educación/ocupación. |
| D1-08 | Integrar filtros combinados y referencia de comparación | P1 | S3 | 8 h | D1-02, D1-07. | Filtros comunes, departamento de referencia y diferencias con unidades correctas. |
| D1-09 | Verificar coherencia visual y funcional del comparador | P0 | S3 | 4 h | D1-07, D1-08, D2-07. | Pruebas del recorrido comparativo y consistencia con mapa. |
| D1-10 | Construir chat y contexto de filtros sin persistencia | P1 | S4 | 16 h | I-03, D1-03. | Pregunta/historial acotado, envío, cancelación, espera y reintento explícito. |
| D1-11 | Renderizar bloques de texto, tabla, gráfico y evidencias | P1 | S4 | 8 h | D1-10, D1-05; contrato `ChartSpec`. | Render seguro, fuentes, universo consultado y limitaciones visibles. |
| D1-12 | Verificar abstención, aclaración y fallos del chat | P0 | S4 | 4 h | D1-10, D1-11, D2-10. | Estados sin evidencia, LFM3 local no disponible, límites y contenido no ejecutable. |
| D1-13 | Construir configuración y descarga de reportes PDF | P1 | S5 | 12 h | I-04, D1-02; contrato PDF. | Selección de departamentos/indicadores/secciones, resumen de filtros y descarga. |
| D1-14 | Compartir gráficos permitidos entre UI y render SSR | P0 | S5 | 8 h | D1-05, D1-11. | Traducción `ChartSpec` → opciones ECharts y ejemplos SSR sin DOM para Dev 2. |
| D1-15 | Verificar configuración, descarga y legibilidad de reportes | P0 | S5 | 8 h | D1-13, D1-14, D2-14. | Recorrido de descarga, manejo JSON/binario y revisión visual del PDF real. |
| D1-16 | Corregir accesibilidad y rendimiento de visualizaciones | P0 | S6 | 10 h | I-05. | Navegación teclado, etiquetas/contraste, carga por pantalla y limpieza de instancias. |
| D1-17 | Ejecutar y completar regresión E2E de las cuatro funciones | P0 | S6 | 8 h | I-05, D1-16. | Suite mínima de recorridos críticos y resultados en entorno candidato. |
| D1-18 | Resolver bloqueantes UI y entregar guía de uso del piloto | P0 | S6 | 10 h | D1-17; coordinación D2-16. | Correcciones, guía breve, capturas no sensibles y smoke test de UI desplegada. |

## 2. Criterios de aceptación por issue

### Fase 1 — 28 h + I-01

**D1-01**

- Las cuatro pantallas son navegables; no se crean funciones extra.
- Se reutilizan `components/ui` cuando sean adecuados.
- Estados de carga/error/vacío distinguibles en móvil y escritorio.

**D1-02**

- Rango inclusivo y multiselecciones reproducen el contrato; se pueden limpiar filtros.
- Recargar una URL conserva el mismo estado válido; valores inválidos de URL no generan consultas.
- El contexto se comparte entre funcionalidades sin que un filtro quede visualmente aplicado pero ausente de la petición.

**D1-03**

- Tipos/fixtures cubren todas las respuestas y una muestra insuficiente, sin usar microdatos reales.
- Hay un mecanismo de desarrollo explícito para fixtures, deshabilitado en producción.
- Dev 2 acepta los ejemplos antes de implementarlos; no se requieren endpoints para dibujar las vistas.

### Fase 2 — 28 h + I-02

**D1-04**

- Exactamente 14 geometrías con IDs únicos, fuente/licencia registradas y correspondencia con catálogo.
- Cambiar indicador actualiza colores y leyenda; valores nulos y suprimidos tienen estilo propio.
- Selección por mapa y lista accesible equivalentes; el mapa no depende de un proveedor de tiles.

**D1-05**

- Tarjetas y gráficos usan las métricas del servidor, sin recalcular medias o porcentajes con los puntos dibujados.
- Panel muestra filtros, unidades, denominadores publicables y advertencias.
- Gráfico educativo, laboral y de metas funciona en estado normal, vacío y suprimido.

**D1-06**

- Un recorrido automatizado de alto valor aplica filtros, selecciona departamento y comprueba el mismo alcance en mapa/panel.
- Simular respuesta anterior tardía no reemplaza datos de la selección actual.
- Error recuperable no borra silenciosamente los filtros de la persona.

### Fase 3 — 28 h + I-03

**D1-07**

- Se pueden agregar/quitar 2–14 departamentos; mínimo inválido muestra guía, no petición incorrecta.
- Tabla, gráficos y leyendas mantienen etiquetas/unidades y datos nulos.
- Educación y ocupación se comparan con categorías alineadas, no por posición accidental en un arreglo.

**D1-08**

- Filtros combinados idénticos a los del explorador; selección territorial no se envía dos veces.
- Referencia visible y modificable; al retirarla, se requiere elegir otra o se asigna una explícitamente.
- Diferencias en USD estimados y puntos porcentuales; no restar porcentajes como cambio relativo.

**D1-09**

- Un recorrido verifica dos departamentos con filtros y cambio de referencia.
- Cifras coinciden con el servicio común y se distinguen cero, sin datos y muestra insuficiente.

### Fase 4 — 28 h + I-04

**D1-10**

- Pregunta y contexto actual son visibles; historial limitado, sin guardar conversaciones en BD.
- Evitar doble envío involuntario; reintento no ocurre en bucle ni genera peticiones ocultas.
- Un fallo/cancelación conserva la pregunta para corregirla o reenviarla.

**D1-11**

- Render de texto plano o contenido sanitizado; nunca ejecutar HTML o scripts del modelo.
- Tabla/gráfico solo aceptan el contrato reducido y valores respaldados.
- Cada resultado muestra evidencia, filtros y diferencia entre agregados exhaustivos y ejemplos semánticos.

**D1-12**

- Aclaración, abstención, 429, timeout y fallo de carga/no disponibilidad de LFM3 local tienen mensajes accionables distintos.
- El texto no presenta semántica como conteo nacional ni causalidad.
- Se verifica al menos un contenido malicioso y un resultado sin evidencia con fixtures.

### Fase 5 — 28 h + I-05

**D1-13**

- Persona elige filtros, indicadores y secciones; fuentes/limitaciones no son opcionales.
- Se deshabilita el envío duplicado durante la generación, sin bloquear toda la navegación.
- PDF se descarga desde respuesta binaria; errores JSON no se guardan como `.pdf`.
- Se revoca el object URL de descarga cuando ya no es necesario.

**D1-14**

- Mismo `ChartSpec` y etiquetas/unidades en navegador y servidor.
- No funciones/HTML/URLs externos en el contrato de gráficos.
- Entregar el primer gráfico SSR al inicio de la fase; probar que puede renderizarse sin `window`/`document`.

**D1-15**

- Un recorrido configura secciones y descarga un PDF real; otro verifica un error de generación.
- Revisar saltos de página, acentos, tablas largas, valores nulos y fuentes/advertencias.
- Datos del PDF corresponden a su propio snapshot y configuración; no comparar a ciegas consultas hechas en momentos diferentes.

### Fase 6 — 28 h + I-06

**D1-16**

- Funciones principales utilizables por teclado, foco visible y alternativa tabular al mapa/gráficos.
- Ningún indicador depende solo del color; leyendas y mensajes legibles.
- Carga/limpieza de MapLibre y ECharts evita duplicación de listeners o fugas al navegar.

**D1-17**

- Los recorridos críticos definidos en [calidad](./06-calidad-despliegue-y-riesgos.md) pasan con fixtures y una ejecución contra el candidato real.
- Se documentan comandos y resultados exactos; no basar aprobación únicamente en capturas o cobertura porcentual.

**D1-18**

- Bloqueantes UI resueltos y revisados; guía explica filtros, fuentes y límites del conjunto.
- Smoke test contra URL desplegada comprueba mapa, comparación, chat y descarga real.
- No fixtures habilitados ni mensajes que atribuyan representatividad nacional.

## 3. Checklist de seguimiento

Marcar cada ID solo al cerrar su issue; añadir `— PR: …; evidencia: …`.

- [ ] D1-01 — Shell y navegación.
- [ ] D1-02 — Filtros y URL.
- [ ] D1-03 — Contratos y fixtures.
- [ ] D1-04 — MapLibre y GeoJSON.
- [ ] D1-05 — Panel y gráficos.
- [ ] D1-06 — Pruebas del explorador.
- [ ] D1-07 — Vista comparativa.
- [ ] D1-08 — Filtros y referencia.
- [ ] D1-09 — Pruebas del comparador.
- [ ] D1-10 — Interfaz de chat.
- [ ] D1-11 — Bloques y evidencias.
- [ ] D1-12 — Fallos y abstención.
- [ ] D1-13 — Configuración y descarga PDF.
- [ ] D1-14 — Gráficos compartidos SSR.
- [ ] D1-15 — Pruebas de reportes.
- [ ] D1-16 — Accesibilidad/rendimiento.
- [ ] D1-17 — Regresión E2E.
- [ ] D1-18 — Correcciones y guía.

Los hitos I-01…I-06 se actualizan en el [README](./README.md), sin sumar su esfuerzo otra vez.
