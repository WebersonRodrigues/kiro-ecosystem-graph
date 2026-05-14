import type { NodeType } from '../types';

/**
 * Color mapping for each NodeType.
 * Injective: each NodeType maps to a unique hex color.
 */
const NODE_COLOR_MAP: Record<NodeType, string> = {
  'steering-flow': '#4A9EFF',
  'steering-help': '#4CAF50',
  'steering-playbook': '#FF9800',
  'steering-observability': '#9C27B0',
  'steering-domain': '#009688',
  'steering-policy': '#F44336',
  'steering-tech': '#00BCD4',
  'steering-product': '#8BC34A',
  'steering-agent': '#FF5722',
  'code-file': '#90A4AE',
  'module': '#FFC107',
  'entity': '#E91E63',
  'skill': '#B388FF',
  'hook-manual': '#64B5F6',
  'hook-auto': '#7C4DFF',
  'unknown': '#607D8B',
};

/**
 * Workspace folders considered as non-root (code) folders.
 * Files from these folders that are not steering files are classified as 'code-file'.
 */
const CODE_WORKSPACE_FOLDERS = ['api', 'integrador', 'mobile', 'manifests'];

/**
 * Service responsible for classifying graph nodes by filename prefix
 * and assigning unique colors per NodeType.
 */
export class NodeClassifier {
  /**
   * Determines the NodeType for a given file based on its filename prefix
   * and workspace folder context.
   *
   * Classification rules (in priority order):
   * 1. Starts with `flow-` → 'steering-flow'
   * 2. Starts with `help-` → 'steering-help'
   * 3. Starts with `playbook` → 'steering-playbook'
   * 4. Starts with `observability-` or contains `monitoring`, `logging`, `tracing` → 'steering-observability'
   * 5. Contains `polic` (policy/policies) or `security` or `guard` → 'steering-policy'
   * 6. Contains `tech`, `architect`, `infra`, `deploy`, `stack` → 'steering-tech'
   * 7. Contains `product`, `business`, `requirement`, `feature`, `user-stor` → 'steering-product'
   * 8. Contains `agent`, `persona`, `ai`, `llm`, `prompt` → 'steering-agent'
   * 9. Contains `-dominio`, `-domain`, `convention`, `regra`, `cognitive`, `auto-aprendizado` → 'steering-domain'
   * 10. File is from a code workspace folder → 'code-file'
   * 11. Any .md file → 'steering-domain' (fallback for steerings)
   * 12. Fallback → 'unknown'
   */
  classify(fileName: string, workspaceFolder: string, isSteeringFile: boolean = true): NodeType {
    const lowerName = fileName.toLowerCase();

    // Flow steerings
    if (lowerName.startsWith('flow-')) {
      return 'steering-flow';
    }

    // Help/FAQ steerings
    if (lowerName.startsWith('help-') || lowerName.startsWith('faq')) {
      return 'steering-help';
    }

    // Playbook steerings
    if (lowerName.startsWith('playbook') || lowerName.includes('runbook')) {
      return 'steering-playbook';
    }

    // Observability steerings
    if (lowerName.startsWith('observability-') || lowerName.includes('monitoring') ||
        lowerName.includes('logging') || lowerName.includes('tracing') ||
        lowerName.includes('alerting') || lowerName.includes('metrics')) {
      return 'steering-observability';
    }

    // Policy/Security steerings
    if (lowerName.includes('polic') || lowerName.includes('security') ||
        lowerName.includes('guard') || lowerName.includes('compliance') ||
        lowerName.includes('governance')) {
      return 'steering-policy';
    }

    // Agent/AI steerings
    if (lowerName.includes('agent') || lowerName.includes('persona') ||
        lowerName.includes('llm') || lowerName.includes('prompt') ||
        lowerName.includes('ai-') || lowerName.startsWith('ai.')) {
      return 'steering-agent';
    }

    // Tech/Architecture steerings
    if (lowerName.includes('tech') || lowerName.includes('architect') ||
        lowerName.includes('infra') || lowerName.includes('deploy') ||
        lowerName.includes('stack') || lowerName.includes('devops') ||
        lowerName.includes('cicd') || lowerName.includes('pipeline') ||
        lowerName.includes('standard') || lowerName.includes('convention')) {
      return 'steering-tech';
    }

    // Product/Business steerings
    if (lowerName.includes('product') || lowerName.includes('business') ||
        lowerName.includes('requirement') || lowerName.includes('feature') ||
        lowerName.includes('user-stor') || lowerName.includes('roadmap') ||
        lowerName.includes('backlog') || lowerName.includes('sprint')) {
      return 'steering-product';
    }

    // Domain/Config steerings
    if (lowerName.includes('-dominio') || lowerName.includes('-domain') ||
        lowerName.includes('regra') ||
        lowerName.includes('cognitive') || lowerName.includes('auto-aprendizado')) {
      return 'steering-domain';
    }

    // Code workspace folders
    const lowerFolder = workspaceFolder.toLowerCase();
    const isCodeFolder = CODE_WORKSPACE_FOLDERS.includes(lowerFolder);
    const isSteeringMd = lowerName.endsWith('.md');

    if (isCodeFolder && !isSteeringMd) {
      return 'code-file';
    }

    // Any .md file that didn't match a specific prefix is a generic domain doc
    if (isSteeringMd) {
      return 'steering-domain';
    }

    return 'unknown';
  }

  /**
   * Returns the hex color associated with a given NodeType.
   * The mapping is injective — each NodeType has a unique color.
   */
  getColor(nodeType: NodeType): string {
    return NODE_COLOR_MAP[nodeType];
  }
}
