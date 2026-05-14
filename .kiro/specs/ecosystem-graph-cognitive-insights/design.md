# Design Document: Ecosystem Graph Cognitive Insights

## Overview

Este design detalha a evolucao do Ecosystem Graph de uma visualizacao de arquivos para um mapa cerebral completo do agente. As 8 features trabalham em conjunto: edges mais ricos entre hooks e steerings (Req 1), descoberta recursiva de skills (Req 2), peso visual de edges (Req 3), tooltips aprimorados para hooks (Req 4), gap detector expandido para skills/hooks (Req 5), legenda de formas (Req 6), painel de analise cognitiva (Req 7), e documentacao filosofica (Req 8).

A arquitetura existente (FileDiscoveryService -> ParserService -> GraphDataStore -> Webview) permanece intacta. As mudancas sao aditivas: novos campos em tipos existentes, novos metodos em servicos existentes, e novos modulos webview independentes.

## Architecture

```mermaid
graph TD
    subgraph Extension Host (TypeScript)
        FDS[FileDiscoveryService] -->|EcosystemFile[]| PS[ParserService]
        PS -->|ParseResult| GDS[GraphDataStore]
        GDS -->|SerializedGraph| WP[WebviewProvider]
    end

    subgraph Webview (Vanilla JS)
        WP -->|postMessage| WV[webview.js]
        WV --> FP[filter-panel.js]
        WV --> HP[health-panel.js]
        WV --> GD[gap-detector.js]
        WV --> VM[visual-modes.js]
        WV --> CAP[cognitive-panel.js - NEW]
        WV --> SL[shape-legend.js - NEW]
    end

    style CAP fill:#2a5,stroke:#4a7
    style SL fill:#2a5,stroke:#4a7
```

### Mudancas por Camada

**Extension Host:**
- `types.ts`: Novo `ReferenceType` value `'hook-implicit'`, novos campos em `GraphNode.metadata` (`whenType`, `description`, `referencedSteerings`)
- `parserService.ts`: Novo metodo `extractImplicitHookEdges()` para toolTypes, patterns.fileMatch, when.type
- `fileDiscoveryService.ts`: Glob pattern `**/.kiro/skills/**/SKILL.md` ja existe; garantir deduplicacao
- `graphDataStore.ts`: Expor edge weight computation (contagem de edges por par source->target)

**Webview:**
- `webview.js`: Edge width proporcional ao weight, tooltip de edge com contagem, tooltip aprimorado para hooks
- `cognitive-panel.js` (NOVO): Painel toggleavel com analise de orfaos, vinculos frageis, arquivos sem contexto, coverage gaps, sugestoes
- `shape-legend.js` (NOVO): Legenda com icones de forma (circulo, diamante, triangulo) + cores

**Documentacao:**
- `tools/ecosystem-graph/docs/PHILOSOPHY.md` (NOVO): Filosofia do grafo em PT-BR

## Components and Interfaces

### 1. ParserService — Implicit Hook Edge Extraction

```typescript
// Novo metodo privado em ParserService
private extractImplicitHookEdges(
  json: Record<string, unknown>,
  file: EcosystemFile,
  knownSteeringFiles: Map<string, string>,
  references: Reference[]
): void;
```

Logica:
1. **toolTypes**: Itera `json.toolTypes[]`, para cada entry verifica se algum steering filename contem o tool type name (case-insensitive match)
2. **patterns.fileMatch**: Itera `json.patterns[].fileMatch` globs, testa contra paths de knownSteeringFiles usando minimatch-like logic
3. **when.type mapping**: Mapeia `fileCreated`/`fileChanged` para steerings com `inclusion: fileMatch`

Deduplicacao: usa um `Set<string>` de target paths ja adicionados (incluindo os do `then.prompt`) para evitar edges duplicados.

### 2. ParserService — Hook Metadata Extraction

```typescript
// Dentro de parseHook(), apos criar o node:
node.metadata = {
  ...node.metadata,
  whenType: whenType,                    // string | undefined
  description: json.description,          // string | undefined
  referencedSteerings: steeringLabels,   // string[] — labels dos steerings referenciados
};
```

### 3. FileDiscoveryService — Deduplicacao

A deduplicacao ja e necessaria porque `**/.kiro/skills/*.md` pode capturar um arquivo que tambem seria capturado por `**/.kiro/skills/**/SKILL.md`. O `discoverAll()` deve usar um `Set<string>` de URIs para evitar duplicatas:

```typescript
// Em discoverAll(), apos coletar todos os resultados:
const seenUris = new Set<string>();
const ecosystemFiles: EcosystemFile[] = [];
for (const { uris, category } of results) {
  for (const uri of uris) {
    if (seenUris.has(uri.fsPath)) continue;
    seenUris.add(uri.fsPath);
    // ... resto da logica existente
  }
}
```

