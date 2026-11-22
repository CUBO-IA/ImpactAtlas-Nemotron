# Operación y despliegue — D2-16 a D2-18

Este documento es un runbook de preparación para un entorno publicado, no
evidencia de que exista uno. El entorno de prueba es local (`docs/poc-local.md`):
no requiere HTTPS, autenticación del piloto ni rate limit porque no expone
servicios fuera del host; eso no cubre los criterios de publicación listados aquí.
El repositorio define `Dockerfile` y, en `docker-compose.yml`, PostgreSQL local
más el servicio `app` bajo el perfil `poc`, que escucha en `127.0.0.1` solo para
prueba local. No configura un despliegue publicado, gateway HTTPS, autenticación
del piloto, rate limit, monitorización ni copias automáticas.
No se ha accedido a servidores ni se han cambiado bases de datos.

## Estado y bloqueos antes de operar

| Área | Estado comprobable en el repositorio | Pendiente para cerrar |
| --- | --- | --- |
| Aplicación (D2-16) | Aplicación Next.js con `Dockerfile` y servicio `app` en Compose bajo el perfil `poc`, verificados en local (`docs/poc-local.md`); no hay manifiesto/topología de despliegue publicado. | Elegir entorno y responsable de operación; autorizar publicación y fijar versión de Node/runtime compatibles. |
| Datos | Compose expone PostgreSQL local en `5432`; valores por defecto de usuario/contraseña son de desarrollo. `DATABASE_URL` es requerida por el cliente. | Obtener autorización del propietario de los datos para BD/corte candidatos, conectividad y credenciales de mínimo privilegio. No usar los valores locales en un entorno compartido. |
| Búsqueda semántica | El código tiene una compuerta que exige `SEMANTIC_SEARCH_ENABLED=true` y `SEMANTIC_SEARCH_AUDIT=confirmed`, consulta local y publicación agregada con mínimo `k=5`; por defecto se abstiene. Esto no acredita procedencia ni compatibilidad de los embeddings almacenados. La semántica no se activó en el POC local. | No habilitar hasta documentar modelo/revisión, `pooling` y prefijo de la ingesta, distancia y compatibilidad, y validar relevancia con criterios y resultados revisados; detalle en `docs/implementation-inventory.md` (`Semántica`). Dimensión/norma no bastan. |
| IA local | Decisión del proyecto: LFM3 vía `@browser-ai/transformers-js`, CPU q4, con `LFM3_MODEL_DIR` (por defecto `models`); no usar API externa/OpenAI. El POC local sí cargó el modelo y respondió en `/api/chat` (`docs/poc-local.md`). | Confirmar archivos completos/compatibles del modelo en la ruta configurada, espacio en disco, memoria y CPU suficientes **en el candidato de despliegue**; la carga local no dimensiona ese entorno. |
| Seguridad de acceso | No hay configuración versionada de HTTPS, control de acceso ni limitación de solicitudes. | Acordar identidad/grupo piloto, gateway TLS, límites y política de exposición con el responsable de seguridad/infraestructura. |
| Salud y observabilidad | Compose tiene healthcheck únicamente para PostgreSQL; el POC registró `GET /api/health` 200 en local, pero no hay healthcheck de contenedor ni configuración de logs estructurados/correlación. | Definir endpoint/monitorización, retención y redacción; verificar que `requestId` se propaga antes de declarar listo. |
| Medición (D2-17) | No hay resultados p50/p95, carga ni planes registrados aquí. | Medir en entorno autorizado; documentar muestra, concurrencia, versiones, corte, filtros y resultados antes de optimizar. |
| Recuperación (D2-18) | README describe una instantánea versionada fechada 2026-11-21 y restauración manual en una BD vacía. | Acordar backup vigente, destino aislado, permisos y ventana. La instantánea versionada no prueba que haya backups posteriores ni que una restauración se haya ensayado. |

**No continuar a publicación** hasta tener autorización explícita de entorno,
datos/corte, acceso y secretos. No ejecutar migraciones, importaciones, DDL,
restauraciones ni pruebas de carga contra una BD compartida o productiva sin
aprobación y ventana documentadas.

## D2-16 — Preparación de release

1. Confirmar por escrito entorno candidato, responsable, versión/corte de datos
   autorizado y acceso de red. Mantener la BD fuera de la red pública; la
   aplicación debe usar un rol realmente limitado a `SELECT` en los objetos
   necesarios. La sesión `READ ONLY` de auditoría no limita los privilegios del
   rol: la auditoría local encontró `INSERT`, `UPDATE` y `DELETE` concedidos al
   rol conectado. No se ha verificado un rol distinto, de solo lectura, para
   aplicación ni en una instancia de despliegue.
2. Configurar HTTPS y acceso del piloto en la capa aprobada de infraestructura.
   Aplicar rate limit allí o en una implementación revisada. Ninguno de estos
   controles se considera disponible por el hecho de documentarlo aquí.
3. Inyectar `DATABASE_URL` solo desde el gestor de secretos del entorno. No
   reutilizar credenciales por defecto de Compose. No poner secretos en
   argumentos de build, repositorio, logs o artefactos.
