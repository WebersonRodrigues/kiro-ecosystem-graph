# Plano de Implementação: Modo 3D do Ecosystem Graph

## Visão Geral

Implementação incremental do modo de visualização 3D para o Kiro Ecosystem Graph. A abordagem segue a ordem: infraestrutura (dependência + abstração de renderizador), UI de alternância, renderização 3D, paridade de funcionalidades, tratamento de erros e otimização de performance.

## Tarefas

- [ ] 1. Infraestrutura e abstração do renderizador
  - [ ] 1.1 Adicionar dependência `3d-force-graph` ao projeto
    - Adicionar `"3d-force-graph": "^1.73.0"` em `dependencies` no `package.json`
    - Executar install para gerar lock file atualizado
    - _Requisitos: 5.1_

  - [ ] 1.2 Criar `src/webview/media/renderer-manager.js` com interface unificada
    - Implementar objeto `RendererManager` com propriedades `currentMode`, `instance`
    - Implementar `init(container, graphData, settings)` — inicializa com modo salvo ou '2d'
    - Implementar `setMode(mode)` — destrói instância atual, cria nova, retorna Promise<boolean>
    - Implementar `updateData(graphData)` — atualiza dados na instância ativa
    - Implementar `applySetting(key, value)` — aplica configuração de força sem recriar instância
    - Implementar `is3D()` — retorna boolean do modo atual
    - Implementar `destroy()` — destrói instância e libera recursos (dispose de geometrias/materiais em 3D)
    - Implementar flag `isSwitching` para prevenir duplo-click durante transição
    - Persistir `renderMode` via `vscode.getState()`/`setState()`
    - _Requisitos: 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 1.3 Escrever teste de propriedade para round-trip de alternância de modo
    - **Propriedade 1: Round-trip de alternância de modo**
    - **Valida: Requisitos 1.2, 1.3**

  - [ ]* 1.4 Escrever teste de propriedade para preservação de dados na troca de modo
    - **Propriedade 2: Preservação de dados na troca de modo**
    - **Valida: Requisito 1.5**

  - [ ]* 1.5 Escrever teste de propriedade para persistência do modo
    - **Propriedade 3: Round-trip de persistência do modo**
    - **Valida: Requisito 1.6**

- [ ] 2. Refatorar `webview.js` para usar o Renderer Manager
  - [ ] 2.1 Extrair lógica de criação de instância do `webview.js` para o `renderer-manager.js`
    - Substituir chamada direta a `ForceGraph()` por `RendererManager.init()`
    - Substituir chamadas de `graphInstance.graphData()` por `RendererManager.updateData()`
    - Substituir aplicação de forças por `RendererManager.applySetting()`
    - Manter toda a camada de dados (graphData, degreeMap, settings) inalterada
    - _Requisitos: 1.5_

  - [ ] 2.2 Atualizar `webviewProvider.ts` para incluir novos scripts e CSP
    - Gerar URI para `renderer-manager.js` e incluir no HTML como script com nonce
    - Preparar URI para `3d-force-graph` (não incluir no HTML inicial — lazy load)
    - Atualizar CSP: adicionar `blob:` em `img-src` para texturas Three.js
    - Passar nonce e URI do script 3D como data attributes no container para uso no lazy load
    - _Requisitos: 5.2, 5.3, 5.4_

- [ ] 3. Checkpoint — Garantir que o modo 2D continua funcionando
  - Garantir que todos os testes passam, perguntar ao usuário se surgirem dúvidas.
  - O grafo 2D deve funcionar exatamente como antes após a refatoração.

- [ ] 4. Toggle de modo no painel de configurações
  - [ ] 4.1 Adicionar controle "Render Mode" no `settings-panel.js`
    - Criar função `buildRenderModeRow()` com radio buttons "2D" e "3D"
    - Posicionar na seção "Display" do painel
    - Adicionar event listener que chama `RendererManager.setMode()`
    - Restaurar seleção do radio a partir do estado persistido
    - _Requisitos: 1.1, 1.6_

- [ ] 5. Implementação da renderização 3D
  - [ ] 5.1 Criar `src/webview/media/renderer-3d.js` com configuração de nós 3D
    - Implementar `configure3DNodes(instance)` com `nodeThreeObject` callback
    - Mapear tipos para geometrias: OctahedronGeometry (steerings), TetrahedronGeometry (hooks), DodecahedronGeometry (skills), SphereGeometry (padrão)
    - Aplicar MeshLambertMaterial com cores do COLOR_MAP, emissive para efeito glow
    - Escalar nós conforme `getNodeSize(node) * settings.nodeSizeMultiplier`
    - _Requisitos: 3.1, 3.2, 3.3_

  - [ ] 5.2 Implementar labels como billboard sprites no modo 3D
    - Usar SpriteText (bundled com 3d-force-graph) para labels que encaram a câmera
    - Criar THREE.Group com mesh do nó + sprite de texto posicionado acima
    - Respeitar configuração de `labelMode` (on/off/auto com threshold de zoom)
    - _Requisitos: 4.6_

  - [ ] 5.3 Configurar partículas direcionais e fundo escuro no modo 3D
    - Aplicar `linkDirectionalParticles` com configuração similar ao modo 2D
    - Definir background color como `#0d0d0d`
    - Configurar controles orbitais sem restrição angular (rotação livre)
    - _Requisitos: 3.4, 3.5, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 5.4 Escrever teste de propriedade para visuais do nó por tipo
    - **Propriedade 4: Propriedades visuais do nó correspondem ao tipo**
    - **Valida: Requisitos 3.1, 3.2, 3.3**

  - [ ]* 5.5 Escrever teste de propriedade para visibilidade de labels
    - **Propriedade 9: Visibilidade de labels segue labelMode**
    - **Valida: Requisito 4.6**