### 4. Webview — Edge Weight Rendering

O `computeEdgeWeights()` ja existe em `webview.js`. A mudanca e na formula de width:

```javascript
// linkCanvasObject:
var weight = link.weight || 1;
var scaledWidth = settings.linkWidth * (1 + Math.log2(weight));
var lineWidth = Math.min(scaledWidth, 5); // cap at 5px
```

### 5. Webview — Enhanced Hook Tooltip

```javascript
// Em showTooltip(), quando node.type === 'hook-manual' || 'hook-auto':
if (node.metadata && node.metadata.whenType) {
  html += '<br><span style="color:#7C4DFF">Trigger: ' + escapeHtml(node.metadata.whenType) + '</span>';
}
if (node.metadata && node.metadata.description) {
  html += '<br><span style="color:#aaa;font-size:9px">' + escapeHtml(node.metadata.description) + '</span>';
}
if (node.metadata && node.metadata.referencedSteerings && node.metadata.referencedSteerings.length > 0) {
  html += '<br><span style="color:#888;font-size:9px">Steerings: ' + 
    node.metadata.referencedSteerings.map(escapeHtml).join(', ') + '</span>';
}
```

### 6. Webview — Edge Hover Tooltip

```javascript
// Novo: tooltip ao hover sobre edge (via linkCanvasObject hit detection)
function showEdgeTooltip(link, event) {
  var weight = link.weight || 1;
  var types = link.types || [link.type]; // array de ReferenceTypes
  var html = '<strong>' + weight + ' reference' + (weight > 1 ? 's' : '') + '</strong>';
  html += '<br><span style="color:#888;font-size:9px">' + types.join(', ') + '</span>';
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  positionTooltip(event);
}
```

### 7. cognitive-panel.js — Cognitive Analysis Panel

```javascript
var CognitivePanel = (function() {
  // Computa:
  // 1. steeringsSoltos: steering nodes com 0 edges in + 0 edges out
  // 2. vinculosFrageis: edges com weight=1 e type='backtick-ref'
  // 3. arquivosSemContexto: nodes com 0 edges total (qualquer tipo)
  // 4. coverageGaps: workspace folders com 0 steering files
  // 5. sugestoes: recomendacoes baseadas nos problemas detectados

  return {
    computeAnalysis: function(graphData, degreeMap, workspaceFolders) { ... },
    updatePanel: function(analysis) { ... },
    toggle: function() { ... }
  };
})();
```

### 8. shape-legend.js — Shape Legend

Renderiza SVG inline para cada forma:
- Circulo: `<svg><circle .../></svg>` — steerings
- Diamante: `<svg><rect transform="rotate(45)" .../></svg>` — skills
- Triangulo: `<svg><polygon .../></svg>` — hooks

### 9. Gap Detector — Skills/Hooks Integration

O gap-detector.js ja opera sobre `graphData.nodes` sem filtrar por tipo. A integracao e automatica porque skills e hooks ja estao em `graphData.nodes`. Nenhuma mudanca de codigo e necessaria no gap-detector.js — a mudanca e garantir que o extension host envia skills/hooks no graphData (ja faz).

Verificacao: confirmar que `computeSuggestedConnections`, `computeDeadZones`, `computeCoverageMap`, e `computeRedundancyPairs` nao filtram por tipo de node. Inspecao do codigo confirma que nao filtram.

## Data Models

### Tipos Atualizados

```typescript
// types.ts — ReferenceType expandido
export type ReferenceType = 
  | 'wiki-link' 
  | 'markdown-link' 
  | 'backtick-ref' 
  | 'table-path'
  | 'hook-implicit';  // NEW: implicit hook-to-steering edge

// types.ts — GraphNode.metadata expandido
export interface GraphNode {
  // ... campos existentes ...
  metadata?: {
    inclusion?: string;
    birthtime?: number;
    mtime?: number;
    lineCount?: number;
    eccentricity?: number;
    // NEW fields for hooks:
    whenType?: string;
    description?: string;
    referencedSteerings?: string[];
  };
}

// types.ts — GraphEdge (sem mudanca, type ja aceita ReferenceType)
```

### Webview Link Model (apos computeEdgeWeights)

```typescript
interface WeightedLink {
  source: string;
  target: string;
  weight: number;        // contagem de edges entre o par
  type: ReferenceType;   // tipo predominante
  types: ReferenceType[]; // todos os tipos presentes
}
```

### Cognitive Analysis Result