4. Construir y desplegar un artefacto identificado por commit. Confirmar
   explícitamente que el build/startup no importa datos, aplica migraciones ni
   requiere descargar el modelo al atender la primera solicitud. Configurar
   `LFM3_MODEL_DIR` y asegurar que los archivos locales requeridos por LFM3
   estén disponibles en esa ruta, sin incluirlos en una imagen o artefacto
   salvo que el entorno lo permita y se haya aprobado su tamaño/licencia.
   Reservar recursos locales para inferencia CPU q4 (memoria, CPU y disco);
   dimensionarlos mediante medición en el host candidato, no por suposición.
   No ejecutar scripts de ingesta como parte del release.
5. Revisar logs sin imprimir secretos, prompts sensibles ni datos individuales.
   Verificar salud, control de acceso, límites y correlación por `requestId`
   con evidencia del entorno antes de abrir acceso al piloto.

Los endpoints de backend están implementados y verificados en el POC local
(`docs/poc-local.md`); su autenticación, límites y comportamiento de salud en un
artefacto candidato publicado aún deben verificarse. El servicio `app` del perfil
`poc` en `docker-compose.yml` es solo para desarrollo: publica un puerto
configurable en `127.0.0.1` y monta el modelo en solo lectura. No es una
topología de producción ni un procedimiento para conectar una aplicación externa.

## D2-17 — Medición sin cambios de esquema

Hacer la prueba únicamente con autorización y carga/datos adecuados al entorno;
preferir fixture sintética o réplica aislada. Registrar antes de medir:

- commit/artefacto, runtime, configuración, versión/archivos locales de LFM3,
  `LFM3_MODEL_DIR`, modalidad CPU q4 y corte de datos;
- entorno, tamaño de muestra, duración, concurrencia y calentamiento;
- consultas y filtros selectivos, incluidos los 14 departamentos y recorridos
  concurrentes de chat/PDF cuando estén implementados;
- p50 y p95 de latencia, errores/timeouts y uso de recursos, sin datos personales.

Inspeccionar primero el inventario de índices y planes SQL/vectoriales con
permisos de lectura. No crear índices ni ejecutar DDL para “probar”: cualquier
cambio requiere aprobación explícita, evidencia del cuello de botella,
validación posterior y reversión documentada. No hay mediciones ni planes
resultantes registrados por esta tarea.

## D2-18 — Incidentes, rollback y recuperación

### Revisión de logs y fallos

Usar la consola aprobada del entorno y un intervalo acotado. Buscar por
`requestId`, endpoint, estado y duración; no copiar prompts, secretos, filas ni
embeddings al ticket. Ante modelo local ausente, incompatible o sin recursos,
confirmar que el endpoint devuelve un fallo acotado y recuperable, sin reintentos
indefinidos ni descargas inesperadas; ese comportamiento está pendiente de
verificación junto con la implementación de endpoints. Ante BD lenta,
detener pruebas de carga, observar pool/tiempos y escalar al responsable de BD;
no reiniciar ni cambiar límites de producción sin autorización.

### Rollback de aplicación

1. Detener el avance del release y registrar commit, hora, síntomas y
   `requestId` no sensible.
2. Con autorización del operador, volver al artefacto previamente aprobado por
   el mecanismo de despliegue del entorno.
3. Comprobar salud y un smoke test autorizado de lectura. Confirmar que no se
   tocaron tablas ni vectores y vigilar errores antes de reabrir tráfico.

No existe mecanismo de despliegue/rollback definido en este repositorio; este
procedimiento no se ha ensayado. No usar rollback de aplicación como sustituto
de una reversión de esquema.

### Restauración de datos

La restauración descrita en `README.md` requiere una base vacía y puede
reemplazar el estado esperado; seguirla solo en un entorno aislado, con backup
seleccionado, autorización del propietario y verificación posterior. No
restaurar ni sobrescribir una base compartida/productiva como parte de un
incidente sin aprobación explícita, plan de preservación del estado actual y
ventana. La instantánea versionada es fija y no debe suponerse respaldo vigente.
No se restauró ningún backup durante esta tarea.

## Checklist de cierre

- [ ] Entorno candidato, acceso, HTTPS, rate limit y responsables aprobados.
- [ ] Credenciales entregadas por canal seguro; privilegios efectivos del rol
      de aplicación comprobados como `SELECT` únicamente; puerto de BD no público.
- [ ] Para habilitar búsqueda semántica: procedencia/revisión de embeddings
      documentada, compatibilidad validada y revisada; la compuerta de entorno
      no es evidencia de esa validación.
- [ ] `LFM3_MODEL_DIR` y archivos requeridos del modelo local disponibles;
      recursos CPU q4 medidos en el host candidato.
- [ ] Artefacto reproducible y release verificado sin importación, migración ni
      descarga inesperada de modelo en startup/primera solicitud.
- [ ] Salud, logs redactados y `requestId` verificados.
- [ ] Medición reproducible y planes/inventario registrados; todo DDL aprobado
      o descartado con evidencia.
- [ ] Rollback de aplicación ensayado sin tocar tablas/vectores.
- [ ] Restauración de backup comprobada en entorno aislado autorizado.
- [ ] Smoke tests de datos, chat y PDF contra la URL final, coordinados con
      Dev 1; registrar URL, commit, corte y resultados no sensibles.

Esta tarea no marca esos criterios como completados. Las verificaciones de
`docs/poc-local.md` son implementación local, no tachan estos checks. No hubo
acceso a credenciales/entorno, pruebas contra servicios, despliegue, cambios de
BD ni pruebas de restauración.
