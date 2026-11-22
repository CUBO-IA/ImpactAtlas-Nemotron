# 02 — Contratos de API

> Contrato objetivo para I-01. Las rutas descritas aún no están implementadas salvo el chat anterior, cuyo protocolo es distinto. Los ejemplos son **sintéticos**. Los esquemas compartidos están organizados por funcionalidad en `src/contracts/` y se reexportan desde `src/contracts/index.ts`; las categorías existentes deben verificarse en servidor contra el catálogo auditado.

## 1. Decisiones comunes

| Método | Ruta final | Parámetros de URL/query | Cuerpo | Respuesta |
| --- | --- | --- | --- | --- |
| GET | `/api/catalog` | Ninguno | Ninguno | JSON `ApiResponse<Catalog>` |
| POST | `/api/statistics` | Ninguno | `StatisticsRequest` | JSON `ApiResponse<StatisticsData>` |
| POST | `/api/compare` | Ninguno | `CompareRequest` | JSON `ApiResponse<CompareData>` |
| POST | `/api/chat` | Ninguno | `ChatRequest` | JSON `ApiResponse<ChatData>` |
| POST | `/api/reports/pdf` | Ninguno | `ReportRequest` | Binario PDF; errores JSON |
| GET | `/api/health` | Ninguno | Ninguno | JSON con `status` |

Ninguna ruta admite parámetros de ruta o query. Los POST reciben `Content-Type: application/json`. `GET /geo/sv-departamentos.geojson` es un asset público, no un endpoint de API. La ruta `/api/chat` existente utiliza otro cuerpo y streaming: se reemplazará por este contrato, no debe tratarse como ya compatible.

- Base `/api`, sin versionado en la URL; JSON UTF-8 salvo PDF y GeoJSON.
- POST para consultas con filtros complejos, aunque sean operaciones de lectura.
- Solo tres agrupaciones categóricas y una territorial, sin `groupBy` arbitrario ni SQL público.
- Esquemas Zod y tipos inferidos en `src/contracts/`, compartidos por cliente y servidor; el servidor debe validar cada entrada y las categorías contra el catálogo.
- Los esquemas comprueban forma y límites estructurales; no reemplazan la validación del catálogo ni las reglas de privacidad, evidencia y autorización en servidor. Ninguna ruta nueva se implementa por definir su esquema.
- Ambos mantienen los esquemas compartidos; Dev 1 prepara fixtures y Dev 2 valida entradas y salidas reales. Cambios incompatibles requieren acuerdo de ambos antes de merge.
- Respuestas analíticas y de IA: `Cache-Control: no-store` inicialmente.
- No exponer registros individuales, vectores, prompts internos ni errores de PostgreSQL.

## 2. Tipos compartidos

La siguiente especificación describe el contrato; los esquemas Zod compartidos son la definición ejecutable de su forma.

```ts
type DepartmentId =
  | "ahuachapan" | "cabanas" | "chalatenango" | "cuscatlan"
  | "la-libertad" | "la-paz" | "la-union" | "morazan"
  | "san-miguel" | "san-salvador" | "san-vicente"
  | "santa-ana" | "sonsonate" | "usulutan";

type Filters = {
  departmentIds?: DepartmentId[];
  income?: { min?: number; max?: number };
  educationIds?: string[];
  occupationIds?: string[];
  goalIds?: string[];
};

type GroupBy = "department" | "education" | "occupation" | "goal";
type MetricId =
  | "sample_count" | "income_mean" | "income_median"
  | "financial_exclusion_pct" | "category_count" | "category_pct";

type MetricValue = {
  value: number | null;
  unit: "records" | "usd_estimated" | "percent";
  validN: number | null;
  missingN: number | null;
  suppressed: boolean;
  reason: "empty" | "insufficient_sample" | "complementary_suppression" | null;
};

type Meta = {
  requestId: string;
  datasetId: string;
  datasetVersion: string;
  generatedAt: string; // ISO 8601
  appliedFilters: Filters;
  sampleSize: number | null;
  warnings: { code: string; message: string }[];
};

type ApiResponse<T> = { data: T; meta: Meta };
```

`datasetId` es un alias público, no el nombre físico de la tabla. `datasetVersion` identifica el corte auditado mediante configuración/documentación, sin exigir otra tabla. Si el conjunto cambia, se actualiza ese identificador; no presentar una fecha de recolección desconocida como fecha de consulta.

