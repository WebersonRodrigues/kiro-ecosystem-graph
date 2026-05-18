# Regras de Análise Cognitiva — Kiro Ecosystem Graph

## O que é isso?

O Kiro Ecosystem Graph analisa a "saúde" do seu ecossistema cognitivo (steerings, hooks, skills) e gera um relatório com problemas e sugestões. Cada regra abaixo é uma validação automática que roda quando você abre o painel de análise ou exporta o relatório.

O objetivo é simples: **quanto mais preciso e bem conectado o ecossistema, mais assertivo e confiável o agente AI se torna.**

---

## Regras Existentes (Base)

### 1. Orphan Steerings (Steerings Órfãos)

**O que verifica:** Steerings com `inclusion: always` (ou sem frontmatter) que possuem zero conexões (nenhuma referência de entrada nem de saída).

**Por que importa:** Um steering órfão always-loaded é invisível para o grafo de navegação do agente. Ele existe no disco mas nunca é alcançado via referências.

**Nota:** Steerings com `inclusion: fileMatch` ou `manual` são excluídos — eles funcionam independentemente de referências cruzadas (carregados pelo seu próprio mecanismo de inclusão).

**Exemplo:**
```
.kiro/steering/flow-geral.md  →  inclusion: always, 0 incoming, 0 outgoing  →  ÓRFÃO
```

**Impacto:** O agente nunca vai navegar até esse arquivo via o grafo de conhecimento.

**Como resolver:** Adicione uma referência a esse steering de outro steering relacionado usando backtick (`` `flow-geral.md` ``).

---

### 2. Fragile Links (Links Frágeis)

**O que verifica:** Conexões que dependem de uma única referência backtick, onde a ORIGEM é um steering always-loaded ou hook. Se alguém apagar essa referência, a conexão de navegação morre.

**Nota:** Referências de steerings `fileMatch`/`manual` são excluídas — essas são referências de documentação, não de navegação. O steering alvo ainda carrega pelo seu próprio mecanismo de inclusão independentemente.

**Exemplo:**
```
code-conventions.md (always)  →  (1 backtick-ref)  →  testing-guide.md
```
Se alguém remover o `` `testing-guide.md` `` do code-conventions, o link de navegação desaparece.

**Impacto:** Rede de navegação frágil. Uma edição acidental pode quebrar a capacidade do agente de encontrar conhecimento relacionado.

**Como resolver:** Adicione pelo menos mais uma referência (wiki-link ou markdown-link) entre os arquivos conectados.

---

### 3. Isolated Files (Arquivos Isolados)

**O que verifica:** Nós de steering no grafo com zero edges (nem entrada nem saída).

**Nota:** Hooks e skills são excluídos — hooks são ativados por eventos IDE e skills por correspondência de keywords. Eles não precisam de conexões no grafo para funcionar.

**Por que importa:** Arquivos de steering sem conexões não fazem parte da rede de conhecimento.

**Impacto:** Informação perdida no ecossistema.

**Como resolver:** Referencie o arquivo isolado a partir do steering mais relevante.

---

### 4. Coverage Gaps (Gaps de Cobertura)

**O que verifica:** Workspace folders que não possuem nenhum steering.

**Exemplo:**
```
Workspace "mobile"  →  0 steerings  →  GAP
```

**Impacto:** O agente não tem nenhuma instrução sobre essa área do projeto. Vai trabalhar "no escuro".

**Como resolver:** Crie um steering em `.kiro/steering/` cobrindo o domínio desse workspace.

---

### 5. Weak Instructions (Instruções Fracas)

**O que verifica:** Steerings com menos de 10 linhas.

**Por que importa:** Um arquivo com 5 linhas não tem contexto suficiente para guiar o agente. É como dar uma instrução pela metade.

**Impacto:** Agente recebe direção vaga, produz resultados inconsistentes.

**Como resolver:** Expanda com contexto, regras, exemplos e comportamento esperado. Ideal: 100-350 linhas.

---

### 6. Context Overload (Sobrecarga de Contexto)

**O que verifica:** Steerings com `inclusion: always` (sem frontmatter equivale a always) que excedem 350 linhas. Apenas steerings `always` contam — `auto`, `fileMatch` e `manual` são excluídos desta métrica.

**Por que importa:** Cada steering `always` consome tokens da janela de contexto do agente em TODA interação. Acima de 60% de uso, a qualidade degrada significativamente.

