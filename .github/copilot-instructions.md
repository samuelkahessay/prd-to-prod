# Copilot Agent Instructions

## Project Overview
This project uses an agentic pipeline where issues are auto-generated from PRDs
and implemented by AI agents. Follow AGENTS.md for coding standards.

## Build & Test
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`

## Definition of Done
1. Code compiles without errors
2. All tests pass
3. New tests for new functionality
4. PR body includes `Closes #N`
5. PR description explains changes

## Restrictions
- Do not modify .github/workflows/ files
- Do not add dependencies without noting in PR
- Do not refactor outside issue scope
