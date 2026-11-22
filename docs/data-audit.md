# Auditoría local de datos — D2-01

**Corte de auditoría:** 2026-11-22. **Alcance:** instancia PostgreSQL local indicada por `DATABASE_URL`; no aplicar estas conclusiones a otra instancia.

## Método y seguridad

- Consultas agregadas/metadatos únicamente, dentro de transacción `REPEATABLE READ READ ONLY`.
- `statement_timeout` de 3–5 s por sentencia y timeout de transacción acotado.
- No se seleccionaron filas individuales ni valores de `embedding`; las dimensiones y normas se calcularon como agregados sobre vectores existentes. No se hizo DDL, escritura, `EXPLAIN ANALYZE` ni exportación de microdatos.
- `transaction_read_only=on` e `isolation=repeatable read` se verificaron durante la sesión.
- **El rol de conexión sí tiene privilegios INSERT, UPDATE y DELETE en la tabla.** El modo de solo lectura de esta auditoría los bloqueó para estas transacciones, pero no sustituye un rol de aplicación sin escritura; ese permiso queda como riesgo operativo abierto.

## Esquema y calidad observados

Existe `public."NemotronSvMuestra"` con 10 columnas, todas `NOT NULL`:

| Columna | Tipo PostgreSQL |
| --- | --- |
| `id` | `integer` |
| `departamento` | `text` |
| `edad` | `integer` |
| `sexo` | `text` |
| `nivel_educativo` | `text` |
| `ocupacion` | `text` |
| `ingreso_estimado_usd` | `double precision` |
| `sin_acceso_financiero` | `boolean` |
| `meta_principal` | `text` |
| `embedding` | `vector` |

- Filas: **50,000**; IDs distintos: **50,000**.
- No se observaron valores nulos/vacíos en departamento, educación, ocupación, meta o sexo. No hubo ingresos nulos, negativos ni no finitos. La auditoría consideró edad fuera de `[0,120]` como inválida; no encontró casos, aunque ese rango no es una regla de negocio documentada.
- Ingreso observado: **USD 100–1,683.83**. Es un valor estimado; fuente y período no están documentados.
- Valores observados de sexo: `Femenino`, `Masculino`.
- `sin_acceso_financiero` contiene ambos valores booleanos; sin nulos.

## Dominios y correspondencias

- Se observaron exactamente 14 nombres departamentales, con acentos: Ahuachapán, Cabañas, Chalatenango, Cuscatlán, La Libertad, La Paz, La Unión, Morazán, San Miguel, San Salvador, San Vicente, Santa Ana, Sonsonate y Usulután.
- Educación: Primaria completa, Primaria incompleta, Secundaria completa, Secundaria incompleta, Sin escolaridad, Técnico, Universitario.
- Ocupación y metas exactas, sin frecuencias, constan en `src/data/audited-catalog.json`. Los IDs de categorías son slugs mecánicos de los rótulos observados; sus valores SQL conservan el texto físico exacto.
- No se observó categoría faltante (`NULL`/vacía), por lo que no se incluyó `__missing__` en este catálogo local.
- `geoFeatureId` usa el ID departamental acordado en el contrato. No existe actualmente GeoJSON local para validar esos IDs contra features; esa verificación queda pendiente.

## Embeddings e índices

- Extensión `vector` versión **0.8.7**; 50,000 vectores presentes, todos de dimensión **768**.
- Norma observada agregadamente: mín. `0.9999997148`, máx. `1.0000004101`, promedio `1.0000000579`; consistente con vectores normalizados dentro de tolerancia numérica.
- La procedencia/modelo/revisión/pooling/prefijo de los vectores almacenados no se pudo establecer. Dimensión y norma no prueban compatibilidad semántica con el modelo actual.
- No se hizo evaluación semántica (pares/consultas etiquetados, relevancia, comparación con el modelo de ingesta ni revisión de resultados). Por tanto, la compatibilidad y calidad de búsqueda siguen sin verificar; no habilitarla basándose solo en esta auditoría estructural.
- El código actual de búsqueda requiere vectores de consulta de dimensión 768 y finitos, y la compuerta de entorno está desactivada salvo configuración explícita. Estas validaciones de forma y controles de publicación (`k=5`) no verifican procedencia, revisión ni calidad semántica de los embeddings de la tabla.
- Único índice observado: PK B-tree `NemotronSvMuestra_pkey (id)`. No hay índice vectorial declarado para esta tabla.

## Pendientes / límites

- Confirmar fuente del conjunto, período de recolección, significado/unidad temporal del ingreso y procedencia de embeddings.
- Sustituir el rol con escritura por credenciales de aplicación con privilegios efectivos exclusivamente `SELECT` sobre los objetos necesarios; auditar por separado el rol y la instancia de despliegue. `READ ONLY` en una transacción limita esa transacción, no los permisos permanentes del rol.
- Validar `geoFeatureId` cuando se incorpore el GeoJSON.
- No se midieron planes de consulta: `EXPLAIN ANALYZE` se omitió deliberadamente para no ejecutar carga adicional en la instancia local.
- `src/data/audited-catalog.json` refleja esta instancia local. Configurar `DATA_CATALOG_PATH` explícitamente solo en el entorno/corte correspondiente; la aplicación no debe asumir que otro entorno comparte estos dominios.
- Verificación con las consultas de producción bajo una única transacción de lectura: 14 grupos departamentales mapeados suman 50,000; educación produce 7 grupos y suma 50,000; `educationIds=["tecnico"]` selecciona 9,387 registros; el filtro `__missing__` devuelve cero, sin abrir el universo. La consulta de resumen general devuelve 50,000. El proveedor de reportes devolvió una instantánea con 7 categorías educativas, 15 ocupaciones y 8 metas.