```typescript
interface CognitiveAnalysis {
  steeringsSoltos: Array<{ id: string; label: string }>;
  vinculosFrageis: Array<{ source: string; target: string; sourceLabel: string; targetLabel: string }>;
  arquivosSemContexto: Array<{ id: string; label: string; type: string }>;
  coverageGaps: Array<{ folder: string }>;
  sugestoes: string[];
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Implicit hook edges from toolTypes

*For any* hook JSON file containing a `toolTypes` array and *for any* set of known steering files, the Parser_Service should produce an edge of type `'hook-implicit'` from the hook to each steering whose filename contains a matching tool type name (case-insensitive).

**Validates: Requirements 1.1, 1.6**

### Property 2: Implicit hook edges from fileMatch patterns

*For any* hook JSON file containing a `patterns` array with `fileMatch` globs and *for any* set of known steering file paths, the Parser_Service should produce an edge of type `'hook-implicit'` from the hook to each steering whose path matches at least one glob pattern.

**Validates: Requirements 1.2, 1.6**

### Property 3: Prompt edge preservation

*For any* hook JSON file that contains both `then.prompt` references and implicit relationships (toolTypes/patterns), the set of edges produced by prompt extraction should be a subset of the total edges produced by parseHook — implicit extraction must not remove or overwrite prompt edges.

**Validates: Requirements 1.4**

### Property 4: Edge deduplication per hook-steering pair

*For any* hook JSON file that references the same steering via multiple mechanisms (prompt + toolTypes + fileMatch), the resulting edge list should contain at most one edge per unique (source, target) pair.

**Validates: Requirements 1.5**

### Property 5: SKILL.md label from parent folder

*For any* file with path matching `.kiro/skills/{folderName}/SKILL.md`, the Parser_Service should produce a node whose label equals `{folderName}` (the immediate parent directory name).

**Validates: Requirements 2.2**

### Property 6: File discovery deduplication

*For any* set of discovered ecosystem files, the resulting array should contain no duplicate entries (unique by URI/fsPath). A file matching both `**/.kiro/skills/*.md` and `**/.kiro/skills/**/SKILL.md` should appear exactly once.

**Validates: Requirements 2.3**

### Property 7: Edge width formula correctness

*For any* edge weight N >= 1, the computed visual width should equal `min(baseWidth * (1 + log2(N)), 5)`. Specifically: weight 1 produces baseWidth, weight > 1 produces strictly more than baseWidth, and no weight produces more than 5px.

**Validates: Requirements 3.1, 3.3**

### Property 8: Hook tooltip contains all present metadata

*For any* hook node with metadata fields (whenType, description, referencedSteerings), the generated tooltip HTML should contain each present field's value. If a field is absent/undefined, the tooltip should not contain an empty placeholder for that field.

**Validates: Requirements 4.1, 4.2, 4.3, 4.5**

### Property 9: Gap detector includes all node types

*For any* graph data containing nodes of type 'skill', 'hook-manual', or 'hook-auto', the gap detector functions (orphan detection, suggested connections, dead zones, coverage map, redundancy pairs) should include those nodes in their computations — no node type is filtered out.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

### Property 10: Shape legend color matches COLOR_MAP

*For any* node type present in the graph data, the shape legend should render that type's shape icon using the exact color value from COLOR_MAP[type].

**Validates: Requirements 6.4**

### Property 11: Steerings soltos computation

*For any* graph data, the "steerings soltos" list should contain exactly those nodes where `type` starts with `'steering-'` AND the node has zero incoming edges AND zero outgoing edges.

**Validates: Requirements 7.1**

### Property 12: Fragile edges computation

*For any* graph data, the "vinculos frageis" list should contain exactly those (source, target) pairs where the edge weight equals 1 AND the edge type is `'backtick-ref'`.

**Validates: Requirements 7.2**

### Property 13: Context-less files computation

*For any* graph data, the "arquivos sem contexto" list should contain exactly those nodes that have zero total edges (neither as source nor as target in any edge).

**Validates: Requirements 7.3**

### Property 14: Coverage gaps computation

*For any* set of workspace folders and graph data, the "coverage gaps" list should contain exactly those folders that have zero nodes of any steering type (type starting with `'steering-'`).

**Validates: Requirements 7.4**

### Property 15: Suggestions non-empty when issues exist

*For any* cognitive analysis result where at least one of (steeringsSoltos, vinculosFrageis, arquivosSemContexto, coverageGaps) is non-empty, the suggestions array should also be non-empty.

**Validates: Requirements 7.5**

## Error Handling

### ParserService — Invalid Hook JSON

- Se `JSON.parse()` falhar, retornar `null` (comportamento existente preservado)
- Se `toolTypes` nao for array, ignorar silenciosamente (nao criar edges implicitos)
- Se `patterns` nao for array ou entries nao tiverem `fileMatch`, ignorar silenciosamente
- Se glob pattern for invalido (e.g., unclosed bracket), logar warning e pular aquele pattern

### FileDiscoveryService — Deduplicacao

- Se `vscode.workspace.findFiles` retornar erro para um pattern, continuar com os demais (fail-open per pattern)
- Deduplicacao por fsPath garante que mesmo com race conditions no watcher, nenhum arquivo e processado duas vezes

### Webview — Edge Weight

- Se `link.weight` for undefined/null/NaN, tratar como 1 (fallback seguro)
- Se `Math.log2(weight)` produzir NaN (weight <= 0), usar width = baseWidth

### Cognitive Panel — Dados Vazios

- Se `graphData.nodes` estiver vazio, exibir "Nenhum dado disponivel" em vez de listas vazias
- Se `workspaceFolders` nao estiver disponivel, omitir secao "Coverage Gaps"

### Tooltip — Metadata Ausente

- Campos undefined/null sao omitidos do tooltip (nao exibir "undefined" ou placeholders vazios)
- Arrays vazios (`referencedSteerings: []`) sao tratados como ausentes

### Philosophy Documentation

- Se o diretorio `docs/` nao existir, criar antes de escrever o arquivo
- Arquivo e estatico (nao depende de runtime) — sem error handling necessario

## Testing Strategy

### Abordagem Dual: Unit Tests + Property-Based Tests

O projeto usa TypeScript (extension host) e JavaScript (webview). A estrategia de testes combina:

- **Unit tests**: Vitest para TypeScript, com exemplos especificos e edge cases
- **Property-based tests**: fast-check (via Vitest) para propriedades universais

### Biblioteca de Property-Based Testing

- **fast-check** (npm package `fast-check`) — biblioteca PBT para JavaScript/TypeScript
- Integracao nativa com Vitest via `fc.assert(fc.property(...))`
- Minimo 100 iteracoes por property test (configuravel via `numRuns: 100`)

### Configuracao de Tags

Cada property test deve incluir um comentario referenciando a propriedade do design:

```typescript
// Feature: ecosystem-graph-cognitive-insights, Property 1: Implicit hook edges from toolTypes
it('should create hook-implicit edges for toolTypes matches', () => {
  fc.assert(fc.property(
    hookJsonArb, knownSteeringsArb,
    (hookJson, knownSteerings) => { /* ... */ }
  ), { numRuns: 100 });
});
```

### Estrutura de Testes

```
tools/ecosystem-graph/
  src/
    services/__tests__/
      parserService.implicit-hooks.test.ts   — Properties 1-4
      parserService.skill-label.test.ts      — Property 5
      fileDiscoveryService.dedup.test.ts     — Property 6
    webview/__tests__/
      edgeWeight.test.ts                     — Property 7
      hookTooltip.test.ts                    — Property 8
      cognitivePanel.test.ts                 — Properties 11-15
      gapDetector.allTypes.test.ts           — Property 9
      shapeLegend.test.ts                    — Property 10
