# Guia Completo: Como Construir um Ecossistema Cognitivo de IA para Qualquer Projeto

## O que é e por que criar

Um ecossistema cognitivo de IA é um sistema de documentação viva que transforma qualquer modelo de IA conectado ao seu workspace num especialista do seu projeto. Não é um conjunto estático de regras — é um organismo que aprende com cada sessão, acumula conhecimento verificado, e se refina ao longo do tempo.

### Os dois pilares fundamentais: Instrução e Acesso

Antes de pensar em camadas, hooks ou evolução cognitiva, entenda que todo agente de IA se resume a duas coisas — e o ecossistema inteiro existe pra otimizar essas duas coisas:

**1. INSTRUÇÃO** — O quão preciso e específico é o que você diz pro agente fazer

Quanto mais claro, detalhado e contextualizado for o conjunto de instruções (steerings, persona, regras, playbooks), mais assertivo o agente será. Instruções vagas geram respostas vagas. Instruções precisas geram respostas cirúrgicas.

Exemplos de instrução ruim vs boa:
- Ruim: "Siga boas práticas de segurança"
- Boa: "Nunca interpolar variáveis em SQL. Usar sempre parâmetros. Se encontrar SQL sem parâmetros, corrigir antes de continuar qualquer task"

**2. ACESSO** — As ferramentas e fontes de dados que o agente tem disponíveis

Quanto mais acesso correto o agente tem (MCPs pro banco, código-fonte, logs, APIs), menos ele precisa chutar e mais ele pode verificar antes de responder. Acesso errado ou incompleto gera respostas inventadas.

Exemplos de acesso:
- MCP pro banco de dados (consultar estrutura, dados reais)
- MCP pro repositório de código (ler código-fonte de sistemas externos)
- Ferramentas de busca no codebase (grepSearch, readCode)
- Ferramentas de diagnóstico (getDiagnostics, build)

**A fórmula:** `Assertividade do agente = Qualidade da instrução x Acesso às ferramentas certas`

Todo o ecossistema cognitivo é, no fundo, um sistema pra maximizar essas duas variáveis de forma organizada e evolutiva. Os steerings são instrução. Os MCPs e tools são acesso. Os hooks garantem que a instrução é seguida. O auto-aprendizado refina a instrução com o tempo.

### Memória em 3 camadas

O ecossistema cria um sistema de memória gerenciado de forma semi-automática pela IA:

| Tipo de memória | O que é | Como funciona | Exemplo |
|-----------------|---------|---------------|---------|
| **Curto prazo** | Contexto da sessão atual | Steerings carregados automaticamente + conversa em andamento | Agente sabe quem é, conhece as regras, tem o mapa |
| **Médio prazo** | Conhecimento acumulado recente | Steerings atualizados após investigações pesadas (auto-aprendizado) | Problema resolvido ontem já está documentado |
| **Longo prazo** | Base consolidada | Playbooks verificados, problemas conhecidos, regras de negócio | Árvores de decisão que funcionam há meses |

O **auto-aprendizado** é o mecanismo que move conhecimento do curto prazo (descoberto numa sessão) para o médio/longo prazo (documentado nos steerings). Sem ele, o ecossistema fica estático e não evolui.

### O que você ganha

- Qualquer sessão nova do agente começa com contexto completo (zero dependência de memória entre sessões)
- Respostas instantâneas para problemas já resolvidos (sem re-investigar)
- Código entregue seguindo padrões do projeto automaticamente
- Proteção contra erros comuns (hooks de segurança, review automático)
- Evolução mensurável — o sistema fica mais inteligente a cada uso
- Onboarding instantâneo — qualquer dev novo (humano ou IA) entende o projeto em minutos

### Arquitetura em camadas

O ecossistema funciona em 9 camadas complementares:

1. **Identidade e Comportamento** — quem é o agente, como se comporta, workflow de execução
2. **Mapa de Navegação** — onde buscar cada tipo de informação
3. **Conhecimento de Domínio** — entidades, regras de negócio, FAQ, fluxos
4. **Árvores de Decisão** — playbooks verificados para problemas recorrentes
5. **Segurança e Qualidade** — checklist de segurança, padrões de código
6. **Hooks (Automação)** — comportamentos automáticos disparados por eventos
7. **Specs e Implementação** — workflow de desenvolvimento guiado
8. **Skills (Habilidades)** — capacidades ativas que o agente executa sob demanda
9. **Evolução Cognitiva** — mapa de maturidade, auto-aprendizado, métricas

---

## Estrutura de Pastas

```
.kiro/
  steering/           ← Documentos de conhecimento e comportamento
  hooks/              ← Automações disparadas por eventos
  skills/             ← Habilidades especializadas do agente (ativadas sob demanda)
  specs/              ← Especificações de features/bugs
  settings/           ← Configurações (MCP servers, etc.)
```

### Convenção de Nomenclatura dos Steerings

Os nomes dos steerings ficam a critério de cada time/projeto. A recomendação é usar nomes claros, objetivos e consistentes. Escolha um padrão de prefixos/sufixos e mantenha em todo o ecossistema.

**Sufixos sugeridos:**

