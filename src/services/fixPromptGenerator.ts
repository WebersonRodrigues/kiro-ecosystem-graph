import { IssueCategory, FixIssueData } from '../types';

const MAX_PROMPT_LENGTH = 2000;

/** Descrições humanas por categoria */
const categoryDescriptions: Record<IssueCategory, string> = {
  'orphan-steerings': 'Steering órfão sem referências externas',
  'fragile-links': 'Link frágil com referência única',
  'isolated-files': 'Arquivo isolado sem conexões no grafo',
  'coverage-gaps': 'Gap de cobertura — pasta sem steering',
  'weak-instructions': 'Steering com instruções fracas (poucas linhas)',
  'context-overload': 'Steering com sobrecarga de contexto',
  'large-domain-steerings': 'Steering de domínio muito grande',
  'hooks-without-instruction': 'Hook sem instrução adequada',
  'steerings-without-access': 'Steering sem ponto de acesso',
  'dead-loops': 'Ciclo morto sem entry point',
  'hops-to-reach': 'Muitos hops para alcançar o nó',
  'duplicate-intent': 'Intenção duplicada entre arquivos',
  'passive-knowledge': 'Conhecimento passivo (baixa acionabilidade)',
  'signal-to-noise': 'Baixa relação sinal/ruído',
  'contradictions': 'Contradição entre arquivos',
  'hook-coverage': 'Evento sem cobertura de hook',
  'decision-path': 'Cadeia de decisão incompleta',
  'quality-gate': 'Quality Gate incompleto',
  'dml-protection': 'DML Protection incompleto',
};

/**
 * Gera a instrução específica para uma categoria com base nos dados da issue.
 */
function buildInstruction(
  category: IssueCategory,
  issue: FixIssueData,
): string {
  const file = issue.ids[0] ?? '';
  const extra = issue.extra ?? {};

  switch (category) {
    case 'orphan-steerings':
      return `Adicione uma referência a \`${file}\` em um steering relacionado usando backtick`;

    case 'fragile-links':
      return `Adicione pelo menos mais uma referência (wiki-link ou markdown-link) entre \`${issue.ids[0] ?? ''}\` e \`${issue.ids[1] ?? ''}\``;

    case 'isolated-files':
      return `Referencie \`${file}\` a partir do steering mais relevante do ecossistema`;

    case 'coverage-gaps':
      return `Crie um steering em \`.kiro/steering/\` cobrindo o domínio do workspace \`${file}\``;

    case 'weak-instructions':
      return `Expanda \`${file}\` (atualmente ${extra['lines'] ?? '?'} linhas) com contexto, regras, exemplos. Ideal: 100-350 linhas`;

    case 'context-overload':
      return `Divida \`${file}\` (${extra['lines'] ?? '?'} linhas) em arquivos menores ou mude para \`inclusion: auto/fileMatch\``;

    case 'large-domain-steerings':
      return `Divida \`${file}\` (${extra['lines'] ?? '?'} linhas) em sub-steerings com índice principal referenciando cada um`;

    case 'hooks-without-instruction':
      return `Adicione uma referência a um steering no prompt do hook \`${file}\`, ou expanda o prompt para >= 20 palavras com instruções imperativas`;

    case 'steerings-without-access':
      return `Crie um hook que referencie \`${file}\` ou mude para \`inclusion: always\``;

    case 'dead-loops': {
      const nodes = Array.isArray(extra['nodes'])
        ? (extra['nodes'] as string[]).join(', ')
        : (extra['nodes'] ?? issue.ids.join(', '));
      return `Adicione uma referência de um entry point para pelo menos um nó do ciclo: ${nodes}`;
    }

    case 'hops-to-reach':
      return `Crie um atalho direto de um entry point (steering always ou hook) para \`${file}\` (atualmente ${extra['hops'] ?? '?'} hops)`;

    case 'duplicate-intent':
      return `Consolide \`${issue.ids[0] ?? ''}\` e \`${issue.ids[1] ?? ''}\` (${extra['overlap'] ?? '?'}% overlap) em um único arquivo ou diferencie claramente os escopos`;

    case 'passive-knowledge':
      return `Adicione instruções imperativas a \`${file}\` (atualmente ${extra['actionable'] ?? '?'}% acionável). Use verbos como: use, always, never, must`;

    case 'signal-to-noise':
      return `Condense o texto descritivo de \`${file}\` (${extra['signal'] ?? '?'}% signal) e aumente a densidade de instruções`;

    case 'contradictions': {
      const snippetA = extra['snippetA'] ?? '';
      const snippetB = extra['snippetB'] ?? '';
      return `Resolva a contradição entre \`${issue.ids[0] ?? ''}\` e \`${issue.ids[1] ?? ''}\`: '${snippetA}' vs '${snippetB}'. Unifique a regra ou defina escopos distintos`;
    }

    case 'hook-coverage':
      return `Avalie se o evento \`${extra['event'] ?? file}\` precisa de um hook e, se sim, crie um em \`.kiro/hooks/\``;

    case 'decision-path':
      return `Complete a cadeia de decisão: vincule \`${file}\` a um steering com critérios de decisão`;

    case 'quality-gate':
      return `Para atingir Quality Gate nível 2, adicione: ${extra['missing'] ?? '?'}`;

    case 'dml-protection':
      return `Para atingir DML Protection nível 2, adicione: ${extra['missing'] ?? '?'}`;

    default:
      return `Corrija o problema da categoria "${category}" nos arquivos afetados`;
  }
}

