# PRD: Task Management API

## Overview
Build a simple REST API for managing tasks. This is a test project for the
agentic pipeline — the repo-assist workflow will implement each feature.

## Tech Stack
- Runtime: Node.js 20+
- Framework: Express.js
- Language: TypeScript
- Testing: Vitest
- Storage: In-memory (Map)

## Features

### Feature 1: Project Scaffold
Set up the Express + TypeScript project with a health check endpoint.

**Acceptance Criteria:**
- [ ] package.json with Express, TypeScript, Vitest
- [ ] tsconfig.json for ES modules
- [ ] src/app.ts with Express app
- [ ] src/server.ts listening on PORT (default 3000)
- [ ] GET /health returns { status: "ok" }
- [ ] Test for health endpoint

### Feature 2: Create Task
POST /tasks — create a new task.

**Acceptance Criteria:**
- [ ] Request: { title: string, description?: string }
- [ ] Response 201: { id, title, description, status: "todo", createdAt }
- [ ] Response 400 if title missing
- [ ] Unique ID generation
- [ ] Tests for success and validation

### Feature 3: List Tasks
GET /tasks — list all tasks.

**Acceptance Criteria:**
- [ ] Response 200: { tasks: [...] }
- [ ] Support ?status=todo|in_progress|done filter
- [ ] Empty array when no tasks
- [ ] Tests for filtered and unfiltered

### Feature 4: Update Task Status
PATCH /tasks/:id — update status.

**Acceptance Criteria:**
- [ ] Request: { status: "todo" | "in_progress" | "done" }
- [ ] Response 200 with updated task
- [ ] Response 404 if not found
- [ ] Response 400 if invalid status
- [ ] Tests for all cases

### Feature 5: Delete Task
DELETE /tasks/:id — remove a task.

**Acceptance Criteria:**
- [ ] Response 204 on success
- [ ] Response 404 if not found
- [ ] Tests for both cases

## Non-Functional Requirements
- JSON responses with Content-Type header
- Error format: { error: string }
- No authentication needed

## Out of Scope
- Database / persistent storage
- Authentication
- Deployment