| Sufixo | Uso |
|--------|-----|
| `*-domain` | Conhecimento de domínio, entidades, glossário |
| `*-standards` | Padrões obrigatórios do projeto (regras absolutas, identidade) |
| `*-conventions` | Convenções de código, escrita, nomenclatura |
| `*-policies` | Políticas de segurança, deploy, governança, acesso |
| `*-flow` | Fluxos de negócio ou trabalho documentados |
| `*-playbook` | Árvores de decisão verificadas |
| `*-guide` | Guias, FAQ, tutoriais, referência rápida |
| `*-troubleshooting` | Problemas conhecidos e soluções |
| `*-evolution` | Mapa de maturidade e estratégia de evolução |

**Exemplos de nomes usando esses sufixos:**

```
agent-persona.md              ← Identidade e workflow (standards)
project-standards.md          ← Regras absolutas do projeto
code-conventions.md           ← Padrões de código
security-policies.md          ← Políticas de segurança
orders-flow.md                ← Fluxo de pedidos
sync-flow.md                  ← Fluxo de sincronização
auth-flow.md                  ← Fluxo de autenticação
entities-domain.md            ← Entidades e relacionamentos
business-rules-domain.md      ← Regras de negócio
api-guide.md                  ← Referência de endpoints
faq-guide.md                  ← Perguntas frequentes
known-issues-troubleshooting.md  ← Problemas conhecidos
decision-playbook.md          ← Árvores de decisão
cognitive-evolution.md        ← Mapa de maturidade
```

**Princípio:** o nome deve ser autoexplicativo. Qualquer pessoa (ou agente) que leia o nome do arquivo deve entender imediatamente o que ele contém, sem precisar abrir.


### Tipos de Carregamento (front-matter)

Cada steering tem um front-matter YAML que define quando ele é carregado no contexto:

```yaml
---
inclusion: always          # Carrega em TODA sessão (use com parcimônia — consome contexto)
---
```

```yaml
---
inclusion: auto            # Carrega quando a pergunta do usuário bate com a description
description: Texto que descreve quando este steering deve ser ativado
---
```

```yaml
---
inclusion: fileMatch       # Carrega quando um arquivo matching está aberto/sendo lido
fileMatchPattern: "**/*.py,**/auth/**,**/login/**"
description: Texto descritivo
---
```

```yaml
---
inclusion: manual          # Carrega apenas quando o usuário pede explicitamente via #nome
---
```

**Regra de ouro:** steerings `always` devem ser enxutos (< 350 linhas). O conjunto total de steerings carregados numa sessão não deve ultrapassar 60% da janela de tokens do modelo — acima disso, o agente perde qualidade e precisão nas respostas. Quanto mais steerings always, mais contexto consumido em toda sessão. Use `auto` e `fileMatch` para conhecimento específico, carregando apenas o que é relevante pro momento.

---

## CAMADA 1: Identidade e Comportamento (agent-persona.md)

Este é o steering mais importante. Define QUEM é o agente e COMO ele se comporta. Deve ser `always`.

### Estrutura recomendada

```markdown
---
inclusion: always
---
# [NOME DO AGENTE] — Workflow de Execução Autônoma

## Quem sou eu

[Descrição da persona: nome, papel no time, stack que domina]

Personalidade:
- [Traços de personalidade — profissional mas acessível]
- [Como lida com frustração do usuário]
- [Nível de formalidade]

Como falo:
- [Idioma e estilo — informal técnico, direto, sem enrolação]
- [O que NUNCA fazer na comunicação]

## Padrão de resposta

[Definir que respostas devem ser ESPECÍFICAS e ACIONÁVEIS, nunca genéricas]

Para BUGS: ONDE + O QUE + POR QUE + COMO CORRIGIR + IMPACTO
Para FEATURES: O QUE + ONDE + COMO + POR QUE + DEPENDÊNCIAS
Para DÚVIDAS: Fatos verificados + trecho de código + query/resultado

## Workflow de execução autônoma

1. ENTENDER → Consultar steerings primeiro, código depois
2. INVESTIGAR → Playbooks e problemas conhecidos antes de mergulhar no código
3. IMPLEMENTAR → Código completo, funcional, seguindo padrões
4. VALIDAR → Diagnostics em todos os arquivos modificados
5. SELF-REVIEW → 3 perspectivas (Engenheiro, Segurança, QA)
6. VERIFICAR FUNCIONAMENTO → Confirmar que funciona, não só que compila
7. ENTREGAR → Reportar conciso + lembrar de testar

## Onde buscar informação

[Tabela mapeando: "Preciso de X" → "Uso Y automaticamente"]

## Regras de autonomia

SEGUIR SOZINHO:
- [Lista do que pode fazer sem perguntar]

PARAR E PERGUNTAR:
- [Lista do que exige confirmação]

## Armadilhas conhecidas

[Lista de erros comuns do projeto que o agente NUNCA deve cometer]
```

### Exemplo prático (genérico)

```markdown
## Dev IA — Quem sou eu

Sou o Dev IA, desenvolvedor sênior do time. Domino [suas tecnologias].
Estou ativo em toda sessão, em todo contexto.

Personalidade:
- Profissional mas acessível — sei a hora de focar e a hora de descontrair
- Confiante sem ser arrogante — sei o que sei, admito o que não sei
- Prático — prefiro resolver do que teorizar

Como falo:
- Português informal, como conversa entre devs
- Direto ao ponto, sem enrolação
- Nunca uso emojis — profissionalismo acima de tudo
- Dou a resposta primeiro, contexto depois

## Padrão de resposta

Nunca dou respostas vagas tipo "pode ser um problema no service" ou "verifique o arquivo X".
Toda resposta é ESPECÍFICA e ACIONÁVEL. O usuário não pode ficar com dúvida.

Regra de ouro: o usuário deve sair da conversa sabendo EXATAMENTE o que fazer.
```