/**
 * Formata a lista de paths afetados, truncando se necessário.
 */
function formatPaths(ids: string[], maxLength: number): string {
  if (ids.length === 0) {
    return '(nenhum arquivo específico)';
  }

  const allPaths = ids.map((p) => `\`${p}\``).join(', ');
  if (allPaths.length <= maxLength) {
    return allPaths;
  }

  let result = '';
  let count = 0;
  for (const id of ids) {
    const entry = `\`${id}\``;
    const separator = count > 0 ? ', ' : '';
    if (result.length + separator.length + entry.length > maxLength) {
      break;
    }
    result += separator + entry;
    count++;
  }

  const remaining = ids.length - count;
  if (remaining > 0) {
    result += `... e mais ${remaining} arquivos`;
  }

  return result;
}

/**
 * Gera um prompt direcionado para uma issue específica.
 * O prompt é em PT-BR, contém o contexto necessário e instruções claras.
 */
export function generateTargetedPrompt(
  category: IssueCategory,
  issue: FixIssueData,
): string {
  const description = categoryDescriptions[category]
    ?? `Problema: ${category}`;
  const instruction = buildInstruction(category, issue);
  const ruleName = category;

  // Build prompt without paths first to calculate available space
  const template = buildTargetedTemplate(
    description,
    '',
    instruction,
    ruleName,
  );
  const availableForPaths = MAX_PROMPT_LENGTH - template.length;
  const paths = formatPaths(issue.ids, Math.max(availableForPaths, 50));

  const prompt = buildTargetedTemplate(
    description,
    paths,
    instruction,
    ruleName,
  );

  return prompt.slice(0, MAX_PROMPT_LENGTH);
}

/**
 * Monta o template do prompt individual.
 */
function buildTargetedTemplate(
  description: string,
  paths: string,
  instruction: string,
  ruleName: string,
): string {
  return [
    'Resolva o seguinte problema no ecossistema cognitivo:',
    '',
    `**Problema:** ${description}`,
    `**Arquivo(s) afetado(s):** ${paths}`,
    '',
    '**Ação necessária:**',
    instruction,
    '',
    `**Contexto:** Este problema foi detectado pela análise cognitiva do Kiro Ecosystem Graph (regra: ${ruleName}).`,
  ].join('\n');
}

/**
 * Gera um prompt consolidado para todas as issues de uma categoria.
 * Agrupa as instruções em lista numerada.
 */
export function generateConsolidatedPrompt(
  category: IssueCategory,
  issues: FixIssueData[],
): string {
  if (issues.length === 0) {
    return '';
  }

  const ruleName = category;
  const categoryLabel = categoryDescriptions[category] ?? category;

  const items = issues.map((issue, idx) => {
    const path = issue.ids[0] ?? '(sem path)';
    const instruction = buildInstruction(category, issue);
    return `${idx + 1}. \`${path}\` — ${instruction}`;
  });

  return [
    `Resolva os seguintes problemas de "${categoryLabel}" no ecossistema cognitivo:`,
    '',
    `${issues.length} issues encontradas:`,
    '',
    ...items,
    '',
    `**Contexto:** Problemas detectados pela análise cognitiva do Kiro Ecosystem Graph (regra: ${ruleName}).`,
    'Priorize mudanças que aumentem a conectividade do grafo.',
  ].join('\n');
}
