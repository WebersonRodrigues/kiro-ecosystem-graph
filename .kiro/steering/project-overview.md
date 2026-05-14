# Kiro Ecosystem Graph — Visão do Projeto

## O que é

Extensão para VS Code/Kiro que renderiza um grafo force-directed interativo do ecossistema cognitivo do Kiro — steerings, skills, hooks e suas interconexões visualizadas como um mapa neural.

## Para que serve

Torna visível a rede de conhecimento do agente AI. Identifica:
- Steerings órfãos (conhecimento isolado que o agente não alcança)
- Links frágeis (conexões de referência única)
- Hubs centrais (documentos com muitas conexões)
- Gaps de cobertura (pastas sem steering)

Sem essa visibilidade, regras se duplicam, documentos ficam sem uso, e o agente perde contexto.

## Onde está

- Repositório: https://github.com/WebersonRodrigues/kiro-ecosystem-graph.git
- Publisher: `webersonrodrigues` no VS Code Marketplace
- Nome do pacote: `kiro-ecosystem-graph`
- Diretório local: `C:\ferramentas\GIT\ecosystem-graph`

## Stack técnica

- TypeScript (extensão VS Code)
- esbuild (bundler)
- Webview com JavaScript vanilla (grafo force-directed)
- Mocha + fast-check (testes)
- vsce (empacotamento/publicação)

## Estrutura principal

```
src/
  extension.ts          — ponto de entrada da extensão
  types.ts              — tipos compartilhados
  services/             — lógica de negócio (discovery, parser, classifier, etc.)
  webview/
    webviewProvider.ts  — provider do webview panel
    media/              — scripts JS do webview (grafo, painéis, filtros)
resources/              — ícones e screenshots
dist/                   — output do build (ignorado no git)
```

## Comandos essenciais

| Ação | Comando |
|------|---------|
| Compilar | `npm run compile` |
| Watch mode | `npm run watch` |
| Gerar .vsix | `npx vsce package` |
| Publicar no marketplace | `npx vsce publish` |
| Rodar testes | `npm test` |

## Fluxo de publicação

### VS Code Marketplace (Microsoft)

1. Bumpar versão no `package.json`
2. `npm run compile`
3. `npx vsce package` (gera o .vsix)
4. `npx vsce publish` (publica direto) ou upload manual em https://marketplace.visualstudio.com/manage
5. Commit + push das mudanças

### Open VSX (Kiro IDE)

O Kiro IDE usa o Open VSX Registry (https://open-vsx.org) como marketplace. Para a extensão aparecer no Kiro, precisa estar publicada lá também.

**Contas necessárias (já criadas):**
- Eclipse Foundation: https://accounts.eclipse.org (login: webersonrodrigues)
- Open VSX: https://open-vsx.org (login via Eclipse Foundation)
- GitHub vinculado à conta Eclipse em "Link GitHub Account"

**Setup inicial (já feito, não precisa repetir):**
1. Criar conta na Eclipse Foundation (https://accounts.eclipse.org)
2. Assinar o Eclipse Contributor Agreement (ECA) — menu lateral "Eclipse Contributor Agreement (ECA)"
   - Marcar os 4 checkboxes do Developer Certificate of Origin (A, B, C, D)
   - Marcar "Acceptance of Terms"
   - Clicar "Update ECA"
3. Vincular GitHub à conta Eclipse — menu lateral "Link GitHub Account"
4. No Open VSX, ir em Profile e ativar login com Eclipse Foundation (vincular as contas)
5. Assinar o "Open VSX Publisher Agreement" que aparece no perfil do Open VSX
6. Criar namespace `webersonrodrigues` em Namespaces

**Publicação de novas versões:**
1. Bumpar versão no `package.json`
2. `npm run compile`
3. `npx vsce package` (gera o .vsix)
4. Upload manual do .vsix em https://open-vsx.org → Extensions → "Publish Extension"
   - Ou via CLI: `npx ovsx publish kiro-ecosystem-graph-X.Y.Z.vsix -p TOKEN`
   - Token gerado em: https://open-vsx.org → Access Tokens
5. A extensão fica "Under review" até ser aprovada pelo Open VSX

**Verificação do Namespace (claim ownership):**

O namespace `webersonrodrigues` no Open VSX precisa ser "claimed" para aparecer como verificado (ícone de shield ao invés de warning ⚠️). Sem isso, a extensão mostra um banner de aviso e reviews/estrelas ficam bloqueadas.

- Issue aberta: https://github.com/EclipseFdn/open-vsx.org/issues/10331
- Status: aguardando aprovação (geralmente 1-5 dias úteis)
- Use case aplicado: **#1** — namespace existe como publisher no VS Code Marketplace com extensão publicada, repo público no GitHub pertencente à mesma conta
- Quando aprovado: o namespace muda de "contributor" para "owner", extensões ficam verificadas automaticamente

**Troubleshooting:**
- Erro "You must log in with an Eclipse Foundation account and sign a Publisher Agreement" → verificar se o login no Open VSX está usando Eclipse Foundation (não só GitHub) e se o ECA está assinado
- Imagens não aparecem no marketplace → usar URLs absolutas do raw.githubusercontent.com no README
- Warning "not a verified publisher" → namespace precisa de ownership claim (ver issue acima)
- Auto-update não funciona no Kiro IDE → pode ser delay de propagação do Open VSX ou bug do Kiro; workaround: instalar via .vsix manualmente ou selecionar versão específica

## Configurações importantes

- `package.json` → metadata, contributes (commands, views), scripts
- `esbuild.config.js` → configuração do bundler
- `tsconfig.json` → configuração TypeScript
- `.vscodeignore` → arquivos excluídos do .vsix
- `.gitignore` → exclui `node_modules/`, `dist/`, `*.vsix`

## Git

- Branch principal: `main`
- Remote: `origin` → GitHub
- Autor: WebersonRodrigues / weberson.r.a@gmail.com

## Notas

- As imagens do README usam URLs absolutas do `raw.githubusercontent.com` para funcionar no marketplace
- Extensão 100% offline, sem telemetria
- Licença MIT