---

## CAMADA 2: Regras Críticas (regras-criticas.md)

Regras absolutas que NUNCA podem ser violadas. Deve ser `always`. Enxuto e direto.

### O que incluir

```markdown
---
inclusion: always
---
# Regras Críticas de Comportamento

## Identidade — Regra Absoluta
[Nome do agente, nunca se apresentar como outro nome]

## Prioridade de Resposta (decision tree)
[Antes de ler código, verificar se a resposta já está nos steerings]

1. Pergunta conceitual → steering X
2. Pergunta sobre endpoint → steering Y
3. Pergunta sobre fluxo → steering Z
...
9. Pergunta sobre código específico → aí sim ler o arquivo

Regra: só ir pro código quando o steering não tem a resposta.

## Nunca inventar informação
- Código-fonte: ler o arquivo antes de afirmar
- Banco de dados: consultar via MCP antes de dizer o que existe
- Se não conseguir verificar: avisar o usuário

## Fatos Críticos do Projeto
[Lista de coisas que o agente NUNCA pode errar — autenticação, formato de endpoints, etc.]

## Ferramentas de Verificação
[Lista de MCPs e ferramentas disponíveis com descrição do que cada uma faz]
```

### Dica importante

A decision tree de prioridade de resposta é o que evita o agente gastar tempo lendo código quando a resposta já está documentada. Quanto mais completa essa árvore, mais rápido o agente responde.

---

## CAMADA 3: Mapa de Navegação (flow-ecossistema.md)

O "GPS" do sistema. Dado qualquer pergunta, o agente sabe onde buscar. Deve ser `always`.

### Estrutura recomendada

```markdown
---
inclusion: always
---
# Ecossistema [Projeto] — Mapa de Navegação

## Visão Geral
[Descrição em 2-3 linhas do que o projeto faz]

## Arquitetura
[Diagrama ASCII simples mostrando os componentes e como se conectam]

## Onde buscar cada informação

### Dúvida sobre [Módulo A]
- Código: ler arquivos em `caminho/`
- Steerings específicos: `steering-x.md`

### Dúvida sobre [Módulo B]
- Código: ler arquivos em `caminho/`
- MCP: usar `nome-do-mcp`

[Repetir para cada módulo/camada do projeto]

## Steerings Disponíveis

### Sempre carregados (always)
- `arquivo.md` — descrição curta

### Carregados por contexto (auto)
- `arquivo.md` — descrição curta

### Carregados por arquivo (fileMatch)
- `arquivo.md` — quando ativa

### Manuais
- `arquivo.md` — descrição curta

## Hooks ativos
- `hook-name` — o que faz (trigger)
```

### Dica

Este arquivo é o índice do ecossistema. Quando criar um steering novo, SEMPRE atualizar este mapa. Se o mapa não reflete a realidade, o agente se perde.


---

## CAMADA 4: Conhecimento de Domínio

Steerings que documentam o conhecimento real do projeto. Use `auto` ou `fileMatch`.

### 4.1 Domínio e Entidades (help-dominio.md)

```markdown
---
inclusion: auto
description: Entidades do projeto, campos-chave, relacionamentos. Usar quando a pergunta for sobre o que é uma entidade ou como se relaciona.
---
# Glossário de Entidades

## [Entidade A]
- O que é: [descrição de negócio]
- Tabela: [nome no banco]
- Campos-chave: [lista dos campos importantes com tipo e descrição]
- Relacionamentos: [com quem se relaciona e como]
- Endpoint: [rota da API, se houver]

## [Entidade B]
[mesmo formato]
```

### 4.2 Regras de Negócio (help-regras-negocio.md)

```markdown
---
inclusion: auto
description: Regras de negócio do projeto. Usar quando a pergunta envolver lógica de negócio, validações, status, fluxos.
---
# Regras de Negócio

## [Área A — ex: Descontos]
- Regra 1: [descrição clara]
- Regra 2: [descrição clara]
- Onde é validado: [arquivo/camada]
- Armadilha: [algo que parece óbvio mas não é]

## [Área B — ex: Status de Pedido]
| Status | Significado | Quem seta | Próximo status possível |
|--------|-------------|-----------|------------------------|
| P | Pendente | App | T |
| T | Transmitido | App (sync) | I, R, X |
[...]
```

### 4.3 FAQ Rápido (help-faq.md)

```markdown
---
inclusion: auto
description: Respostas rápidas sobre autenticação, banco, deploy, erros conhecidos. Usar quando a pergunta for sobre como funciona algo ou problemas conhecidos.
---
# FAQ — [Projeto]

## Autenticação
- Como autenticar na API? [resposta direta]
- Qual header usar? [resposta direta]

## Banco de Dados
- Como acessar o banco de produção? [resposta]
- Como funciona o multi-tenancy? [resposta]

## Deploy
- Como fazer deploy? [resposta]
- Como rollback? [resposta]

## Erros Conhecidos
- Erro X: [causa e solução]
```

### 4.4 Fluxos de Negócio (flow-*.md)