**Nota:** Steerings com `inclusion: auto` NÃO são contados aqui — eles carregam sob demanda. Veja regra 19 (Large Domain Steerings) para steerings auto que excedem 1000 linhas.

**Exemplo:**
```
Total always-loaded: 490 linhas  →  OK (conta apenas inclusion: always)
project-overview.md (always, 420 linhas)  →  OVERLOAD (max 350)
api-patterns.md (auto, 600 linhas)  →  NÃO contado (auto é sob demanda)
```

**Impacto:** Agente perde capacidade de raciocínio porque está "cheio" de contexto.

**Como resolver:** Divida steerings always-loaded grandes em arquivos menores focados, ou mude para `inclusion: auto` ou `inclusion: fileMatch`.

---

### 7. Hooks Without Instruction (Hooks sem Instrução)

**O que verifica:** Hooks que não referenciam nenhum steering E não possuem um prompt auto-suficiente. Um prompt é considerado auto-suficiente se tem >= 20 palavras e contém verbos imperativos (analise, verifique, garanta, cheque, valide, use, etc.).

**Nota:** Hooks com prompts detalhados e acionáveis (>= 20 palavras + conteúdo imperativo) NÃO são sinalizados — eles são auto-contidos e não precisam de referência a steering.

**Exemplo (sinalizado):**
```
update-roadmap.kiro.hook  →  prompt: "update roadmap"  →  MUITO CURTO (< 20 palavras)
```

**Exemplo (NÃO sinalizado):**
```
dml-protection.kiro.hook  →  prompt: "Analise o SQL, verifique se tem WHERE clause,
avalie o impacto em produção, classifique o risco..."  →  AUTO-SUFICIENTE (30+ palavras, imperativo)
```

**Impacto:** Hooks com prompts insuficientes disparam sem direção clara — o agente não sabe o que fazer.

**Como resolver:** Adicione uma referência a um steering no prompt do hook, ou expanda o prompt para ser auto-suficiente (>= 20 palavras com instruções imperativas claras).

---

### 8. Steerings Without Access (Steerings sem Acesso)

**O que verifica:** Steerings com `inclusion: manual` ou `fileMatch` que nenhum hook referencia.

**Impacto:** O steering tem instruções, mas nunca é ativado automaticamente. O agente só o vê se o usuário manualmente incluir.

**Como resolver:** Crie um hook que referencie esse steering, ou mude para `inclusion: always`.

---

## Regras Avançadas de Assertividade (v0.2.1)

### 9. Dead Loops (Ciclos Isolados)

**O que verifica:** Grupos de steerings que se referenciam entre si em ciclo, mas nenhum nó externo aponta para eles.

**Exemplo:**
```
A → B → C → A  (ciclo)
Nenhum outro steering aponta para A, B ou C  →  DEAD LOOP
```

**Impacto:** Se o agente entrar nesse ciclo, fica preso navegando entre os mesmos 3 arquivos sem nunca sair para informação útil.

**Como resolver:** Adicione uma referência de um entry point (steering always-loaded ou hook) para pelo menos um nó do ciclo.

---

### 10. Hops to Reach (Profundidade de Acesso)

**O que verifica:** Quantos "saltos" o agente precisa dar para chegar de um entry point até cada steering. Alerta quando >= 4 hops.

**Exemplo:**
```
hook → steering-A → steering-B → steering-C → steering-D (4 hops)
steering-D está MUITO LONGE do ponto de entrada
```

**Impacto:** O agente provavelmente não vai alcançar steerings profundos a tempo. Informação importante fica inacessível na prática.

**Como resolver:** Crie um atalho direto — uma referência de um entry point para o steering distante.

---

### 11. Duplicate Intent (Redundância de Instrução)

**O que verifica:** Pares de steerings always-loaded com mais de 60% de keywords em comum.

**Exemplo:**
```
code-conventions.md  ↔  code-standards.md  →  78% overlap
Ambos falam de: typescript, strict, semicolons, indentation, formatting
```

**Impacto:** O agente carrega dois arquivos dizendo quase a mesma coisa. Desperdiça tokens e pode receber micro-variações conflitantes.

**Como resolver:** Consolide em um único arquivo ou diferencie claramente os escopos (um para formatação, outro para arquitetura).

---

### 12. Passive Knowledge (Conhecimento Passivo)

