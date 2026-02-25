# Copilot Agent Instructions

## Project Overview
This is a **Code Snippet Manager** — a TypeScript/Express web application that
provides a REST API and web UI for creating, reading, updating, deleting, and
searching code snippets. The project uses an agentic pipeline where issues are
auto-generated from PRDs and implemented by AI agents. Follow `AGENTS.md` for
full coding standards.

## Tech Stack
- **Runtime**: Node.js with TypeScript (strict mode, ES2022 target)
- **Framework**: Express 4
- **Testing**: Vitest with supertest for HTTP assertions
- **Build**: `tsc` (TypeScript compiler)
- **Module system**: CommonJS

## Project Structure
```
src/
  app.ts              # Express app setup and route definitions
  server.ts           # HTTP server entry point (listens on PORT)
  models/
    snippet.ts        # Snippet interface
  store/
    snippet-store.ts  # In-memory data store with CRUD + search
  tests/
    *.test.ts         # Vitest test files using supertest
public/               # Static frontend assets (HTML/CSS/JS)
docs/                 # PRDs and plans
```

## Build, Test & Lint
- **Build**: `npm run build` — compiles TypeScript to `dist/`
- **Test**: `npm test` — runs Vitest in run mode
- **Lint**: `npm run lint` — runs `tsc --noEmit` for type checking
- **Dev**: `npm run dev` — starts dev server with tsx watch

## Coding Conventions
- Use TypeScript strict mode; do not use `any` unless unavoidable
- Keep functions small and single-purpose
- Follow existing naming conventions (camelCase for variables/functions,
  PascalCase for types/interfaces/classes)
- Add comments only for non-obvious logic
- Use `interface` for data shapes (see `src/models/snippet.ts`)
- Prefer `const` over `let`; never use `var`

## Testing Patterns
- Tests live in `src/tests/` and use the `*.test.ts` naming convention
- Use `supertest` for API endpoint tests, importing `app` from `../app`
- Use `vitest` globals (`describe`, `it`, `expect`) — globals are enabled
- Each test file should reset shared state (e.g., the snippet store) between
  tests using `beforeEach`
- Write tests for all new functionality

## API Design Patterns
- RESTful routes under `/api/` (e.g., `/api/snippets`, `/api/tags`)
- Return JSON responses with appropriate HTTP status codes
- Validate required fields and return `400` with `{ error: "..." }` on failure
- Return `404` with `{ error: "..." }` when a resource is not found
- Return `201` for successful creation, `204` for successful deletion

## Definition of Done
1. Code compiles without errors (`npm run lint`)
2. All tests pass (`npm test`)
3. New tests for new functionality
4. PR body includes `Closes #N` referencing the source issue
5. PR description explains changes

## Restrictions
- Do not modify `.github/workflows/` files
- Do not add dependencies without noting in PR
- Do not refactor outside issue scope
- Do not change dependency versions without explicit instruction
