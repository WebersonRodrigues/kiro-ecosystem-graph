# Documento de Requisitos

## Introdução

Este documento especifica os requisitos para adicionar um modo de visualização 3D ao Kiro Ecosystem Graph. O modo 3D é uma funcionalidade opcional que coexiste com o modo 2D existente, permitindo ao usuário alternar entre as duas visualizações. A renderização 3D utiliza a biblioteca `3d-force-graph` (WebGL/Three.js) do mesmo autor da biblioteca 2D atual (`force-graph`), garantindo compatibilidade de API e comportamento consistente.

## Glossário

- **Grafo**: Estrutura de dados composta por nós (nodes) e arestas (links) representando o ecossistema cognitivo Kiro
- **Modo_de_Renderização**: Configuração que determina se o grafo é exibido em 2D (canvas) ou 3D (WebGL/Three.js)
- **Painel_de_Configurações**: Interface lateral direita que contém controles de ajuste do grafo (forças, exibição, filtros)
- **Instância_do_Grafo**: Objeto da biblioteca force-graph (2D) ou 3d-force-graph (3D) que gerencia a simulação e renderização
- **Controles_Orbitais**: Mecanismo de navegação 3D que permite rotação (orbit), zoom e deslocamento (pan) da câmera
- **Camada_de_Dados**: Estrutura compartilhada contendo nós, arestas, graus, pesos e filtros — independente do modo de renderização
- **Estética_Neural**: Estilo visual do grafo com efeitos de brilho (glow), cores por tipo de nó, partículas nas arestas e formas geométricas diferenciadas
- **Webview**: Painel VS Code que hospeda o conteúdo HTML/JS/CSS da extensão

## Requisitos

### Requisito 1: Alternância entre Modos 2D e 3D

**User Story:** Como desenvolvedor usando o Ecosystem Graph, eu quero alternar entre visualização 2D e 3D no painel de configurações, para que eu possa explorar meu ecossistema cognitivo com profundidade espacial quando desejado.

#### Critérios de Aceitação

1. THE Painel_de_Configurações SHALL exibir um controle de alternância "Render Mode" com as opções "2D" e "3D", posicionado na seção "Display"
2. WHEN o usuário seleciona o modo "3D", THE Instância_do_Grafo SHALL destruir a instância 2D atual e criar uma nova instância usando a biblioteca `3d-force-graph`
3. WHEN o usuário seleciona o modo "2D", THE Instância_do_Grafo SHALL destruir a instância 3D atual e criar uma nova instância usando a biblioteca `force-graph`
4. THE Modo_de_Renderização SHALL ter "2D" como valor padrão em toda nova sessão
5. WHEN o modo é alternado, THE Camada_de_Dados SHALL preservar o estado atual de nós, arestas, filtros ativos e configurações de força
6. THE Modo_de_Renderização SHALL ser persistido via `vscode.getState()`/`vscode.setState()` para restauração entre sessões

### Requisito 2: Navegação 3D

**User Story:** Como desenvolvedor, eu quero navegar livremente pelo grafo 3D (rotacionar, aproximar, deslocar), para que eu possa observar a estrutura do ecossistema de diferentes ângulos e perspectivas.

#### Critérios de Aceitação

1. WHILE o Modo_de_Renderização está em "3D", THE Controles_Orbitais SHALL permitir rotação ao redor do grafo via arrastar com botão esquerdo do mouse
2. WHILE o Modo_de_Renderização está em "3D", THE Controles_Orbitais SHALL permitir zoom via scroll do mouse
3. WHILE o Modo_de_Renderização está em "3D", THE Controles_Orbitais SHALL permitir deslocamento (pan) via arrastar com botão direito do mouse
4. WHILE o Modo_de_Renderização está em "3D", THE Controles_Orbitais SHALL permitir visualização do grafo de cima, dos lados e de baixo sem restrição angular

### Requisito 3: Estética Visual no Modo 3D

**User Story:** Como desenvolvedor, eu quero que o modo 3D mantenha a estética de rede neural (brilho, cores, formas), para que a experiência visual seja consistente e imersiva em ambos os modos.

#### Critérios de Aceitação