```markdown
---
inclusion: auto
description: Fluxo completo de [nome do fluxo]. Usar quando investigar problemas que cruzam múltiplas camadas.
---
# Fluxo: [Nome]

## Visão geral
[Diagrama ou descrição do fluxo ponta a ponta]

## Passo a passo
1. [Componente A] faz [ação] → resultado
2. [Componente B] recebe e faz [ação] → resultado
3. [...]

## Campos críticos
[Campos que precisam existir/estar corretos para o fluxo funcionar]

## Armadilhas
[Coisas que podem dar errado e não são óbvias]

## Troubleshooting
[Se o fluxo falhar em cada ponto, o que verificar]
```

### 4.5 Endpoints da API (help-endpoints-api.md)

```markdown
---
inclusion: fileMatch
fileMatchPattern: "**/urls.py,**/views.py,**/serializers.py,**/routes/**"
description: Referência de endpoints da API.
---
# Endpoints

## [Módulo A]
| Método | Rota | Descrição | Auth | Observações |
|--------|------|-----------|------|-------------|
| GET | /entidades/ | Lista | Key | Paginado |
| POST | /entidades/ | Cria | Key | Validação X |
[...]
```


---

## CAMADA 5: Problemas Conhecidos e Playbooks

### 5.1 Base de Problemas Conhecidos (help-problemas-conhecidos.md)

A base de conhecimento mais valiosa do ecossistema. Cada problema resolvido que pode se repetir vai aqui.

```markdown
---
inclusion: auto
description: Problemas conhecidos e soluções. Usar quando investigar qualquer problema reportado.
---
# Problemas Conhecidos e Soluções

Formato de cada entrada:
- Sintoma: o que o usuário/suporte reporta
- Causa: causa raiz real (não sintoma)
- Diagnóstico: como confirmar (query, comando, verificação)
- Solução: passo a passo pra resolver
- Prevenção: o que foi feito pra evitar recorrência
- Caso real: referência de onde aconteceu

## [Categoria A — ex: Sincronização]

### [Nome do problema]
- Sintoma: [o que o usuário vê]
- Causa: [o que realmente acontece]
- Diagnóstico: [query SQL ou comando pra confirmar]
- Solução: [passo a passo]
- Caso real: [cliente/data]

## Padrões recorrentes

| Padrão | Descrição | Onde verificar |
|--------|-----------|----------------|
| [Nome] | [Descrição curta] | [Como identificar] |
```

### 5.2 Playbooks de Decisão (playbooks.md)

Árvores de decisão verificadas. O agente consulta ANTES de investigar qualquer problema.

```markdown
---
inclusion: auto
description: Árvores de decisão verificadas. Consultar ANTES de investigar problemas.
---
# Playbooks de Decisão

## CHECKLIST-000: Investigação rápida (rodar ANTES de qualquer playbook)

```
1. Problema já conhecido?
   → Consultar help-problemas-conhecidos.md
   → Se encontrar: usar solução documentada

2. [Verificação rápida 2]
   → [Como verificar]
   → [O que fazer se positivo]

3. [Verificação rápida 3]
   → [Como verificar]
```

## [TIPO]-001: [Nome do problema]

```
1. [Primeira pergunta de triagem]
   → [Se sim]: [ação]
   → [Se não]: próximo passo

2. [Segunda pergunta]
   → [Verificação com query/comando]
   → [Ação baseada no resultado]

3. [Terceira pergunta]
   → [...]
```
```

**Regra fundamental:** playbooks são adicionados APENAS quando um problema real é resolvido e a árvore de decisão é validada. Nunca adicionar playbook genérico ou teórico.

---

## CAMADA 6: Segurança e Qualidade

### 6.1 Políticas de Segurança (security-policies.md)

```markdown
---
inclusion: fileMatch
fileMatchPattern: "**/*.{py,ts,js,dart,cs,go}"
description: Checklist de segurança aplicável a todo código produzido.
---
# Desenvolvimento Seguro

## Checklist antes de entregar qualquer código

- [ ] Zero secrets hardcoded
- [ ] Inputs validados (tipo, tamanho, formato)
- [ ] Queries parametrizadas (nunca interpolar variáveis)
- [ ] Mensagens de erro genéricas pro cliente, detalhes só no log
- [ ] Zero dados sensíveis em logs
- [ ] Autenticação verificada nas rotas
- [ ] Autorização por perfil

## Secrets e variáveis de ambiente
[Como gerenciar por stack — env vars, secrets manager, etc.]

## Validação de input
[Regras específicas do projeto]

## Queries SQL
[Exemplos de CORRETO vs ERRADO para cada stack]

## Tratamento de erros
[Padrão do projeto]

## Protocolo de resposta a incidentes
[O que fazer se encontrar problema de segurança durante implementação]
```

### 6.2 Convenções de Código (code-conventions.md)

```markdown
---
inclusion: always
---
# Padrões de Código

## Princípios
- KISS, DRY, Clean Code, SOLID
- Todo código entregue DEVE compilar/rodar sem erros
- Nada de código incompleto, placeholder ou TODO

## Stack por Módulo
[Listar stack de cada módulo — evita o agente misturar tecnologias]

## Idioma
[Definir idioma do código, logs, documentação, comunicação]

## O que NUNCA fazer
[Lista de proibições explícitas]
```


---

## CAMADA 7: Hooks — Automação Comportamental

Hooks são automações que disparam em eventos específicos. Criam um "sistema nervoso" pro agente.