**O que verifica:** Steerings com menos de 10% de linhas contendo conteúdo acionável. Conteúdo acionável inclui:
- Verbos imperativos (use, always, never, must, should, avoid, ensure, implement, etc.)
- Linhas de dados em tabelas de decisão (tabelas com cabeçalhos como "Condition/Action", "Quando/Ação", "If/Then", "Trigger/Response")

**Nota:** Tabelas de decisão com pares de colunas reconhecidos contam como instruções — cada linha de dados é uma linha acionável dizendo ao agente o que fazer em uma situação específica.

**Exemplo:**
```
project-overview.md  →  2% actionable
"O sistema usa TypeScript..."  ← descreve
"A extensão renderiza um grafo..."  ← descreve
Nenhuma linha diz ao agente O QUE FAZER
```

**Exemplo (tabela de decisão conta como acionável):**
```
| Situação | Ação |
|----------|------|
| Pagamento falhou | Retry com backoff |    ← ACIONÁVEL
| Timeout > 30s | Cancelar e notificar |   ← ACIONÁVEL
```

**Impacto:** O agente lê o arquivo mas não recebe direção. É como ler um manual sem instruções — só descrição.

**Como resolver:** Adicione instruções imperativas ou tabelas de decisão com pares claros de condição/ação.

---

### 13. Signal-to-Noise (Proporção Instrução/Contexto)

**O que verifica:** Steerings com 10-20% de conteúdo acionável — têm algumas instruções mas são majoritariamente descritivos.

**Exemplo:**
```
security-policies.md  →  14% signal
300 linhas de contexto sobre ameaças
42 linhas de regras reais para o agente seguir
```

**Impacto:** O agente gasta a maioria dos tokens lendo background e tem pouca direção efetiva.

**Como resolver:** Condense o contexto descritivo e aumente a densidade de instruções. Mova background para um arquivo separado com `inclusion: manual`.

---

### 14. Contradictions (Conflito de Regras)

**O que verifica:** Steerings always-loaded que contêm regras opostas sobre o mesmo assunto.

**Exemplo:**
```
code-conventions.md:  "Always use single quotes"
legacy-support.md:    "Never use single quotes in templates"
                       ↑ CONTRADIÇÃO: always vs never sobre "single quotes"
```

**Impacto:** O agente recebe instruções conflitantes simultaneamente. Resultado imprevisível — às vezes segue uma, às vezes outra.

**Como resolver:** Unifique a regra em um único steering ou defina escopos distintos (ex: "single quotes para TypeScript, double quotes para templates").

---

### 15. Hook Coverage Map (Cobertura de Eventos)

**O que verifica:** Quais dos 10 eventos IDE disponíveis têm hooks configurados e quais não têm.

**Eventos disponíveis:**
- `fileEdited` — arquivo salvo
- `fileCreated` — arquivo criado
- `fileDeleted` — arquivo deletado
- `userTriggered` — botão manual
- `promptSubmit` — mensagem enviada ao agente
- `agentStop` — agente terminou execução
- `preToolUse` — antes de usar uma ferramenta
- `postToolUse` — depois de usar uma ferramenta
- `preTaskExecution` — antes de iniciar uma task
- `postTaskExecution` — depois de completar uma task

**Exemplo:**
```
✓ agentStop (1 hook)
✓ postToolUse (1 hook)
✓ postTaskExecution (1 hook)
✗ fileEdited — DESCOBERTO
✗ preToolUse — DESCOBERTO
✗ promptSubmit — DESCOBERTO
... 7 eventos sem cobertura
```

**Impacto:** Eventos sem hooks são oportunidades de automação perdidas. O agente poderia validar código ao salvar, revisar antes de executar ferramentas, etc.

**Como resolver:** Avalie quais eventos fazem sentido para seu workflow e crie hooks para eles.

---

### 16. Decision Path (Cadeia de Decisão)

**O que verifica:** Se as cadeias hook→steering estão completas. Dois problemas:
1. Hooks que disparam sem nenhum steering fornecendo critérios de decisão
2. Steerings com conteúdo decisório que nenhum hook aciona

**Exemplo:**
```
PROBLEMA 1: hook "auto-format" dispara em fileEdited
             → mas não referencia nenhum steering com regras de formatação
             → agente formata "no feeling" sem critérios

PROBLEMA 2: steering "when-to-refactor.md" tem regras de decisão
             → mas nenhum hook o aciona
             → regras existem mas nunca são usadas automaticamente
```