Cuando una métrica está suprimida, `value`, `validN` y `missingN` son `null`; también se oculta cualquier `sampleSize` que permita reconstruir el dato protegido. Una cohorte vacía sí puede publicar `sampleSize: 0` y conteo 0; medias/porcentajes quedan `null` con `reason: "empty"`.

IDs de educación, ocupación y meta se publican en catálogo y se mapean a valores exactos del servidor. Su estabilidad y alias se acuerdan en I-01. Se reserva `__missing__` para «Sin dato»; no se permite como departamento.

### Semántica de filtros

- Objeto omitido equivale a `{}`: universo completo.
- Arreglo vacío, valores duplicados, campos desconocidos, IDs inexistentes y `null` se rechazan.
- Máximo 14 departamentos y 30 valores por dimensión categórica.
- `income` debe tener al menos un extremo; números finitos, no negativos y `min <= max`.
- OR dentro de una dimensión; AND entre dimensiones. Rango inclusivo.
- Se normaliza el orden de IDs para devolver `appliedFilters`, sin alterar su significado.
- La UI conserva el filtro al cambiar de mapa a comparador/chat/reportes; cualquier sobrescritura por pregunta se muestra explícitamente.
- Los límites máximos monetarios válidos se documentan tras auditoría, no se inventan en la interfaz.

## 3. Catálogo y geometría

### `GET /api/catalog`

Sin parámetros. Devuelve catálogos estáticos/auditados suficientes para trabajar sin descargar filas:

```ts
type Catalog = {
  departments: { id: DepartmentId; label: string; geoFeatureId: string }[];
  education: { id: string; label: string }[];
  occupations: { id: string; label: string }[];
  goals: { id: string; label: string }[];
  indicators: {
    id: MetricId;
    label: string;
    unit: MetricValue["unit"];
    allowedGroupBy: GroupBy[];
    definition: string;
  }[];
  income: { currency: "USD"; period: string | null };
  dataset: {
    id: string;
    version: string;
    sourceLabel: string;
    collectionPeriod: string | null;
    representative: false;
    limitations: string[];
  };
  privacy: { minimumPublishableN: 5 };
};
```

Respuesta `ApiResponse<Catalog>`. En catálogo y health, `sampleSize: null` porque no describen una cohorte consultada. No publicar frecuencias pequeñas en catálogo. No inventar categorías para completar el demo.

### `GET /geo/sv-departamentos.geojson`

Asset local bajo `public/`, no Route Handler. `FeatureCollection` con exactamente 14 features `Polygon`/`MultiPolygon`, ID estable y `properties.departmentId`/`name`.

La geometría se versiona con fuente/licencia en documentación. Sin necesidad de servicio de tiles: un estilo MapLibre mínimo con fondo y polígonos cumple el MVP.

## 4. Estadísticas para mapa y detalle

### `POST /api/statistics`

```ts
type StatisticsRequest = {
  filters?: Filters;
  groupBy: GroupBy;
  metrics: MetricId[];
};
type StatisticsData = {
  groupBy: GroupBy;
  rows: {
    key: string;
    label: string;
    sampleSize: number | null;
    metrics: Partial<Record<MetricId, MetricValue>>;
  }[];
};
```

Validación:

- `metrics`: 1–6 IDs únicos.
- `groupBy: "department"` permite `sample_count`, `income_mean`, `income_median`, `financial_exclusion_pct`.
- Agrupaciones `education`, `occupation`, `goal` permiten `category_count`, `category_pct`.
- No se admiten dimensiones o expresiones fuera de estas combinaciones.
- La agrupación territorial devuelve los 14 departamentos si no hay filtro territorial, o los seleccionados; los vacíos no se pierden.
- Las categorías son las del catálogo de esa dimensión, incluyendo «Sin dato» si existe en el conjunto; categorías sin coincidencias devuelven cero.
- Una selección de departamento se representa en `filters.departmentIds`, no necesita otro endpoint.

Ejemplo de mapa:

```json
{
  "filters": {
    "income": { "min": 200, "max": 800 },
    "departmentIds": ["santa-ana", "san-salvador"]
  },
  "groupBy": "department",
  "metrics": ["sample_count", "income_mean", "financial_exclusion_pct"]
}
```

Ejemplo de respuesta abreviada en filas, pero completo en estructura:

```json
{
  "data": {
    "groupBy": "department",
    "rows": [
      {
        "key": "santa-ana",
        "label": "Santa Ana",
        "sampleSize": 100,
        "metrics": {
          "sample_count": {
            "value": 100, "unit": "records", "validN": 100,
            "missingN": 0, "suppressed": false, "reason": null
          },
          "income_mean": {
            "value": 500, "unit": "usd_estimated", "validN": 100,
            "missingN": 0, "suppressed": false, "reason": null
          },
          "financial_exclusion_pct": {
            "value": 40, "unit": "percent", "validN": 100,
            "missingN": 0, "suppressed": false, "reason": null
          }
        }
      },
      {
        "key": "san-salvador",
        "label": "San Salvador",
        "sampleSize": 100,
        "metrics": {
          "sample_count": {
            "value": 100, "unit": "records", "validN": 100,
            "missingN": 0, "suppressed": false, "reason": null
          },
          "income_mean": {
            "value": 600, "unit": "usd_estimated", "validN": 100,
            "missingN": 0, "suppressed": false, "reason": null
          },
          "financial_exclusion_pct": {
            "value": 30, "unit": "percent", "validN": 100,
            "missingN": 0, "suppressed": false, "reason": null
          }
        }
      }
    ]
  },
  "meta": {
    "requestId": "example-synthetic-001",
    "datasetId": "sv-sample",
    "datasetVersion": "fixture-v1",
    "generatedAt": "2026-11-21T00:00:00Z",
    "appliedFilters": {
      "departmentIds": ["san-salvador", "santa-ana"],
      "income": { "min": 200, "max": 800 }
    },
    "sampleSize": 200,
    "warnings": [
      {
        "code": "NON_REPRESENTATIVE_SAMPLE",
        "message": "Datos de muestra; no necesariamente representativos de El Salvador."
      }
    ]
  }
}
```

Panel de detalle: una consulta territorial para tarjetas y hasta tres consultas categóricas, cancelables y paralelas. No traer los 50,000 registros para calcular gráficos en React.

## 5. Comparación

### `POST /api/compare`

```ts
type CompareRequest = {
  departmentIds: DepartmentId[]; // 2–14, únicos
  referenceDepartmentId: DepartmentId; // debe estar en la selección
  filters?: Omit<Filters, "departmentIds">;
  metrics: (
    | "sample_count" | "income_mean" | "income_median"
    | "financial_exclusion_pct"
  )[];
  breakdowns: ("education" | "occupation" | "goal")[]; // 0–3, únicos
};
type CompareData = {
  referenceDepartmentId: DepartmentId;
  departments: {
    id: DepartmentId;
    label: string;
    sampleSize: number | null;
    metrics: Partial<Record<MetricId, MetricValue>>;
    differences: {
      metricId: MetricId;
      value: number | null;
      unit: "records" | "usd_estimated" | "percentage_points";
    }[];
    breakdowns: Partial<Record<
      "education" | "occupation" | "goal",
      StatisticsData["rows"]
    >>;
  }[];
};
```

- `filters.departmentIds` se rechaza; no existen dos selecciones territoriales contradictorias.
- Requiere al menos una métrica o un breakdown; máximo cuatro métricas.
- Diferencias: departamento menos referencia; referencia tiene diferencia 0 solo si su valor es publicable.
- Si un valor es nulo/suprimido o no tiene denominador válido, su diferencia es `null`.
- La comparación de porcentajes usa **puntos porcentuales**, no cambios relativos. No calcular diferencias de códigos de categoría.
- `meta.appliedFilters` incorpora los departamentos seleccionados.

Ejemplo:

```json
{
  "departmentIds": ["santa-ana", "san-salvador"],
  "referenceDepartmentId": "santa-ana",
  "filters": { "income": { "min": 200 } },
  "metrics": ["income_mean", "financial_exclusion_pct"],
  "breakdowns": ["education", "occupation"]
}
```

Salida `ApiResponse<CompareData>`. Con la misma fixture del ejemplo anterior, San Salvador tiene `+100 USD estimados` y `-10 puntos porcentuales`; no «10% menos personas».

## 6. Chat respaldado por evidencia

### `POST /api/chat`

MVP con respuesta JSON completa; no se exige streaming. Evita mantener dos protocolos mientras se validan fuentes y resultados.