```

### Unit Tests (exemplos e edge cases)

- Hook JSON sem toolTypes/patterns (nenhum edge implicito criado)
- Hook JSON com JSON invalido (retorna null)
- SKILL.md na raiz de skills/ (usa filename como label, nao parent folder)
- Edge weight = 1 (width = base)
- Edge weight muito alto (width capped at 5px)
- Tooltip para hook sem description (campo omitido)
- Grafo vazio (cognitive panel mostra "sem dados")
- Shape legend com tipos que nao existem no grafo (nao renderiza)

### Property Tests (propriedades universais)

Cada uma das 15 propriedades listadas na secao Correctness Properties sera implementada como um unico test case com `fc.assert()` e minimo 100 iteracoes. Os generators (arbitraries) incluem:

- `hookJsonArb`: gera objetos JSON validos de hook com campos opcionais (toolTypes, patterns, when, then.prompt, description)
- `knownSteeringsArb`: gera Map<string, string> de filenames para paths
- `graphDataArb`: gera {nodes: GraphNode[], links: GraphEdge[]} com tipos variados
- `workspaceFoldersArb`: gera arrays de nomes de folders
- `edgeWeightArb`: gera inteiros >= 1

### Cobertura Esperada

| Requirement | Property Test | Unit Test |
|-------------|--------------|-----------|
| 1 (Hook edges) | P1, P2, P3, P4 | Invalid JSON, empty toolTypes |
| 2 (Recursive skills) | P5, P6 | Root-level skill, watcher event |
| 3 (Edge weight) | P7 | Weight=1, weight=1000 |
| 4 (Hook tooltips) | P8 | Missing fields, empty arrays |
| 5 (Gap detector) | P9 | Empty graph, single-type graph |
| 6 (Shape legend) | P10 | Empty graph, all types present |
| 7 (Cognitive panel) | P11-P15 | Empty graph, fully connected graph |
| 8 (Philosophy doc) | — | File existence check |
