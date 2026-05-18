# Regras de Análise Cognitiva — Kiro Ecosystem Graph

## O que é isso?

O Kiro Ecosystem Graph analisa a "saúde" do seu ecossistema cognitivo (steerings, hooks, skills) e gera um relatório com problemas e sugestões. Cada regra abaixo é uma validação automática que roda quando você abre o painel de análise ou exporta o relatório.

O objetivo é simples: **quanto mais preciso e bem conectado o ecossistema, mais assertivo e confiável o agente AI se torna.**

---

## Regras Existentes (Base)

### 1. Orphan Steerings (Steerings Órfãos)

**O que verifica:** Steerings com zero conexões (nenhuma referência de entrada nem de saída).

**Por que importa:** Um steering órfão é invisível para o agente. Ele existe no disco mas nunca é alcançado — é conhecimento morto.

**Exemplo:**
```
.kiro/steering/flow-geral.md  →  0 incoming, 0 outgoing  →  ÓRFÃO
```

**Impacto:** O agente nunca vai usar as regras desse arquivo. Você escreveu instruções que ninguém lê.

**Como resolver:** Adicione uma referência a esse steering de outro steering relacionado usando backtick (`` `flow-geral.md` ``).

---

### 2. Fragile Links (Links Frágeis)

**O que verifica:** Conexões entre steerings que dependem de uma única referência backtick. Se alguém apagar essa referência, a conexão morre.

**Exemplo:**
```
code-conventions.md  →  (1 backtick-ref)  →  testing-guide.md
```
Se alguém remover o `` `testing-guide.md` `` do code-conventions, a conexão desaparece.

**Impacto:** Rede frágil. Uma edição acidental pode isolar um steering inteiro.

**Como resolver:** Adicione pelo menos mais uma referência (wiki-link ou markdown-link) entre os arquivos conectados.

---

### 3. Isolated Files (Arquivos Isolados)

**O que verifica:** Nós no grafo com zero edges (nem entrada nem saída).

**Por que importa:** Arquivos sem conexão não fazem parte da rede de conhecimento. O agente não tem contexto sobre eles.

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

**O que verifica:** Steerings always-loaded com mais de 350 linhas, e total de linhas always-loaded acima de 500.

**Por que importa:** Cada steering always-loaded consome tokens da janela de contexto do agente. Acima de 60% de uso, a qualidade degrada significativamente.

**Exemplo:**
```
Total always-loaded: 1090 linhas  →  OVERLOAD
project-overview.md: 420 linhas  →  OVERLOAD (max 350)
```

**Impacto:** Agente perde capacidade de raciocínio porque está "cheio" de contexto.

**Como resolver:** Divida steerings grandes em arquivos menores focados, ou mude para `inclusion: manual` ou `inclusion: fileMatch`.

---

### 7. Hooks Without Instruction (Hooks sem Instrução)

**O que verifica:** Hooks que disparam mas não referenciam nenhum steering — o agente executa sem contexto.

**Exemplo:**
```
auto-learn.kiro.hook  →  dispara em agentStop  →  mas não referencia nenhum steering
```

**Impacto:** O hook aciona o agente, mas ele não sabe O QUE fazer porque não tem instrução associada.

**Como resolver:** Adicione uma referência a um steering no prompt do hook.

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

**O que verifica:** Steerings com menos de 10% de linhas contendo verbos imperativos (use, always, never, must, should, avoid, etc.).

**Exemplo:**
```
project-overview.md  →  2% actionable
"O sistema usa TypeScript..."  ← descreve
"A extensão renderiza um grafo..."  ← descreve
Nenhuma linha diz ao agente O QUE FAZER
```

**Impacto:** O agente lê o arquivo mas não recebe direção. É como ler um manual sem instruções — só descrição.

**Como resolver:** Adicione instruções imperativas: "Use TypeScript strict mode", "Always run tests before commit", "Never expose secrets in logs".

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

## Resumo Visual

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANÁLISE COGNITIVA                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ESTRUTURA DO GRAFO          QUALIDADE DO CONTEÚDO              │
│  ├─ Orphan Steerings         ├─ Passive Knowledge               │
│  ├─ Fragile Links            ├─ Signal-to-Noise                 │
│  ├─ Isolated Files           ├─ Duplicate Intent                │
│  ├─ Coverage Gaps            └─ Contradictions                  │
│  ├─ Dead Loops                                                  │
│  └─ Hops to Reach           SEGURANÇA E MATURIDADE             │
│                              ├─ Quality Gate (0/1/2)            │
│  COMPLETUDE                  ├─ DML Protection (0/1/2)          │
│  ├─ Hooks Without Instruction├─ Hook Coverage Map               │
│  ├─ Steerings Without Access └─ Decision Path                   │
│  ├─ Weak Instructions                                           │
│  └─ Context Overload                                            │
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

*Versão: 0.2.1 | 18 regras de análise | 137 testes automatizados*
