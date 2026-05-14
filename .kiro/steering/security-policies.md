---
inclusion: fileMatch
fileMatchPattern: "**/*.ts,**/*.js"
description: Security checklist for all code files. Activated when editing TypeScript or JavaScript.
---
# Security Policies

## Mandatory Checklist

- [ ] No hardcoded secrets, tokens, or API keys
- [ ] All user inputs validated before processing
- [ ] No eval() or dynamic code execution
- [ ] CSP headers properly configured for webviews
- [ ] File paths sanitized — no path traversal possible

## Webview Security

- Always use nonce-based CSP for script tags
- Never use `unsafe-eval` in Content-Security-Policy
- Validate all messages received from webview before acting
- Use `localResourceRoots` to restrict file access

## Dependencies

- Pin exact versions in package.json
- Review new dependencies before adding
- Run `npm audit` before publishing

## Related

- See `code-conventions.md` for code standards
- See `project-overview.md` for project architecture