1. WHILE o Modo_de_Renderização está em "3D", THE Instância_do_Grafo SHALL renderizar nós com as mesmas cores definidas no COLOR_MAP por tipo de nó
2. WHILE o Modo_de_Renderização está em "3D", THE Instância_do_Grafo SHALL aplicar efeito de brilho (glow) nos nós utilizando materiais emissivos ou sprites com halo
3. WHILE o Modo_de_Renderização está em "3D", THE Instância_do_Grafo SHALL diferenciar tipos de nó por geometria 3D (esfera para nós comuns, octaedro para steerings, tetraedro para hooks)
4. WHILE o Modo_de_Renderização está em "3D", THE Instância_do_Grafo SHALL renderizar partículas direcionais nas arestas utilizando a API nativa `linkDirectionalParticles` da biblioteca 3d-force-graph
5. WHILE o Modo_de_Renderização está em "3D", THE Instância_do_Grafo SHALL manter o fundo escuro (#0d0d0d) consistente com o modo 2D

### Requisito 4: Compatibilidade de Funcionalidades entre Modos

**User Story:** Como desenvolvedor, eu quero que filtros, tooltips, painel de saúde e estatísticas funcionem em ambos os modos, para que eu não perca funcionalidade ao alternar para 3D.

#### Critérios de Aceitação

1. WHILE o Modo_de_Renderização está em "3D", THE Painel_de_Configurações SHALL aplicar filtros de tipo de nó e configurações de força ao grafo 3D
2. WHEN o usuário passa o mouse sobre um nó no modo 3D, THE Webview SHALL exibir o tooltip com nome, tipo e caminho do nó
3. WHEN o usuário clica em um nó no modo 3D, THE Webview SHALL enviar a mensagem `openFile` para abrir o arquivo correspondente no editor
4. WHILE o Modo_de_Renderização está em "3D", THE Webview SHALL exibir o painel de estatísticas (contagem de nós e arestas) na posição fixa inferior esquerda
5. WHILE o Modo_de_Renderização está em "3D", THE Webview SHALL manter o destaque de propagação (highlight) ao passar o mouse sobre nós e arestas conectadas
6. WHILE o Modo_de_Renderização está em "3D", THE Webview SHALL exibir labels nos nós conforme a configuração de labelMode (on/off/auto)

### Requisito 5: Integração da Biblioteca 3d-force-graph

**User Story:** Como desenvolvedor da extensão, eu quero que a biblioteca `3d-force-graph` seja integrada corretamente ao projeto, para que o modo 3D funcione dentro do webview do VS Code sem conflitos.

#### Critérios de Aceitação

1. THE Webview SHALL carregar a biblioteca `3d-force-graph` como dependência do projeto via npm
2. THE Webview SHALL incluir o script da biblioteca 3d-force-graph no HTML com nonce CSP válido
3. WHEN o modo 3D é ativado, THE Instância_do_Grafo SHALL ser criada no mesmo container DOM (`#graph`) utilizado pelo modo 2D
4. THE Webview SHALL atualizar a Content Security Policy para permitir execução de WebGL (sem bloquear `script-src` ou `worker-src` necessários para Three.js)

### Requisito 6: Performance

**User Story:** Como desenvolvedor, eu quero que o modo 3D tenha performance aceitável para ecossistemas típicos, para que a navegação seja fluida e responsiva.

#### Critérios de Aceitação

1. WHILE o Modo_de_Renderização está em "3D" com até 200 nós e 400 arestas, THE Instância_do_Grafo SHALL manter taxa de quadros acima de 30 FPS durante navegação orbital
2. WHEN o modo é alternado de 2D para 3D, THE Instância_do_Grafo SHALL completar a transição (destruição + recriação) em menos de 2 segundos
3. IF a inicialização do WebGL falhar, THEN THE Webview SHALL exibir mensagem de erro informativa e reverter automaticamente para o modo 2D

### Requisito 7: Configurações de Força no Modo 3D

**User Story:** Como desenvolvedor, eu quero ajustar as forças de simulação (repulsão, distância, centro) no modo 3D, para que eu possa otimizar a disposição espacial dos nós conforme meu ecossistema.

#### Critérios de Aceitação

1. WHILE o Modo_de_Renderização está em "3D", THE Painel_de_Configurações SHALL aplicar o valor de "Center Force" à simulação 3D
2. WHILE o Modo_de_Renderização está em "3D", THE Painel_de_Configurações SHALL aplicar o valor de "Repulsion Force" à simulação 3D
3. WHILE o Modo_de_Renderização está em "3D", THE Painel_de_Configurações SHALL aplicar o valor de "Link Strength" à simulação 3D
4. WHILE o Modo_de_Renderização está em "3D", THE Painel_de_Configurações SHALL aplicar o valor de "Link Distance" à simulação 3D
5. WHEN o usuário ajusta um slider de força no modo 3D, THE Instância_do_Grafo SHALL atualizar a simulação em tempo real sem necessidade de recriar a instância