- [ ] 6. Checkpoint — Validar renderização 3D básica
  - Garantir que todos os testes passam, perguntar ao usuário se surgirem dúvidas.
  - O grafo deve renderizar em 3D com nós diferenciados por geometria e labels visíveis.

- [ ] 7. Paridade de funcionalidades entre modos
  - [ ] 7.1 Implementar filtros de tipo no modo 3D
    - Aplicar mesma lógica de filtragem de `graphData` antes de passar ao renderizador 3D
    - Garantir que filtros do painel de configurações afetam ambos os modos
    - _Requisitos: 4.1_

  - [ ] 7.2 Implementar tooltip no hover para modo 3D
    - Usar raycasting nativo do 3d-force-graph para detectar hover
    - Exibir tooltip com nome, tipo e caminho do nó (CSS overlay ou nodeLabel)
    - _Requisitos: 4.2_

  - [ ] 7.3 Implementar click em nó para abrir arquivo no modo 3D
    - Usar `onNodeClick` callback (API idêntica ao 2D)
    - Disparar mensagem `{ type: 'openFile', filePath: node.path }` via postMessage
    - _Requisitos: 4.3_

  - [ ] 7.4 Implementar highlight de propagação no modo 3D
    - Ao hover em nó, recalcular cores de nós e arestas conectadas (adjacência 1o grau)
    - Usar `nodeColor` e `linkColor` dinâmicos para destacar vizinhos
    - _Requisitos: 4.5_

  - [ ] 7.5 Garantir painel de estatísticas visível no modo 3D
    - Verificar que o overlay HTML de stats (contagem nós/arestas) permanece visível
    - Posição fixa inferior esquerda, independente do modo
    - _Requisitos: 4.4_

  - [ ]* 7.6 Escrever teste de propriedade para aplicação de filtros
    - **Propriedade 5: Aplicação correta de filtros**
    - **Valida: Requisito 4.1**

  - [ ]* 7.7 Escrever teste de propriedade para tooltip
    - **Propriedade 6: Tooltip contém campos obrigatórios**
    - **Valida: Requisito 4.2**

  - [ ]* 7.8 Escrever teste de propriedade para click em nó
    - **Propriedade 7: Click em nó dispara mensagem openFile**
    - **Valida: Requisito 4.3**

  - [ ]* 7.9 Escrever teste de propriedade para highlight
    - **Propriedade 8: Propagação de highlight correta**
    - **Valida: Requisito 4.5**

- [ ] 8. Configurações de força no modo 3D
  - [ ] 8.1 Aplicar configurações de força à simulação 3D em tempo real
    - Mapear sliders existentes (centerForce, repulsionForce, linkForce, linkDistance) para a API `d3Force` do 3d-force-graph
    - Atualizar simulação sem destruir/recriar instância (usar `d3ReheatSimulation()`)
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 8.2 Escrever teste de propriedade para configurações de força
    - **Propriedade 10: Configurações de força aplicadas sem recriar instância**
    - **Valida: Requisitos 7.1, 7.2, 7.3, 7.4, 7.5**

- [ ] 9. Tratamento de erros e fallback
  - [ ] 9.1 Implementar fallback automático para 2D quando WebGL falha
    - Envolver criação de instância 3D em try/catch
    - Se falhar: exibir mensagem informativa ao usuário, reverter para modo 2D
    - Desabilitar opção 3D no radio se WebGL não disponível
    - _Requisitos: 6.3_

  - [ ] 9.2 Implementar lazy loading do script `3d-force-graph`
    - Carregar script apenas quando usuário seleciona 3D pela primeira vez
    - Injetar script tag com nonce CSP válido dinamicamente
    - Tratar `onerror` no script tag — manter 2D e desabilitar opção 3D
    - Cachear flag `is3DLibLoaded` para evitar recarregamento
    - _Requisitos: 5.2, 6.2_

  - [ ] 9.3 Implementar limpeza de memória na destruição de instância 3D
    - Fazer dispose de geometrias, materiais e renderer Three.js ao trocar de modo
    - Tratar evento `webglcontextlost` — pausar renderização e tentar restaurar
    - Validar `renderMode` ao restaurar estado — se inválido, usar '2d'
    - _Requisitos: 6.2_

- [ ] 10. Checkpoint final — Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se surgirem dúvidas.
  - Validar alternância 2D↔3D, filtros, tooltips, click, highlight e fallback.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental entre blocos de funcionalidade
- Testes de propriedade validam invariantes universais usando fast-check (já disponível como devDependency)
- A biblioteca `3d-force-graph` é do mesmo autor da `force-graph` atual, garantindo compatibilidade de API
