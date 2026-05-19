import * as assert from 'assert';
import * as fc from 'fast-check';

import { computeActionableRatio } from '../../services/contentAnalyzer';

/**
 * Property-Based Tests: PT-BR Imperative Expansion
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 *
 * Tests that expanded PT-BR verbs are detected as actionable
 * and that EN-only content ratio remains unchanged.
 */

const EXPANDED_PT_BR_VERBS = [
  'verificar', 'usar', 'configurar', 'documentar',
  'testar', 'validar', 'manter', 'utilizar',
  'aplicar', 'seguir', 'respeitar', 'incluir',
  'remover', 'adicionar', 'corrigir', 'atualizar',
];

const ORIGINAL_PT_BR_VERBS = [
  'crie', 'sempre', 'nunca', 'deve',
  'faça', 'evite', 'garanta', 'implemente',
];

const ALL_PT_BR_VERBS = [...EXPANDED_PT_BR_VERBS, ...ORIGINAL_PT_BR_VERBS];

/** Arbitrary for a random PT-BR verb from the expanded set */
const ptbrVerbArb = fc.constantFrom(...ALL_PT_BR_VERBS);

/** Arbitrary for a suffix that won't accidentally contain imperative keywords */
const safeSuffixArb = fc.constantFrom(
  'os padrões do projeto',
  'a configuração correta',
  'antes de fazer deploy',
  'no ambiente de staging',
  'com cuidado',
  'de forma consistente',
  'quando possível',
);

/** Arbitrary for descriptive lines (no imperative keywords) */
const descriptiveLineArb = fc.constantFrom(
  'O sistema processa dados em lotes.',
  'A arquitetura segue padrões limpos.',
  'Componentes são organizados em pastas.',
  'O banco de dados armazena registros.',
  'Logs ficam no diretório temporário.',
);

describe('PT-BR Imperative Expansion — Property Tests', function () {
  describe('Property 1: Random lines with expanded PT-BR verbs → actionable', function () {
    it('any line starting with a PT-BR verb is detected as actionable', function () {
      fc.assert(
        fc.property(
          ptbrVerbArb,
          safeSuffixArb,
          (verb, suffix) => {
            const line = `${verb} ${suffix}`;
            const ratio = computeActionableRatio(line);
            assert.strictEqual(
              ratio,
              1.0,
              `Expected "${line}" to be actionable (ratio=1.0), got ${ratio}`,
            );
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('Property 2: Random EN-only content → ratio unchanged vs original logic', function () {
    it('descriptive EN content without imperatives has ratio 0', function () {
      fc.assert(
        fc.property(
          fc.array(descriptiveLineArb, { minLength: 1, maxLength: 10 }),
          (lines) => {
            const content = lines.join('\n');
            const ratio = computeActionableRatio(content);
            assert.strictEqual(
              ratio,
              0,
              `Expected EN descriptive content to have ratio=0, got ${ratio}`,
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