### Hooks essenciais recomendados

| Hook | Trigger | Propósito |
|------|---------|-----------|
| Auto-aprendizado | agentStop | Avalia se descobriu conhecimento novo, sugere documentar |
| Code review | postToolUse:write | Self-review automático após cada escrita de código |
| Checklist pós-task | postTaskExecution | Verifica qualidade após cada task de spec |
| Proteção DML | preToolUse | Intercepta escrita no banco, exige confirmação |
| Auditoria | userTriggered | Audita saúde do ecossistema periodicamente |

### 7.1 Hook de Auto-Aprendizado

O mais importante. Fecha o ciclo de evolução do ecossistema.

```json
{
  "enabled": true,
  "name": "Auto-Aprendizado",
  "description": "Ao final de cada execução, avalia se descobriu conhecimento novo e sugere documentar.",
  "version": "1",
  "when": {
    "type": "agentStop"
  },
  "then": {
    "type": "askAgent",
    "prompt": "Avalie a conversa que acabou. Duas avaliações:\n\n1. AUTO-APRENDIZADO\nSó sugira documentar se a investigação foi REALMENTE pesada (8+ interações de investigação, ou descobriu regra/armadilha não documentada).\nInvestigações normais (3-5 arquivos) são rotina — NÃO sugerir.\nSe sugerir: apresentar dados reais, indicar qual steering, sugerir trecho exato, pedir autorização.\nNUNCA criar/atualizar steering sem autorização.\n\n2. AVALIAÇÃO DE MATURIDADE\nSe a interação envolveu uma área do mapa de maturidade, avaliar se o nível deve subir.\nSe nenhuma área mudou: silêncio."
  }
}
```

### 7.2 Hook de Code Review Automático (Self-Review)

O self-review é um code review automático que a própria IA faz do seu próprio código (ou do código gerado por sub-agentes quando delega tarefas). Funciona como uma camada de qualidade ANTES da revisão humana, reduzindo drasticamente a chance de erros chegarem ao dev.

Como funciona:
- Após CADA escrita de arquivo, o hook dispara automaticamente
- O agente revisa o que acabou de escrever sob 3 perspectivas diferentes
- Se encontrar problema: corrige imediatamente, sem esperar o dev apontar
- Se tudo ok: segue em silêncio (não polui a conversa)

Isso significa que quando o dev recebe o código pra revisar, ele já passou por um filtro automático de engenharia, segurança e QA. A revisão humana pode focar em lógica de negócio e decisões de arquitetura, não em erros básicos.

```json
{
  "enabled": true,
  "name": "Code Review",
  "description": "Self-review automático após cada escrita de código — 3 perspectivas antes da revisão humana.",
  "version": "1",
  "when": {
    "type": "postToolUse",
    "toolTypes": ["write"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "Acabei de escrever/editar um arquivo. Self-review rápido em 3 perspectivas:\n\n1. ENGENHEIRO: código segue os padrões do projeto? Tem duplicação? Imports corretos? Nomes adequados?\n2. SEGURANÇA: secrets hardcoded? SQL sem parâmetros? Dados sensíveis em log? Rota sem auth?\n3. QA: e se input for null/vazio? E se API/banco falhar? Tratamento de erros completo? Edge cases cobertos?\n\nSe encontrar problema: corrigir AGORA antes de continuar.\nSe tudo ok: seguir em silêncio, sem reportar que fez review.\n\nEste review se aplica tanto ao código que EU escrevi quanto ao código gerado por sub-agentes que eu deleguei."
  }
}
```

**Por que 3 perspectivas?**
- Engenheiro pega: código duplicado, imports errados, nomes ruins, padrões violados
- Segurança pega: secrets expostos, SQL injection, dados sensíveis em log, rotas abertas
- QA pega: null pointer, timeout não tratado, erro silencioso, edge case ignorado

Cada perspectiva pega um tipo diferente de problema. Juntas, cobrem a maioria dos erros que passariam despercebidos.

### 7.3 Hook de Proteção DML (escrita no banco)

```json
{
  "enabled": true,
  "name": "Proteção DML",
  "description": "Intercepta escrita no banco e exige confirmação explícita.",
  "version": "1",
  "when": {
    "type": "preToolUse",
    "toolTypes": [".*execute_dml.*", ".*executar_consulta.*"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "ATENÇÃO: Operação de ESCRITA no banco.\n1. MOSTRAR a query completa ao usuário\n2. EXPLICAR o que faz e quantos registros afeta\n3. IDENTIFICAR o risco (tabela crítica?)\n4. IDENTIFICAR o banco alvo (produção?)\n5. AGUARDAR confirmação explícita\nSe não confirmar: cancelar. NUNCA executar DML silenciosamente."
  }
}
```

### 7.4 Hook de Checklist Pós-Task

```json
{
  "enabled": true,
  "name": "Checklist Pós-Task",
  "description": "Verifica qualidade após cada task de spec.",
  "version": "1",
  "when": {
    "type": "postTaskExecution"
  },
  "then": {
    "type": "askAgent",
    "prompt": "Checklist obrigatório antes de marcar task como concluída:\n1. Rodei getDiagnostics em TODOS os arquivos editados?\n2. Testes criados (se exigido)?\n3. Retrocompatibilidade verificada (grepSearch nos usos)?\n4. Steerings consistentes com o que implementei?\n5. Segurança ok?\n6. Padrões de código seguidos?\nSe TODOS passaram: silêncio. Se algum falhou: corrigir AGORA."
  }
}
```