```ts
type ChatRequest = {
  question: string; // 1–2000 caracteres tras trim
  filters?: Filters;
  history?: { role: "user" | "assistant"; text: string }[];
};
type ChartSpec = {
  type: "bar" | "grouped_bar";
  title: string;
  categories: string[]; // máximo 30
  series: {
    name: string;
    values: (number | null)[];
    unit: "records" | "usd_estimated" | "percent" | "percentage_points";
  }[]; // máximo 14; longitud igual a categories
  evidenceIds: string[];
};
type ChatData = {
  status: "answered" | "needs_clarification" | "insufficient_evidence";
  blocks: (
    | { type: "text"; text: string; evidenceIds: string[] }
    | {
        type: "table";
        title: string;
        columns: string[];
        rows: (string | number | null)[][];
        evidenceIds: string[];
      }
    | { type: "chart"; chart: ChartSpec }
  )[];
  evidence: {
    id: string;
    kind: "sql_aggregate" | "semantic_examples";
    description: string;
    filters: Filters;
    sampleSize: number | null;
    exhaustive: boolean;
    facts: { id: string; label: string; value: number | null; unit: string }[];
  }[];
  toolsUsed: ("get_statistics" | "compare_departments" | "search_semantic_evidence")[];
};
```

Reglas:

- Máximo 10 mensajes de historial, 2000 caracteres por mensaje, roles permitidos únicamente `user`/`assistant`; sin mensajes `system`/`tool` suministrados por cliente.
- El historial es contexto no confiable y no constituye evidencia. No aceptar referencias previas sin volver a verificarlas.
- Filtros de la UI aplican por defecto. Si la pregunta pide un alcance distinto, aclarar o señalar el reemplazo; devolver los filtros realmente usados.
- Máximo 4 herramientas por petición, `topK` semántico interno 1–20, sin exponer un endpoint de vectores.
- Máximo 30 filas por bloque y 14 series. No devolver HTML/JS ni opciones ECharts arbitrarias.
- `exhaustive: true` se refiere al universo filtrado de la muestra, nunca a la población salvadoreña.
- `semantic_examples` siempre usa `exhaustive: false`; sus `facts` no contienen prevalencias inferidas del top-k.
- Las explicaciones genéricas sin evidencia pueden tener `evidenceIds: []`, pero ninguna afirmación sobre cifras o patrones de la muestra.
- Si LFM3 local no está disponible y hay hechos seguros ya calculados, puede devolverse tabla y advertencia `AI_NARRATIVE_UNAVAILABLE`; si no, error 503.
- No devolver conteos sensibles por medio de `facts`, etiquetas, textos o tamaños de tabla.

Ejemplo de entrada:

```json
{
  "question": "¿Cómo se comparan los ingresos de Santa Ana y San Salvador?",
  "filters": { "income": { "min": 200 } },
  "history": []
}
```

Ejemplo de salida mínima sin datos reales:

```json
{
  "data": {
    "status": "needs_clarification",
    "blocks": [
      {
        "type": "text",
        "text": "¿Deseas comparar el promedio, la mediana o ambos indicadores de ingresos estimados?",
        "evidenceIds": []
      }
    ],
    "evidence": [],
    "toolsUsed": []
  },
  "meta": {
    "requestId": "example-synthetic-002",
    "datasetId": "sv-sample",
    "datasetVersion": "fixture-v1",
    "generatedAt": "2026-11-21T00:00:00Z",
    "appliedFilters": { "income": { "min": 200 } },
    "sampleSize": null,
    "warnings": [
      { "code": "ESTIMATED_INCOME", "message": "Ingresos estimados; período no documentado." }
    ]
  }
}
```

Los fixtures de I-01 deben añadir un caso respondido con tabla/gráfico, uno sin resultados y uno de abstención semántica, todos comprobables.

## 7. Reportes PDF

### `POST /api/reports/pdf`

```ts
type ReportRequest = {
  filters?: Filters; // omitir departamentos = alcance de toda la muestra
  indicators: (
    | "sample_count" | "income_mean" | "income_median"
    | "financial_exclusion_pct"
  )[]; // 1–4, únicos
  sections: (
    | "summary" | "education" | "occupation" | "goals" | "ai_analysis"
  )[]; // 1–5, únicas
};
```

Ejemplo de cuerpo:

```json
{
  "filters": { "departmentIds": ["santa-ana"], "income": { "min": 200 } },
  "indicators": ["sample_count", "income_mean"],
  "sections": ["summary", "education", "ai_analysis"]
}
```

Departamentos seleccionados en `filters.departmentIds`: 1–14 si se incluyen. El informe siempre incluye título automático, fecha de generación, versión/fuente, filtros, denominadores, advertencias y limitaciones; esas partes no pueden desactivarse.

No se aceptan HTML, SVG, imágenes, cifras calculadas ni URLs del cliente. La UI ofrece resumen de configuración antes de descargar, no un editor o un historial de informes.

