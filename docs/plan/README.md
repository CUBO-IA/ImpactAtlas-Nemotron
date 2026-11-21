# ImpactAtlas — Plan de desarrollo del MVP

> Planificación, no implementación. Todos los checkboxes de desarrollo comienzan pendientes. Una tarea solo se marca `[x]` con su PR, pruebas y criterio de aceptación verificados.

## 1. Resumen ejecutivo

ImpactAtlas permitirá explorar **la muestra socioeconómica disponible** mediante un mapa de los 14 departamentos de El Salvador, comparar departamentos, consultar los datos mediante IA y descargar reportes PDF.

Se reutilizarán PostgreSQL, la tabla y los embeddings existentes. SQL calculará estadísticas exactas sobre los registros filtrados; la búsqueda vectorial encontrará ejemplos semánticamente relacionados, nunca estimará conteos, promedios o porcentajes.

**Equipo:** dos desarrolladores full-stack. **Duración base:** seis sprints de una semana, cinco días laborables por sprint. **Capacidad:** 40 h semanales por persona, de las cuales se comprometen 32 h y se reservan 8 h para imprevistos, revisiones y correcciones. Total: **384 h planificadas + 96 h de reserva = 480 h-persona**. Las integraciones semanales ya están dentro de las 32 h; no se suman dos veces.

La estimación supone acceso de lectura a PostgreSQL, autorización de uso de los datos, un proveedor LLM aprobado, disponibilidad de un GeoJSON con licencia adecuada y un entorno donde ejecutar Node.js y Chromium. Si una condición falla, se registra el bloqueo y se reestima: no se oculta como trabajo completado.

## 2. Documentos y orden de lectura

| Documento | Contenido |
| --- | --- |
| [01-arquitectura-y-datos.md](./01-arquitectura-y-datos.md) | Estado observado, arquitectura Mermaid, PostgreSQL, indicadores, vectores, IA y carpetas. |
| [02-contratos-api.md](./02-contratos-api.md) | Contratos v1, parámetros, respuestas, validaciones, errores y ejemplos. |
| [03-fases-y-cronograma.md](./03-fases-y-cronograma.md) | Fases, sprints paralelos, dependencias, integración y entregables. |
| [04-dev1-frontend.md](./04-dev1-frontend.md) | Issues del desarrollador 1, estimaciones y checklist individual. |
| [05-dev2-backend-ia.md](./05-dev2-backend-ia.md) | Issues del desarrollador 2, estimaciones y checklist individual. |
| [06-calidad-despliegue-y-riesgos.md](./06-calidad-despliegue-y-riesgos.md) | Pruebas, aceptación, seguridad, operación, riesgos y checklist de publicación. |

**Fuente de verdad de estado:** los checklists individuales y los hitos de integración. Las tablas describen tareas; no implican que estén implementadas. Al cerrar un issue, añadir enlace a PR y evidencia junto a su checkbox.

## 3. Alcance del MVP

| Funcionalidad | Incluye | No incluye |
| --- | --- | --- |
| Mapa | GeoJSON local de 14 departamentos, MapLibre, coropletas por indicador, filtros de ingresos/educación/ocupación/metas, selección y panel estadístico con ECharts. | Municipios, geocodificación, capas en tiempo real, PostGIS. |
| Comparador | Entre 2 y 14 departamentos, filtros combinados, indicadores económicos/educativos/laborales y gráficos con la misma definición estadística del mapa. | Comparaciones causales, predicciones, datos externos. |
| Chat | Preguntas en español, herramientas SQL controladas, búsqueda semántica/híbrida cuando corresponda, texto/tablas/gráficos respaldados y fuentes. | SQL arbitrario, navegación web, agentes autónomos, memoria de conversaciones en BD. |
| Reportes | Por departamentos o indicadores, filtros y secciones seleccionables, cifras y gráficos consistentes, análisis IA y PDF del servidor con fuentes y limitaciones. | Historial persistente, envíos programados, editor libre, exportaciones adicionales. |

No se reimportará el CSV, no se regenerarán los embeddings del conjunto, no se añadirán bases de datos, colas, Redis, microservicios ni tablas de reportes/chat. Generar **el embedding de una pregunta nueva** sí es necesario para buscar y no modifica los vectores guardados.

El acceso seguro mínimo se resolverá con el control del gateway/proxy existente para el piloto; no se construirá un módulo de usuarios o roles como funcionalidad adicional.

## 4. Distribución de responsabilidades

| Área | Responsable principal | Revisión/apoyo |
| --- | --- | --- |
| Interfaz, filtros, MapLibre, ECharts y accesibilidad | Dev 1 | Dev 2 revisa semántica de datos. |
| Contratos compartidos y fixtures | Dev 1 mantiene tipos/fixtures; ambos aprueban | Dev 2 valida entradas/salidas reales. |
| PostgreSQL, consultas, validaciones y endpoints | Dev 2 | Dev 1 prueba contratos y experiencia de error. |
| Herramientas IA, proveedor API, vectores y PDF | Dev 2 | Dev 1 integra bloques y verifica presentación. |
| Especificación de gráficos reutilizable en PDF | Dev 1 | Dev 2 implementa render del servidor. |
| Pruebas de interfaz/E2E y pruebas SQL/API/IA | Dev 1 / Dev 2, respectivamente | Revisión cruzada, sin duplicar escenarios. |
| Integración, publicación y aceptación | Ambos | Dev 2 opera; Dev 1 verifica recorridos reales. |

## 5. Inicio inmediato

**Primer día, sin esperar al backend completo:**

1. Ambos: abrir I-01 y revisar el borrador de [contratos](./02-contratos-api.md). Acordar identificadores, filtros, errores y reglas de indicadores.
2. Dev 1: iniciar D1-01 con navegación y estados vacíos; preparar fixtures sintéticos, no copiar personas reales al repositorio.
3. Dev 2: iniciar D2-01 con auditoría de solo lectura; entregar primero tabla/columnas, categorías y mapeo departamental.
4. Antes de terminar el segundo día: aprobar contrato v1 y ejemplos. Dev 1 continúa con fixtures; Dev 2 implementa el mismo contrato.
5. No ejecutar `db:ingest`, resets, migraciones de inicialización ni escrituras sobre el conjunto para comenzar.

### Checkpoints globales

- [ ] I-01 — Contratos v1 y definiciones de datos acordados.
- [ ] I-02 — Mapa conectado a estadísticas reales.
- [ ] I-03 — Comparador integrado y compatibilidad vectorial/proveedor comprobada.
- [ ] I-04 — Chat respaldado por herramientas, sin SQL libre.
- [ ] I-05 — Reporte PDF íntegro y consistente con los filtros.
- [ ] I-06 — MVP verificado y publicado.

## 6. Regla de cierre de cualquier issue

- Entregable disponible y enlazado.
- Criterios específicos del issue y contratos cumplidos.
- Una verificación apropiada del comportamiento, reutilizando pruebas existentes cuando basten.
- Sin secretos, datos personales, SQL libre ni modificaciones innecesarias de la BD.
- Revisión del otro desarrollador; discrepancias entre UI/API/documentación resueltas en el mismo cambio.
- Checkbox marcado únicamente después de lo anterior. Un bloqueo o implementación parcial sigue como `[ ]`.