### 7.5 Hook de Auditoria do Ecossistema

```json
{
  "enabled": true,
  "name": "Auditoria de Steerings",
  "description": "Audita saúde do ecossistema: duplicações, inconsistências, tamanho, conteúdo desatualizado.",
  "version": "1",
  "when": {
    "type": "userTriggered"
  },
  "then": {
    "type": "askAgent",
    "prompt": "Auditar ecossistema de steerings:\n1. Inventário (contar por tipo)\n2. Ler todos os steerings\n3. Verificar: duplicações, inconsistências, referências quebradas, tamanho excessivo, conteúdo desatualizado, oportunidades de consolidação\n4. Relatório estruturado\nNunca corrigir sem autorização — apenas sugerir."
  }
}
```


---

## CAMADA 8: Skills — Habilidades Especializadas

Skills são habilidades que você ensina ao agente. Diferente dos steerings (que são conhecimento passivo carregado no contexto), skills são capacidades ativas que o agente pode executar sob demanda quando o usuário solicita ou quando o contexto exige.

### Conceito

Pense assim:
- **Steering** = conhecimento (o agente SABE algo)
- **Skill** = habilidade (o agente SABE FAZER algo)

Uma skill é um conjunto de instruções detalhadas para executar uma tarefa complexa e repetitiva de forma padronizada. O agente ativa a skill quando reconhece que a situação pede aquela habilidade específica.

### Quando criar uma Skill

- Tarefa complexa que se repete com frequência e precisa seguir um padrão específico
- Processo multi-passo que exige uma sequência precisa de ações
- Habilidade que envolve integração com ferramentas externas (APIs, CLIs, serviços)
- Capacidade que precisa de instruções detalhadas demais pra caber num steering

### Quando NÃO criar uma Skill (usar steering)

- Informação de referência (entidades, regras, FAQ) → steering
- Conhecimento passivo que o agente consulta → steering
- Fluxos de negócio documentados → steering (flow-*)
- Padrões de código → steering (code-conventions)

### Estrutura de uma Skill

```
.kiro/
  skills/
    nome-da-skill.md    ← Instruções completas da habilidade
```

### Formato recomendado

```markdown
# Skill: [Nome da Habilidade]

## Quando ativar
[Condições que indicam que esta skill deve ser usada]

## O que faz
[Descrição clara do resultado esperado]

## Passo a passo

### 1. [Primeiro passo]
[Instruções detalhadas, incluindo comandos, queries, ou código]

### 2. [Segundo passo]
[...]

### 3. [Terceiro passo]
[...]

## Regras
- [Regra 1 — o que NUNCA fazer]
- [Regra 2 — o que SEMPRE fazer]
- [Regra 3 — quando parar e perguntar]

## Exemplos
[Exemplo de input → output esperado]
```

### Exemplos de Skills úteis

| Skill | O que faz | Quando ativa |
|-------|-----------|--------------|
| Gerar migration | Cria migration seguindo padrão do projeto, com rollback | Quando precisa alterar schema do banco |
| Criar endpoint CRUD | Gera model + serializer + view + url + testes seguindo padrão | Quando precisa de novo endpoint |
| Gerar parecer técnico | Monta parecer de implementação pra equipe de QA | Quando dev pede parecer |
| Análise de performance | Investiga query lenta com EXPLAIN, sugere índices | Quando reportam lentidão |
| Setup de feature mobile | Cria estrutura de feature Flutter (store + page + widgets) | Quando precisa de feature nova no app |
| Deploy checklist | Executa checklist pré-deploy (migrations, env vars, secrets) | Antes de deploy em produção |
| Onboarding de tenant | Configura novo cliente no sistema (banco + integrador + app) | Quando novo cliente entra |

### Diferença entre Skill, Steering e Hook

| Aspecto | Steering | Skill | Hook |
|---------|----------|-------|------|
| Natureza | Conhecimento passivo | Habilidade ativa | Automação reativa |
| Quando age | Quando carregado no contexto | Quando ativado pelo usuário/contexto | Quando evento dispara |
| Formato | Documentação/referência | Instruções passo a passo | JSON com trigger + ação |
| Exemplo | "Pedidos têm status T, I, R, X" | "Como criar um endpoint CRUD completo" | "Após escrever código, fazer review" |
| Controle | Automático (always/auto/fileMatch) | Sob demanda ou por reconhecimento | Automático por evento |

### Dicas para criar boas Skills

1. **Seja específico** — Uma skill faz UMA coisa bem feita. Não misture responsabilidades.
2. **Inclua exemplos reais** — Mostre input e output esperado do seu projeto.
3. **Defina quando parar** — Se a skill encontrar situação ambígua, deve perguntar ao dev.
4. **Mantenha atualizada** — Se o padrão do projeto mudar, a skill precisa refletir.
5. **Teste antes de confiar** — Execute a skill manualmente uma vez pra validar que o resultado é correto.
6. **Não duplique steerings** — Se a informação é referência, vai no steering. Skill é pra AÇÃO.

---

## CAMADA 9: Evolução Cognitiva

O sistema que faz o ecossistema ficar mais inteligente com o tempo.

### 8.1 Mapa de Maturidade (cognitive-evolution.md)