Respuesta exitosa:

```text
HTTP 200
Content-Type: application/pdf
Content-Disposition: attachment; filename="impactatlas-reporte.pdf"
Cache-Control: no-store
X-Request-Id: <identificador>
```

- PDF generado íntegramente en servidor desde una instantánea de agregados.
- ECharts SSR produce gráficos SVG confiables; Chromium imprime una plantilla fija con texto escapado, sin recursos remotos.
- No PDF parcial con estado 200: generar y validar el documento antes de enviar cabeceras.
- Si falla solo la narrativa, generar documento estadístico con aviso visible. Si falla consulta o render, devolver error JSON, no un archivo corrupto.
- Sin persistencia: el navegador descarga el binario; no se necesita endpoint de estado ni tabla de trabajos.
- Objetivo inicial: hasta 20 páginas y 10 MB; rechazar configuración que exceda límites, no truncar datos silenciosamente.

## 8. Salud y errores

### `GET /api/health`

`200 {"status":"ok"}` si aplicación y consulta mínima de lectura a BD funcionan; `503 {"status":"unavailable"}` en caso contrario. Timeout corto. No exponer host, versión, SQL, secretos ni conteo de registros. La disponibilidad/carga del modelo LFM3 local se comprueba durante smoke tests, no en cada health check.

### Error común

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El rango de ingresos no es válido.",
    "fields": { "filters.income": "min debe ser menor o igual que max" }
  },
  "requestId": "example-synthetic-error"
}
```

| HTTP | Código | Uso |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | JSON inválido, parámetros, filtros o contrato incorrectos. |
| 401/403 | `UNAUTHORIZED` / `FORBIDDEN` | Acceso denegado por el control elegido para el piloto. |
| 413 | `PAYLOAD_TOO_LARGE` | Cuerpo mayor al permitido. |
| 422 | `REPORT_LIMIT_EXCEEDED` | Configuración válida pero documento fuera de límites. |
| 429 | `RATE_LIMITED` / `BUSY` | Límite por cliente o concurrencia; `Retry-After`. |
| 503 | `DEPENDENCY_UNAVAILABLE` | PostgreSQL/modelo LFM3 local/renderizador no disponible. |
| 504 | `TIME_BUDGET_EXCEEDED` | Presupuesto global agotado. |
| 500 | `INTERNAL_ERROR` | Fallo inesperado sin detalles internos. |

Sin coincidencias es 200, no 404. Pregunta ambigua o sin evidencia es 200 con estado del chat, no error técnico.

### Límites iniciales operativos

| Recurso | Límite inicial |
| --- | --- |
| Cuerpo JSON | 64 KiB, comprobado en proxy y servidor, incluso sin `Content-Length`. |
| Consulta SQL | `statement_timeout` de 5 s; timeout transaccional/limpieza comprobados. |
| Estadísticas/comparador | Presupuesto de petición de 15 s. |
| Chat | Presupuesto total de 90 s, incluyendo herramientas e inferencia LFM3 local; máximo 4 herramientas. Timeout interno LFM3 de 75 s para reservar margen al cierre de la solicitud; configurar el proxy/gateway por encima de 90 s (recomendado ≥120 s). |
| Reporte | Presupuesto total de 90 s; proxy al menos 120 s. |
| Concurrencia inicial por instancia | 1 PDF, 2 chats; rechazar exceso con 429, sin cola. |
| Rate limit por identidad/IP confiable | 60 consultas analíticas/min, 10 chats/min, 2 PDF/min; calibrar en piloto. |

Los presupuestos no son promesas de rendimiento. Los objetivos p95 están en [calidad](./06-calidad-despliegue-y-riesgos.md). Abortos deben cancelar trabajo y liberar conexión/proceso, no limitarse a dejar de esperar la respuesta.

## 9. Checklist de aprobación de contrato — I-01

- [ ] IDs departamentales y correspondencias de categorías acordados.
- [ ] Unidades, período de ingresos y denominadores documentados.
- [ ] Validaciones, política de nulos y supresión aprobadas.
- [ ] Ejemplos sintéticos acordados para éxito, vacío, supresión, error y chat respaldado; su materialización ejecutable corresponde después a D1-03.
- [ ] Dev 1 puede dibujar las cuatro funcionalidades sin depender de endpoints reales.
- [ ] Dev 2 puede implementar los endpoints sin deducir campos desde componentes.
- [ ] Acuerdo de cambios: actualizar contrato, fixtures y consumidor/servidor afectados en la misma PR.