**Impacto:** Agente toma decisões sem critérios (hook sem steering) ou tem critérios que nunca são ativados (steering sem hook).

**Como resolver:** Vincule hooks a steerings com critérios, e crie hooks para steerings decisórios.

---

### 17. Quality Gate (Portão de Qualidade)

**O que verifica:** Se o ecossistema tem mecanismos de auto-revisão para garantir que nada vai para o dev sem estar documentado, testado e em conformidade.

**Níveis de maturidade:**

| Nível | Nome | Significado |
|-------|------|-------------|
| 0 | Sem Gate | Nenhum mecanismo de review. Código pode ser entregue sem validação. |
| 1 | Parcial | Tem steering de qualidade OU hook de review, mas não integrados. |
| 2 | Completo | Tem steering + hook de review + hook post-task que valida conformidade. |

**Exemplo de Nível 2 (ideal):**
```
✓ Hook preToolUse "code-review" → referencia code-conventions.md
✓ Steering "code-conventions.md" → regras de qualidade
✓ Hook postTaskExecution "checklist" → referencia code-conventions.md
```

**Impacto:** Sem quality gate, o agente pode entregar código sem testes, sem documentação, sem seguir as convenções. Com nível 2, TUDO passa por validação antes de chegar ao dev.

**Como resolver:**
1. Crie um hook `preToolUse` ou `postToolUse` com keywords de review
2. Crie um steering com regras de qualidade/convenções
3. Crie um hook `postTaskExecution` que referencie o steering de qualidade

---

### 18. DML Protection (Proteção contra Operações Destrutivas)

**O que verifica:** Se o ecossistema tem proteção contra operações de banco de dados (INSERT, UPDATE, DELETE, DROP) executadas pelo agente AI.

**Níveis de maturidade:**

| Nível | Nome | Significado |
|-------|------|-------------|
| 0 | Sem Proteção | Agente pode executar qualquer SQL sem gate. |
| 1 | Bloqueio Cego | Tem hook que bloqueia, mas não avalia os riscos — bloqueia sem explicar. |
| 2 | Proteção Inteligente | Hook bloqueia + steering avalia riscos + notifica o dev com contexto. |

**Exemplo de Nível 2 (ideal):**
```
✓ Hook preToolUse com toolTypes ".*sql.*" → referencia database-rules.md
✓ Steering "database-rules.md" → critérios de risco (production, rollback, impact)
✓ Hook avalia: "Este DELETE afeta 50k registros em produção. Irreversível. Confirma?"
```

**Exemplo de Nível 0 (perigoso):**
```
✗ Nenhum hook para SQL
✗ Nenhum steering de banco
→ Agente executa "DELETE FROM users" sem perguntar nada
```

**Impacto:** Sem proteção DML, um agente AI pode executar operações destrutivas no banco sem nenhuma validação. Com nível 2, toda operação é avaliada quanto ao risco antes de executar.

**Como resolver:**
1. Crie um hook `preToolUse` com `toolTypes: [".*sql.*", ".*database.*"]`
2. Crie um steering com regras de proteção de banco (backup, rollback, ambientes)
3. No prompt do hook, referencie o steering para que o agente avalie riscos antes de executar

---

### 19. Large Domain Steerings (Steerings de Domínio Extenso)

**O que verifica:** Steerings com `inclusion: auto` que excedem 1000 linhas. São tipicamente arquivos de documentação de domínio que carregam sob demanda.

**Por que importa:** Embora steerings `auto` não consumam contexto permanentemente (carregam sob demanda), um arquivo de 1500 linhas carregado no contexto de uma vez ainda ocupa espaço significativo. Dividir em sub-steerings menores que se referenciam permite ao agente carregar apenas a seção relevante.

**Exemplo:**
```
crm-atendimento-domain.md (auto, 1582 linhas)  →  LARGE DOMAIN
```

**Arquitetura sugerida:**
```
crm-domain.md (auto, 200 linhas)  →  índice/overview, referencia sub-domínios
  ├─ crm-atendimento-domain.md (auto, 400 linhas)
  ├─ crm-vendas-domain.md (auto, 350 linhas)
  └─ crm-suporte-domain.md (auto, 300 linhas)
```

**Impacto:** Quando o agente precisa de contexto CRM, ele carrega o índice de 200 linhas primeiro, depois navega para o sub-domínio específico necessário — ao invés de carregar 1582 linhas de uma vez.