```markdown
---
inclusion: auto
description: Mapa de maturidade do ecossistema. Usar quando avaliar o que falta documentar.
---
# Evolução Cognitiva

## Objetivo
Construir um sistema cognitivo autônomo que domina todas as regras, fluxos e padrões do projeto.

## Princípios
1. Conhecimento acumulativo — cada interação deixa o sistema mais inteligente
2. Verificação antes de suposição — nunca afirmar sem verificar
3. Autonomia progressiva — mais conhecimento = menos perguntas ao usuário
4. Especificidade — documentar fatos concretos, nunca generalidades

## Escala de Maturidade

| Nível | Peso | Significado |
|-------|------|-------------|
| Alta | 90% | Domino bem. Resposta quase instantânea. |
| Média | 50% | Conheço o básico. Preciso investigar pra completar. |
| Básica | 20% | Sei que existe. Preciso investigar quase tudo. |
| Sem cobertura | 5% | Só sei o nome. |

## Score Geral: [X%]

## Mapa Detalhado

| Área | Steering | Maturidade | Lacunas |
|------|----------|------------|---------|
| [Área A] | [steering] | [nível] | [o que falta] |
| [Área B] | [steering] | [nível] | [o que falta] |

## Critérios pra subir maturidade
- Básica → Média: steering existe E cobre fluxos principais
- Média → Alta: cobre fluxos + armadilhas + troubleshooting + edge cases

## Histórico de Evolução
| Data | Score | O que mudou |
|------|-------|-------------|
```

### 8.2 Regras de Auto-Aprendizado (auto-aprendizado-conventions.md)

```markdown
---
inclusion: fileMatch
fileMatchPattern: "**/.kiro/steering/**,**/.kiro/hooks/**"
description: Regras de quando e como documentar conhecimento.
---
# Auto-Aprendizado

## Quando sugerir documentar

### Trigger 1: Investigação pesada
- 8+ interações de investigação na mesma pergunta
- OU descobriu regra/fluxo crítico não documentado
- OU encontrou armadilha técnica não documentada
- OU encontrou divergência entre steering e código
- OU resolveu bug cuja causa revela padrão repetível

### Trigger 2: Feature implementada
- Padrão novo que precisa ser documentado?
- Steering de navegação precisa ser atualizado?
- Maturidade de alguma área deve subir?

### O que NÃO é trigger
- Investigações pequenas (3-5 arquivos) — rotina
- Refatorações simples
- Correções pontuais sem padrão
- Informação que já existe em algum steering

## Como sugerir
1. NUNCA criar/atualizar sem autorização
2. Apresentar dados reais (quantos arquivos leu, quantas consultas fez)
3. Explicar benefício concreto
4. Deixar o dev decidir — sem pressionar

## Tabela de roteamento — onde colocar cada tipo de informação

| Tipo | Colocar em | NUNCA colocar em |
|------|------------|------------------|
| Regra de negócio | help-regras-negocio ou help-dominio | agent-persona |
| FAQ rápido | help-faq | agent-persona |
| Fluxo documentado | flow-<nome>.md | help-faq |
| Problema conhecido | help-problemas-conhecidos | playbooks |
| Árvore de decisão | playbooks | help-problemas-conhecidos |
| Padrão de código | code-conventions | agent-persona |
| Regra de segurança | security-policies | code-conventions |

Princípio: cada informação tem UM lugar certo. Sem duplicação.

## Validação de duplicação (OBRIGATÓRIO)
1. LER o steering alvo completo
2. Buscar por palavras-chave do que seria adicionado
3. Se encontrar conteúdo similar: NÃO sugerir — silêncio total
4. Se genuinamente novo: prosseguir

## O que NÃO documentar
- Dados que mudam (senhas, configs, tenants)
- Código que muda frequentemente
- Informação que já existe em outro steering
- Investigações rotineiras
```


---

## PASSO A PASSO: Como Montar do Zero

### Fase 1: Fundação (dia 1)

Crie estes 4 arquivos na ordem:

1. **`agent-persona.md`** (always) — Identidade, workflow, autonomia
2. **`regras-criticas.md`** (always) — Regras absolutas, decision tree, fatos críticos
3. **`flow-ecossistema.md`** (always) — Mapa de navegação, arquitetura, onde buscar
4. **`code-conventions.md`** (always) — Padrões de código, stack, proibições

Com esses 4, o agente já sabe quem é, como se comportar, onde buscar informação e como escrever código.

### Fase 2: Conhecimento de Domínio (semana 1)

Crie conforme a necessidade do projeto:

5. **`help-dominio.md`** (auto) — Entidades, campos, relacionamentos
6. **`help-faq.md`** (auto) — Perguntas frequentes, respostas rápidas
7. **`help-regras-negocio.md`** (auto) — Regras de negócio, validações, status

### Fase 3: Fluxos e Segurança (semana 2)

8. **`flow-[principal].md`** (auto/fileMatch) — Fluxo mais importante do projeto
9. **`security-policies.md`** (fileMatch) — Checklist de segurança
10. **`help-problemas-conhecidos.md`** (auto) — Primeiro problema resolvido documentado

### Fase 4: Automação (semana 2-3)

11. **Hook de code review** — Self-review automático
12. **Hook de auto-aprendizado** — Ciclo de evolução
13. **Hook de proteção DML** — Se usa banco via MCP

### Fase 5: Evolução (contínuo)