**Como resolver:** Divida em um steering principal (índice) que referencia sub-steerings por tópico. Cada sub-steering tem `inclusion: auto` e carrega independentemente quando seu contexto é necessário.

---

### 20. Stale Content (Detecção de Hubs Desatualizados)

**O que verifica:** Steerings não modificados há 90+ dias que possuem 3+ conexões (hubs de alto grau). São documentos desatualizados que propagam informação obsoleta por muitos caminhos.

**Por que importa:** Um steering hub que não foi atualizado em meses pode conter regras desatualizadas, padrões deprecados ou referências incorretas. Por ser altamente conectado, muitos outros steerings e hooks dependem dele — amplificando o impacto do conteúdo obsoleto.

**Exemplo:**
```
code-conventions.md (always, 4 conexões, última modificação há 120 dias)  →  STALE HUB
  Risk Score: 120 × 4 = 480
```

**Impacto:** O agente segue regras desatualizadas de um documento central, propagando comportamento incorreto pelo ecossistema.

**Como resolver:** Revise e atualize o conteúdo para refletir as práticas atuais. Se o steering não é mais necessário, remova-o ou reduza suas conexões.

---

### 21. Semantic Coherence (Detecção de Vazamento de Escopo)

**O que verifica:** Se os headers de seção de um steering correspondem ao domínio esperado pela classificação do seu NodeType. Cada tipo de steering (policy, tech, flow, domain, product, agent, help, playbook, observability) tem um conjunto de keywords esperadas. Os headers são tokenizados e comparados contra o keyword set.

**Por que importa:** Quando um arquivo `steering-policy` contém seções sobre "Deploy Pipeline" e "Database Migrations", isso indica vazamento de escopo — conteúdo de tech/domain está sangrando para um arquivo de política. Isso confunde o agente sobre onde encontrar informação específica e dilui o propósito do steering.

**Algoritmo:**
1. Para cada nó steering, obter seu NodeType e keyword set correspondente
2. Tokenizar cada header de seção (lowercase, split por não-alfanuméricos)
3. Um header é "on-topic" se pelo menos um token corresponde a uma keyword do set
4. Coerência = headers on-topic / total de headers
5. Alertar quando coerência < 0.70 (mais de 30% off-topic)

**Exemplo:**
```
security-policies.md (steering-policy)
  Headers: "Security Rules", "Access Control", "Deploy Pipeline", "Database Setup", "Docker Config"
  On-topic: 2/5 = 40% coerência  →  ALERTA
  Off-topic headers: "Deploy Pipeline", "Database Setup", "Docker Config"
```

**Impacto:** O agente carrega um steering de política esperando regras de segurança mas encontra conteúdo de infraestrutura misturado, reduzindo a clareza das instruções.

**Como resolver:** Mova seções off-topic para um steering do tipo apropriado (ex: mover conteúdo de deploy para um arquivo `steering-tech`).

---

## Resumo Visual

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANÁLISE COGNITIVA                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ESTRUTURA DO GRAFO           QUALIDADE DO CONTEÚDO             │
│  ├─ Orphan Steerings          ├─ Passive Knowledge              │
│  ├─ Fragile Links             ├─ Signal-to-Noise                │
│  ├─ Isolated Files            ├─ Duplicate Intent               │
│  ├─ Coverage Gaps             ├─ Contradictions                 │
│  ├─ Dead Loops                └─ Semantic Coherence             │
│  └─ Hops to Reach                                              │
│                              SEGURANÇA E MATURIDADE             │
│  COMPLETUDE                   ├─ Quality Gate (0/1/2)           │
│  ├─ Hooks Without Instruction ├─ DML Protection (0/1/2)         │
│  ├─ Steerings Without Access  ├─ Hook Coverage Map              │
│  ├─ Weak Instructions         └─ Decision Path                  │
│  ├─ Context Overload                                            │
│  └─ Large Domain Steerings   FRESCOR                            │
│                               └─ Stale Content                  │
│  MODULARIZAÇÃO                                                  │
│  └─ Auto steerings > 1000 linhas                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Como usar

1. Abra o Kiro Ecosystem Graph (ícone no sidebar)
2. Clique no botão 🧠 (Brain) no toolbar
3. O painel mostra todas as métricas em tempo real
4. Clique "Export" para gerar o relatório Markdown
5. Cole o relatório no chat do Kiro e peça para resolver os problemas

---

*Versão: 0.2.2 | 21 regras de análise | 207 testes automatizados*