14. **`cognitive-evolution.md`** (auto) — Mapa de maturidade
15. **`auto-aprendizado-conventions.md`** (fileMatch) — Regras de quando documentar
16. **`playbooks.md`** (auto) — Primeiro playbook após resolver problema real
17. **Hook de auditoria** — Saúde periódica do ecossistema

---

## Dicas Práticas

### 1. Comece pequeno, evolua organicamente

Não tente documentar tudo de uma vez. Comece com os 4 steerings da Fase 1 e deixe o ecossistema crescer naturalmente conforme problemas são resolvidos e conhecimento é descoberto.

### 2. Documente apenas conhecimento VERIFICADO

Nunca documentar suposições, planos futuros ou informação não confirmada. Cada entrada deve ser baseada em código lido, banco consultado ou incidente real resolvido.

### 3. Uma informação, um lugar

O princípio mais importante: cada informação tem UM lugar certo. Outros steerings podem REFERENCIAR ("ver help-regras-negocio") mas nunca DUPLICAR. Duplicação gera inconsistência.

### 4. Steerings always devem ser enxutos

Tudo que é `always` carrega em TODA sessão e consome contexto. Mantenha abaixo de 300 linhas. Se crescer demais, mova para `auto` ou `fileMatch`.

### 5. O hook de auto-aprendizado é o motor da evolução

Sem ele, o ecossistema fica estático. Com ele, cada investigação pesada vira uma sugestão de documentação. O ciclo é: investigação pesada → sugestão → autorização → steering atualizado → próxima vez instantâneo.

### 6. Playbooks só com base em problemas REAIS

Nunca criar playbook genérico ou teórico. Cada árvore de decisão deve ser baseada num problema real que foi resolvido e validado. Isso garante que os playbooks funcionam de verdade.

### 7. Auditoria periódica mantém a saúde

Com o tempo, steerings podem ficar desatualizados, duplicados ou inconsistentes. O hook de auditoria (userTriggered) permite revisar tudo periodicamente e manter o ecossistema saudável.

### 8. Proteja o banco de produção

O hook de proteção DML é uma rede de segurança essencial. Qualquer operação de escrita no banco deve ser mostrada ao usuário e confirmada explicitamente antes de executar.

### 9. Self-review em 3 perspectivas — code review automático da IA

O hook de code review é uma camada de qualidade que roda ANTES da revisão humana. A IA revisa o próprio código (e o de sub-agentes) sob 3 ângulos: engenharia (padrões), segurança (vulnerabilidades) e QA (edge cases). Se encontrar problema, corrige antes de entregar pro dev. Isso reduz drasticamente erros básicos e permite que a revisão humana foque no que importa: lógica de negócio e decisões de arquitetura.

### 10. Meça a evolução

O mapa de maturidade com scores numéricos permite medir o progresso. Quando o score sobe, significa que o agente precisa investigar menos e responde mais rápido. Meta: chegar em 75%+ em todas as áreas críticas.

---

## Ciclos de Evolução

### Ciclo 1: Investigação pesada → Documentação

```
Problema novo → Investigação pesada (8+ interações) → Resposta → 
Hook sugere documentar → Dev autoriza → Steering atualizado → 
Maturidade sobe → Próxima vez: resposta instantânea
```

### Ciclo 2: Feature implementada → Integração no ecossistema

```
Spec concluída → Checklist pós-implementação → 
Padrão novo precisa ser documentado? → Sugestão → Dev autoriza → 
Steering criado/atualizado + navegação atualizada → Maturidade sobe
```

### Ciclo 3: Auditoria → Refinamento

```
Dev dispara auditoria → Agente lê todos os steerings → 
Identifica duplicações/inconsistências/desatualizações → 
Relatório → Dev autoriza correções → Ecossistema mais limpo
```

---

## Erros Comuns a Evitar

1. **Documentar demais cedo demais** — Gera steerings vazios ou com informação não verificada
2. **Steerings always muito grandes** — Consome contexto desnecessariamente
3. **Duplicar informação** — Gera inconsistência quando uma cópia é atualizada e outra não
4. **Playbooks teóricos** — Árvores de decisão não testadas em problemas reais não funcionam
5. **Ignorar o mapa de navegação** — Se o flow-ecossistema não reflete a realidade, o agente se perde
6. **Não usar hooks** — Sem automação, o ecossistema depende da disciplina manual (que falha)
7. **Documentar dados voláteis** — Configs, senhas, contagens que mudam devem ser consultadas via MCP, não documentadas
8. **Esquecer de atualizar steerings de navegação** — Ao criar steering novo, SEMPRE atualizar agent-persona, flow-ecossistema e regras-criticas

---

## Resumo Final

O ecossistema cognitivo é composto por:

- **4 steerings always** (fundação): persona, regras críticas, mapa de navegação, convenções de código
- **N steerings auto/fileMatch** (conhecimento): domínio, regras, FAQ, fluxos, problemas, playbooks, segurança
- **N skills** (habilidades): capacidades ativas que o agente executa sob demanda (gerar migrations, criar endpoints, pareceres, etc.)
- **5-6 hooks** (automação): auto-aprendizado, code review, checklist pós-task, proteção DML, auditoria
- **1 steering de evolução** (meta): mapa de maturidade com scores e histórico

O resultado: um agente que domina seu projeto, responde com assertividade, evolui sozinho, e protege contra erros. Quanto mais o time usa, mais inteligente fica.
