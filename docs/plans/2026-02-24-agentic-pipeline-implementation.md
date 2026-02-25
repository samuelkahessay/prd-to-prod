# Agentic Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript CLI that uses the Copilot SDK to parse PRDs into GitHub Issues and orchestrate the Copilot Coding Agent to autonomously open PRs.

**Architecture:** Copilot SDK orchestrator with 4 custom tools (parse_prd, create_github_issue, trigger_agent_on_issue, check_pipeline_status) + 2 GitHub Actions workflows (assign-to-agent, pr-lifecycle) + agent configuration files.

**Tech Stack:** TypeScript, `@github/copilot-sdk`, `@octokit/rest`, `@octokit/graphql`, `zod`, `commander`, `chalk`, `dotenv`

**Design doc:** `docs/plans/2026-02-24-agentic-pipeline-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Create package.json**

```json
{
  "name": "agentic-pipeline",
  "version": "0.1.0",
  "description": "Autonomous GitHub development pipeline powered by Copilot SDK",
  "type": "module",
  "bin": {
    "agentic-pipeline": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@github/copilot-sdk": "latest",
    "@octokit/graphql": "^8.0.0",
    "@octokit/rest": "^21.0.0",
    "chalk": "^5.3.0",
    "commander": "^12.0.0",
    "dotenv": "^16.4.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "eslint": "^9.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.env
*.tgz
.DS_Store
```

**Step 4: Create .env.example**

```bash
# Required: GitHub PAT with repo, project, issues, pull_requests scopes
GITHUB_TOKEN=ghp_xxxxx

# Optional: separate token for Copilot SDK (defaults to GITHUB_TOKEN)
COPILOT_GITHUB_TOKEN=

# Default target repository (owner/repo format)
TARGET_REPO=

# GitHub Projects v2 board number (optional — for board sync)
PROJECT_NUMBER=
```

**Step 5: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated

**Step 6: Verify TypeScript compiles (empty)**

Run: `mkdir -p src && echo 'console.log("ok");' > src/index.ts && npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add package.json tsconfig.json .gitignore .env.example package-lock.json
git commit -m "chore: scaffold project with dependencies"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

**Step 1: Write the types file**

```typescript
export interface PipelineConfig {
  owner: string;
  repo: string;
  projectNumber?: number;
  model?: string;
}

export interface ParsedTask {
  title: string;
  body: string;
  labels: string[];
  dependsOn: number[]; // issue numbers this task depends on
}

export interface CreatedIssue {
  number: number;
  url: string;
  title: string;
  nodeId: string;
}

export interface PipelineStatus {
  total: number;
  queued: number;      // agent-ready
  inProgress: number;  // agent-assigned
  inReview: number;    // in-review
  completed: number;   // agent-completed
  issues: IssueStatus[];
}

export interface IssueStatus {
  number: number;
  title: string;
  state: "open" | "closed";
  label: "agent-ready" | "agent-assigned" | "in-review" | "agent-completed" | "none";
  prNumber?: number;
  prState?: "open" | "merged" | "closed";
  prUrl?: string;
}

export const PIPELINE_LABELS = {
  AGENT_READY: "agent-ready",
  AGENT_ASSIGNED: "agent-assigned",
  IN_REVIEW: "in-review",
  AGENT_COMPLETED: "agent-completed",
} as const;
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared type definitions"
```

---

## Task 3: GitHub Client (Octokit Wrapper)

**Files:**
- Create: `src/github/client.ts`
- Create: `src/github/__tests__/client.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubClient } from "../client.js";

// Mock Octokit
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      issues: {
        create: vi.fn().mockResolvedValue({
          data: { number: 1, html_url: "https://github.com/test/repo/issues/1", title: "Test", node_id: "I_1" },
        }),
        addLabels: vi.fn().mockResolvedValue({}),
        removeLabel: vi.fn().mockResolvedValue({}),
        listForRepo: vi.fn().mockResolvedValue({ data: [] }),
        createComment: vi.fn().mockResolvedValue({}),
        addAssignees: vi.fn().mockResolvedValue({}),
      },
      pulls: {
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
      search: {
        issuesAndPullRequests: vi.fn().mockResolvedValue({ data: { items: [] } }),
      },
    },
  })),
}));

describe("GitHubClient", () => {
  let client: GitHubClient;

  beforeEach(() => {
    client = new GitHubClient("fake-token", "test", "repo");
  });

  it("creates an issue with labels", async () => {
    const result = await client.createIssue({
      title: "Test issue",
      body: "Test body",
      labels: ["agent-ready"],
    });
    expect(result.number).toBe(1);
    expect(result.url).toContain("github.com");
  });

  it("adds a label to an issue", async () => {
    await expect(client.addLabel(1, "agent-ready")).resolves.not.toThrow();
  });

  it("removes a label from an issue (ignores 404)", async () => {
    await expect(client.removeLabel(1, "old-label")).resolves.not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/github/__tests__/client.test.ts`
Expected: FAIL — `GitHubClient` not found

**Step 3: Write the implementation**

```typescript
import { Octokit } from "@octokit/rest";

interface CreateIssueParams {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

export class GitHubClient {
  private octokit: Octokit;

  constructor(
    token: string,
    public readonly owner: string,
    public readonly repo: string,
  ) {
    this.octokit = new Octokit({ auth: token });
  }

  async createIssue(params: CreateIssueParams) {
    const { data } = await this.octokit.rest.issues.create({
      owner: this.owner,
      repo: this.repo,
      title: params.title,
      body: params.body,
      labels: params.labels,
      assignees: params.assignees,
    });
    return {
      number: data.number,
      url: data.html_url,
      title: data.title,
      nodeId: data.node_id,
    };
  }

  async addLabel(issueNumber: number, label: string) {
    await this.octokit.rest.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      labels: [label],
    });
  }

  async removeLabel(issueNumber: number, label: string) {
    try {
      await this.octokit.rest.issues.removeLabel({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        name: label,
      });
    } catch {
      // Ignore 404 if label doesn't exist
    }
  }

  async addComment(issueNumber: number, body: string) {
    await this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body,
    });
  }

  async getIssuesByLabel(label: string) {
    const { data } = await this.octokit.rest.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      labels: label,
      state: "all",
      per_page: 100,
    });
    return data;
  }

  async getPullsForIssue(issueNumber: number) {
    const { data } = await this.octokit.rest.search.issuesAndPullRequests({
      q: `repo:${this.owner}/${this.repo} is:pr linked:${issueNumber}`,
    });
    return data.items;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/github/__tests__/client.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/github/client.ts src/github/__tests__/client.test.ts
git commit -m "feat: add GitHub client with Octokit wrapper"
```

---

## Task 4: Projects v2 GraphQL Helper

**Files:**
- Create: `src/github/projects.ts`

**Step 1: Write the implementation**

This module is only called when `PROJECT_NUMBER` is configured. It uses `@octokit/graphql` directly.

```typescript
import { graphql } from "@octokit/graphql";

export class ProjectsClient {
  private gql: typeof graphql;

  constructor(
    token: string,
    private owner: string,
    private projectNumber: number,
  ) {
    this.gql = graphql.defaults({
      headers: { authorization: `token ${token}` },
    });
  }

  async getProjectId(): Promise<string> {
    const { user } = await this.gql<{
      user: { projectV2: { id: string } };
    }>(
      `query($owner: String!, $number: Int!) {
        user(login: $owner) {
          projectV2(number: $number) { id }
        }
      }`,
      { owner: this.owner, number: this.projectNumber },
    );
    return user.projectV2.id;
  }

  async addItemToProject(projectId: string, contentId: string): Promise<string> {
    const { addProjectV2ItemById } = await this.gql<{
      addProjectV2ItemById: { item: { id: string } };
    }>(
      `mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
          item { id }
        }
      }`,
      { projectId, contentId },
    );
    return addProjectV2ItemById.item.id;
  }

  async getStatusField(projectId: string) {
    const { node } = await this.gql<{
      node: {
        fields: {
          nodes: Array<{
            id: string;
            name: string;
            options?: Array<{ id: string; name: string }>;
          }>;
        };
      };
    }>(
      `query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 20) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options { id name }
                }
              }
            }
          }
        }
      }`,
      { projectId },
    );
    return node.fields.nodes.find((f) => f.name === "Status");
  }

  async updateItemStatus(
    projectId: string,
    itemId: string,
    fieldId: string,
    optionId: string,
  ) {
    await this.gql(
      `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { singleSelectOptionId: $optionId }
        }) {
          projectV2Item { id }
        }
      }`,
      { projectId, itemId, fieldId, optionId },
    );
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/github/projects.ts
git commit -m "feat: add Projects v2 GraphQL helper"
```

---

## Task 5: parse_prd Tool

**Files:**
- Create: `src/tools/parse-prd.ts`
- Create: `src/tools/__tests__/parse-prd.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createParsePrdTool } from "../parse-prd.js";
import * as fs from "node:fs/promises";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("# PRD: Test App\n\n## Features\n\n### Feature 1: Hello endpoint\nBuild a GET /hello endpoint"),
}));

describe("parse_prd tool", () => {
  it("returns a Tool object with correct name", () => {
    const tool = createParsePrdTool();
    // Tool is created via defineTool, it should be a valid object
    expect(tool).toBeDefined();
  });

  it("handler reads the file and returns content", async () => {
    const tool = createParsePrdTool();
    // Access the handler directly for testing
    const result = await (tool as any).handler(
      { filePath: "/tmp/test.md" },
      { sessionId: "test", toolCallId: "tc1", toolName: "parse_prd", arguments: {} },
    );
    expect(result.prdContent).toContain("PRD: Test App");
    expect(fs.readFile).toHaveBeenCalledWith("/tmp/test.md", "utf-8");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/__tests__/parse-prd.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";
import { readFile } from "node:fs/promises";

export function createParsePrdTool() {
  return defineTool("parse_prd", {
    description:
      "Read a Product Requirements Document (PRD) markdown file from the local filesystem. " +
      "Returns the raw content for you to decompose into atomic development tasks. " +
      "After reading, you should analyze the PRD and call create_github_issue for each task.",
    parameters: z.object({
      filePath: z.string().describe("Absolute path to the PRD markdown file"),
    }),
    handler: async ({ filePath }) => {
      const content = await readFile(filePath, "utf-8");
      return {
        prdContent: content,
        instructions:
          "Decompose this PRD into atomic development tasks. Each task should be:\n" +
          "- Completable by one developer in 1-4 hours\n" +
          "- Include clear acceptance criteria as a checklist\n" +
          "- Specify dependencies on other tasks (by title)\n" +
          "- Be labeled by type: feature, test, docs, or infra\n" +
          "Call create_github_issue for each task, respecting dependency order.",
      };
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/__tests__/parse-prd.test.ts`
Expected: PASS

> Note: If `@github/copilot-sdk` is not installed or `defineTool` fails at import, mock it:
> `vi.mock("@github/copilot-sdk", () => ({ defineTool: vi.fn((name, config) => ({ name, ...config })) }));`

**Step 5: Commit**

```bash
git add src/tools/parse-prd.ts src/tools/__tests__/parse-prd.test.ts
git commit -m "feat: add parse_prd tool for PRD file reading"
```

---

## Task 6: create_github_issue Tool

**Files:**
- Create: `src/tools/create-issue.ts`
- Create: `src/tools/__tests__/create-issue.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createIssueTool } from "../create-issue.js";
import { GitHubClient } from "../../github/client.js";

vi.mock("@github/copilot-sdk", () => ({
  defineTool: vi.fn((name, config) => ({ name, ...config })),
}));

vi.mock("../../github/client.js");

describe("create_github_issue tool", () => {
  const mockClient = {
    createIssue: vi.fn().mockResolvedValue({
      number: 42,
      url: "https://github.com/test/repo/issues/42",
      title: "Test issue",
      nodeId: "I_42",
    }),
  } as unknown as GitHubClient;

  it("creates an issue with dependency checklist in body", async () => {
    const tool = createIssueTool(mockClient);
    const result = await (tool as any).handler(
      {
        title: "Add GET /tasks endpoint",
        body: "## Acceptance Criteria\n- [ ] Returns JSON array",
        labels: ["feature"],
        dependsOn: [1, 2],
      },
      { sessionId: "s", toolCallId: "t", toolName: "create_github_issue", arguments: {} },
    );

    expect(mockClient.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Add GET /tasks endpoint",
      }),
    );
    expect(result.issueNumber).toBe(42);
  });

  it("prepends dependency checklist to issue body", async () => {
    const tool = createIssueTool(mockClient);
    await (tool as any).handler(
      {
        title: "Test",
        body: "Content",
        labels: [],
        dependsOn: [1],
      },
      { sessionId: "s", toolCallId: "t", toolName: "create_github_issue", arguments: {} },
    );

    const callArgs = (mockClient.createIssue as any).mock.calls[1][0];
    expect(callArgs.body).toContain("Depends on");
    expect(callArgs.body).toContain("#1");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/__tests__/create-issue.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

```typescript
import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";
import { GitHubClient } from "../github/client.js";

export function createIssueTool(github: GitHubClient) {
  return defineTool("create_github_issue", {
    description:
      "Create a GitHub issue for a development task. " +
      "Include clear acceptance criteria in the body. " +
      "Specify dependencies as issue numbers that must be completed first.",
    parameters: z.object({
      title: z.string().describe("Concise issue title"),
      body: z
        .string()
        .describe("Issue body with acceptance criteria as a markdown checklist"),
      labels: z
        .array(z.string())
        .default([])
        .describe("Labels: feature, test, docs, infra"),
      dependsOn: z
        .array(z.number())
        .default([])
        .describe("Issue numbers this task depends on"),
    }),
    handler: async ({ title, body, labels, dependsOn }) => {
      let fullBody = body;

      if (dependsOn.length > 0) {
        const depList = dependsOn.map((n) => `- [ ] #${n}`).join("\n");
        fullBody = `### Dependencies\n${depList}\n\n${body}`;
      }

      const issue = await github.createIssue({
        title,
        body: fullBody,
        labels,
      });

      return {
        issueNumber: issue.number,
        issueUrl: issue.url,
        issueTitle: issue.title,
        nodeId: issue.nodeId,
      };
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/__tests__/create-issue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/create-issue.ts src/tools/__tests__/create-issue.test.ts
git commit -m "feat: add create_github_issue tool"
```

---

## Task 7: trigger_agent_on_issue Tool

**Files:**
- Create: `src/tools/trigger-agent.ts`

**Step 1: Write the implementation**

```typescript
import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";
import { GitHubClient } from "../github/client.js";
import { PIPELINE_LABELS } from "../types.js";

export function createTriggerAgentTool(github: GitHubClient) {
  return defineTool("trigger_agent_on_issue", {
    description:
      "Label a GitHub issue as 'agent-ready' to trigger the Copilot Coding Agent. " +
      "Only trigger issues whose dependencies are all resolved. " +
      "Optionally post extra instructions as a comment.",
    parameters: z.object({
      issueNumber: z.number().describe("The issue number to trigger"),
      customInstructions: z
        .string()
        .optional()
        .describe("Extra context for the coding agent beyond the issue body"),
    }),
    handler: async ({ issueNumber, customInstructions }) => {
      await github.addLabel(issueNumber, PIPELINE_LABELS.AGENT_READY);

      if (customInstructions) {
        await github.addComment(
          issueNumber,
          `**Agent Instructions:**\n\n${customInstructions}`,
        );
      }

      return {
        issueNumber,
        status: "triggered",
        message: `Issue #${issueNumber} labeled '${PIPELINE_LABELS.AGENT_READY}'. The assign-to-agent workflow will pick it up.`,
      };
    },
  });
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/trigger-agent.ts
git commit -m "feat: add trigger_agent_on_issue tool"
```

---

## Task 8: check_pipeline_status Tool

**Files:**
- Create: `src/tools/check-status.ts`

**Step 1: Write the implementation**

```typescript
import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";
import { GitHubClient } from "../github/client.js";
import { PIPELINE_LABELS, type IssueStatus, type PipelineStatus } from "../types.js";

export function createCheckStatusTool(github: GitHubClient) {
  return defineTool("check_pipeline_status", {
    description:
      "Check the status of all agent-managed issues and their linked PRs. " +
      "Returns a summary with counts per stage and details for each issue.",
    parameters: z.object({
      onlyOpen: z
        .boolean()
        .default(true)
        .describe("Only show open/in-progress issues"),
    }),
    handler: async ({ onlyOpen }) => {
      const allLabels = Object.values(PIPELINE_LABELS);
      const issues: IssueStatus[] = [];

      for (const label of allLabels) {
        const labeledIssues = await github.getIssuesByLabel(label);

        for (const issue of labeledIssues) {
          if (onlyOpen && issue.state === "closed" && label !== PIPELINE_LABELS.AGENT_COMPLETED) {
            continue;
          }

          const entry: IssueStatus = {
            number: issue.number,
            title: issue.title,
            state: issue.state as "open" | "closed",
            label: label as IssueStatus["label"],
          };

          // Check for linked PRs
          if (label === PIPELINE_LABELS.IN_REVIEW || label === PIPELINE_LABELS.AGENT_ASSIGNED) {
            const prs = await github.getPullsForIssue(issue.number);
            if (prs.length > 0) {
              const pr = prs[0];
              entry.prNumber = pr.number;
              entry.prUrl = pr.html_url;
              entry.prState = pr.pull_request?.merged_at
                ? "merged"
                : (pr.state as "open" | "closed");
            }
          }

          issues.push(entry);
        }
      }

      const status: PipelineStatus = {
        total: issues.length,
        queued: issues.filter((i) => i.label === PIPELINE_LABELS.AGENT_READY).length,
        inProgress: issues.filter((i) => i.label === PIPELINE_LABELS.AGENT_ASSIGNED).length,
        inReview: issues.filter((i) => i.label === PIPELINE_LABELS.IN_REVIEW).length,
        completed: issues.filter((i) => i.label === PIPELINE_LABELS.AGENT_COMPLETED).length,
        issues,
      };

      return status;
    },
  });
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/check-status.ts
git commit -m "feat: add check_pipeline_status tool"
```

---

## Task 9: Orchestrator (Copilot SDK Session)

**Files:**
- Create: `src/orchestrator.ts`

**Step 1: Write the implementation**

This is the core module — it creates a Copilot SDK session with all 4 tools and the system prompt.

```typescript
import { CopilotClient, approveAll } from "@github/copilot-sdk";
import chalk from "chalk";
import { GitHubClient } from "./github/client.js";
import { ProjectsClient } from "./github/projects.js";
import { createParsePrdTool } from "./tools/parse-prd.js";
import { createIssueTool } from "./tools/create-issue.js";
import { createTriggerAgentTool } from "./tools/trigger-agent.js";
import { createCheckStatusTool } from "./tools/check-status.js";
import type { PipelineConfig } from "./types.js";

const SYSTEM_MESSAGE = `You are a project manager agent for an autonomous GitHub development pipeline.

Your capabilities:
1. parse_prd — Read a PRD file and decompose it into atomic development tasks
2. create_github_issue — Create GitHub issues with acceptance criteria
3. trigger_agent_on_issue — Label issues for the Copilot Coding Agent to pick up
4. check_pipeline_status — Monitor progress of all pipeline issues

Rules:
- Each task should be completable by a single developer in 1-4 hours
- Include acceptance criteria as a markdown checklist in each issue body
- Respect task dependencies: don't trigger dependent tasks until prerequisites merge
- Include relevant technical context (file paths, API signatures, data models)
- Label tasks by type: feature, test, docs, infra
- Create infrastructure/scaffold tasks first, then features, then tests
- When creating issues, use "Closes #N" or dependency checklists to link related work

Workflow for "run" command:
1. Call parse_prd to read the PRD file
2. Analyze the content and identify atomic tasks with dependencies
3. Call create_github_issue for each task in dependency order
4. Call trigger_agent_on_issue for tasks with no blockers
5. Report the final status`;

export async function runPipeline(prdPath: string, config: PipelineConfig) {
  const github = new GitHubClient(
    process.env.GITHUB_TOKEN!,
    config.owner,
    config.repo,
  );

  const client = new CopilotClient({
    githubToken: process.env.COPILOT_GITHUB_TOKEN || process.env.GITHUB_TOKEN,
    logLevel: "info",
  });

  try {
    await client.start();
    console.log(chalk.green("Copilot SDK connected"));

    const tools = [
      createParsePrdTool(),
      createIssueTool(github),
      createTriggerAgentTool(github),
      createCheckStatusTool(github),
    ];

    const session = await client.createSession({
      model: config.model || "gpt-4.1",
      streaming: true,
      tools,
      systemMessage: { content: SYSTEM_MESSAGE },
      workingDirectory: process.cwd(),
      onPermissionRequest: approveAll,
    });

    // Stream output
    session.on("assistant.message_delta", (event) => {
      process.stdout.write(event.data.deltaContent);
    });

    session.on("tool.execution_start", (event) => {
      console.log(chalk.cyan(`\n  → ${event.data.toolName}...`));
    });

    session.on("tool.execution_complete", (event) => {
      const icon = event.data.success ? chalk.green("✓") : chalk.red("✗");
      console.log(`  ${icon} ${event.data.toolCallId}`);
    });

    const prompt = `Parse the PRD at "${prdPath}" and create GitHub issues in the repository ${config.owner}/${config.repo}. Trigger the coding agent on all tasks that have no dependencies.`;

    console.log(chalk.blue(`\nRunning pipeline for ${config.owner}/${config.repo}...\n`));

    await session.sendAndWait({ prompt }, 300_000);

    console.log(chalk.green("\n\nPipeline started."));

    await session.destroy();
    await client.stop();
  } catch (error) {
    console.error(chalk.red("Pipeline error:"), error);
    await client.forceStop();
    throw error;
  }
}

export async function checkStatus(config: PipelineConfig) {
  const github = new GitHubClient(
    process.env.GITHUB_TOKEN!,
    config.owner,
    config.repo,
  );

  const client = new CopilotClient({
    githubToken: process.env.COPILOT_GITHUB_TOKEN || process.env.GITHUB_TOKEN,
    logLevel: "error",
  });

  try {
    await client.start();

    const tools = [createCheckStatusTool(github)];

    const session = await client.createSession({
      model: config.model || "gpt-4.1",
      streaming: true,
      tools,
      systemMessage: {
        content:
          "You are a pipeline status reporter. Call check_pipeline_status and present a clear summary.",
      },
      onPermissionRequest: approveAll,
    });

    session.on("assistant.message_delta", (event) => {
      process.stdout.write(event.data.deltaContent);
    });

    await session.sendAndWait(
      { prompt: `Check the pipeline status for ${config.owner}/${config.repo}.` },
      60_000,
    );

    console.log();

    await session.destroy();
    await client.stop();
  } catch (error) {
    console.error(chalk.red("Status check error:"), error);
    await client.forceStop();
    throw error;
  }
}

export async function triggerIssue(issueNumber: number, config: PipelineConfig) {
  const github = new GitHubClient(
    process.env.GITHUB_TOKEN!,
    config.owner,
    config.repo,
  );

  await github.addLabel(issueNumber, "agent-ready");
  console.log(
    chalk.green(`Issue #${issueNumber} labeled 'agent-ready'. The workflow will assign Copilot.`),
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/orchestrator.ts
git commit -m "feat: add orchestrator with Copilot SDK session management"
```

---

## Task 10: CLI Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Write the implementation**

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import "dotenv/config";
import { runPipeline, checkStatus, triggerIssue } from "./orchestrator.js";
import type { PipelineConfig } from "./types.js";

function parseRepo(repo: string): { owner: string; repo: string } {
  const parts = repo.split("/");
  if (parts.length !== 2) {
    console.error(chalk.red(`Invalid repo format: "${repo}". Expected "owner/repo".`));
    process.exit(1);
  }
  return { owner: parts[0], repo: parts[1] };
}

function getConfig(repoFlag?: string, modelFlag?: string): PipelineConfig {
  const repoStr = repoFlag || process.env.TARGET_REPO;
  if (!repoStr) {
    console.error(chalk.red("No repo specified. Use --repo or set TARGET_REPO in .env"));
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN) {
    console.error(chalk.red("GITHUB_TOKEN not set. Create a .env file from .env.example"));
    process.exit(1);
  }

  const { owner, repo } = parseRepo(repoStr);
  return {
    owner,
    repo,
    model: modelFlag,
    projectNumber: process.env.PROJECT_NUMBER
      ? parseInt(process.env.PROJECT_NUMBER, 10)
      : undefined,
  };
}

const program = new Command()
  .name("agentic-pipeline")
  .description("Autonomous GitHub development pipeline powered by Copilot SDK")
  .version("0.1.0");

program
  .command("run <prd-file>")
  .description("Parse a PRD and create GitHub issues for the coding agent")
  .option("-r, --repo <owner/repo>", "Target GitHub repository")
  .option("-m, --model <model>", "AI model to use (default: gpt-4.1)")
  .action(async (prdFile: string, opts) => {
    const config = getConfig(opts.repo, opts.model);
    await runPipeline(prdFile, config);
  });

program
  .command("status")
  .description("Check pipeline progress")
  .option("-r, --repo <owner/repo>", "Target GitHub repository")
  .option("-m, --model <model>", "AI model to use")
  .action(async (opts) => {
    const config = getConfig(opts.repo, opts.model);
    await checkStatus(config);
  });

program
  .command("trigger <issue-number>")
  .description("Trigger the coding agent on a specific issue")
  .option("-r, --repo <owner/repo>", "Target GitHub repository")
  .action(async (issueNumber: string, opts) => {
    const config = getConfig(opts.repo);
    await triggerIssue(parseInt(issueNumber, 10), config);
  });

program
  .command("init")
  .description("Bootstrap a repo with pipeline labels and workflows")
  .option("-r, --repo <owner/repo>", "Target GitHub repository")
  .action(async (opts) => {
    const config = getConfig(opts.repo);
    console.log(chalk.blue("Run the bootstrap script to create labels:"));
    console.log(`  cd <repo> && bash scripts/bootstrap-labels.sh`);
    console.log(chalk.blue("\nCopy .github/ workflows to your target repo."));
    console.log(chalk.blue("Enable Copilot Coding Agent in repo Settings → Copilot."));
  });

program.parse();
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Test CLI help output**

Run: `npx tsx src/index.ts --help`
Expected: Shows usage with `run`, `status`, `trigger`, `init` commands

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add CLI entry point with commander"
```

---

## Task 11: GitHub Actions Workflows

**Files:**
- Create: `.github/workflows/assign-to-agent.yml`
- Create: `.github/workflows/pr-lifecycle.yml`

**Step 1: Create assign-to-agent.yml**

```yaml
name: Agent-Ready → Assign Copilot

on:
  issues:
    types: [opened, labeled]

jobs:
  assign:
    runs-on: ubuntu-latest
    if: |
      (github.event.action == 'labeled' && github.event.label.name == 'agent-ready') ||
      (github.event.action == 'opened' && contains(join(github.event.issue.labels.*.name, ','), 'agent-ready'))
    permissions:
      issues: write

    steps:
      - name: Assign Copilot coding agent
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const issue = context.issue.number;
            const repo = context.repo;

            try {
              await github.rest.issues.addAssignees({
                ...repo,
                issue_number: issue,
                assignees: ['copilot-swe-agent'],
              });
            } catch (e) {
              console.log(`Assignment failed: ${e.message}`);
              core.setFailed('Could not assign Copilot agent. Is Copilot Coding Agent enabled?');
              return;
            }

            // Swap labels
            await github.rest.issues.removeLabel({
              ...repo, issue_number: issue, name: 'agent-ready',
            }).catch(() => {});

            await github.rest.issues.addLabels({
              ...repo, issue_number: issue, labels: ['agent-assigned'],
            });

            await github.rest.issues.createComment({
              ...repo,
              issue_number: issue,
              body: '🤖 Copilot coding agent assigned. A PR will be opened when the work is complete.',
            });
```

**Step 2: Create pr-lifecycle.yml**

```yaml
name: PR Lifecycle → Labels + Issue Close

on:
  pull_request:
    types: [opened, closed]

jobs:
  pr-opened:
    if: |
      github.event.action == 'opened' &&
      startsWith(github.event.pull_request.head.ref, 'copilot/')
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: read

    steps:
      - name: Update linked issue to in-review
        uses: actions/github-script@v7
        with:
          script: |
            const body = context.payload.pull_request.body || '';
            const match = body.match(/(?:closes|fixes|resolves)\s+#(\d+)/i);
            if (!match) {
              console.log('No linked issue found in PR body');
              return;
            }
            const issueNumber = parseInt(match[1]);
            const repo = context.repo;

            await github.rest.issues.removeLabel({
              ...repo, issue_number: issueNumber, name: 'agent-assigned',
            }).catch(() => {});

            await github.rest.issues.addLabels({
              ...repo, issue_number: issueNumber, labels: ['in-review'],
            });

  pr-merged:
    if: |
      github.event.action == 'closed' &&
      github.event.pull_request.merged &&
      startsWith(github.event.pull_request.head.ref, 'copilot/')
    runs-on: ubuntu-latest
    permissions:
      issues: write

    steps:
      - name: Close linked issue and mark complete
        uses: actions/github-script@v7
        with:
          script: |
            const body = context.payload.pull_request.body || '';
            const match = body.match(/(?:closes|fixes|resolves)\s+#(\d+)/i);
            if (!match) return;
            const issueNumber = parseInt(match[1]);
            const repo = context.repo;

            await github.rest.issues.update({
              ...repo, issue_number: issueNumber,
              state: 'closed', state_reason: 'completed',
            });

            await github.rest.issues.addLabels({
              ...repo, issue_number: issueNumber, labels: ['agent-completed'],
            });
```

**Step 3: Commit**

```bash
git add .github/workflows/assign-to-agent.yml .github/workflows/pr-lifecycle.yml
git commit -m "feat: add GitHub Actions workflows for agent assignment and PR lifecycle"
```

---

## Task 12: Agent Configuration Files

**Files:**
- Create: `.github/copilot-instructions.md`
- Create: `.github/copilot-setup-steps.yml`

**Step 1: Create copilot-instructions.md**

```markdown
# Copilot Agent Instructions

## Project Overview
This is a project managed by the agentic-pipeline tool. Follow these instructions
when working on any assigned issue.

## Coding Standards
- Write tests for all new functionality
- Follow existing naming conventions in the codebase
- Keep functions small and single-purpose
- Add comments only for non-obvious logic
- Never push directly to main

## Build & Test Commands
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`

## Definition of Done
A task is complete when:
1. Code compiles without errors
2. All existing tests pass
3. New tests are written for new functionality
4. PR description explains what changed and why
5. PR body includes "Closes #N" referencing the issue

## What the Agent Should NOT Do
- Modify CI/CD pipeline files (.github/workflows/)
- Change dependency versions without explicit instruction
- Refactor code outside the scope of the assigned issue
- Add new dependencies without noting them in the PR description
```

**Step 2: Create copilot-setup-steps.yml**

```yaml
name: Copilot Setup Steps

on:
  workflow_call:

jobs:
  copilot-setup-steps:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci
```

**Step 3: Commit**

```bash
git add .github/copilot-instructions.md .github/copilot-setup-steps.yml
git commit -m "feat: add Copilot agent configuration files"
```

---

## Task 13: Bootstrap Labels Script

**Files:**
- Create: `scripts/bootstrap-labels.sh`

**Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Create pipeline labels for the agentic pipeline
# Usage: bash scripts/bootstrap-labels.sh

echo "Creating pipeline labels..."

gh label create "agent-ready" \
  --color "0075ca" \
  --description "Ready to be picked up by coding agent" \
  --force 2>/dev/null || true

gh label create "agent-assigned" \
  --color "e4e669" \
  --description "Coding agent is working on this" \
  --force 2>/dev/null || true

gh label create "in-review" \
  --color "d93f0b" \
  --description "Agent PR open, awaiting human review" \
  --force 2>/dev/null || true

gh label create "agent-completed" \
  --color "0e8a16" \
  --description "Completed by agent and merged" \
  --force 2>/dev/null || true

# Task type labels
gh label create "feature" \
  --color "a2eeef" \
  --description "New feature" \
  --force 2>/dev/null || true

gh label create "test" \
  --color "7057ff" \
  --description "Test coverage" \
  --force 2>/dev/null || true

gh label create "infra" \
  --color "fbca04" \
  --description "Infrastructure / scaffolding" \
  --force 2>/dev/null || true

gh label create "docs" \
  --color "0075ca" \
  --description "Documentation" \
  --force 2>/dev/null || true

echo "✓ Labels created"
```

**Step 2: Make executable**

Run: `chmod +x scripts/bootstrap-labels.sh`

**Step 3: Commit**

```bash
git add scripts/bootstrap-labels.sh
git commit -m "feat: add bootstrap labels script"
```

---

## Task 14: Sample PRD Template

**Files:**
- Create: `templates/sample-prd.md`

**Step 1: Write the sample PRD**

```markdown
# PRD: Task Management API

## Overview
Build a simple REST API for managing tasks. This serves as a test project for the
agentic pipeline — the Copilot Coding Agent will implement each feature from issues
created by the orchestrator.

## Tech Stack
- Runtime: Node.js 20+
- Framework: Express.js
- Language: TypeScript
- Testing: Vitest
- Storage: In-memory (Map)

## Features

### Feature 1: Project Scaffold
Set up the Express + TypeScript project structure with a health check endpoint.

**Acceptance Criteria:**
- [ ] `package.json` with Express, TypeScript, Vitest dependencies
- [ ] `tsconfig.json` configured for ES modules
- [ ] `src/app.ts` with Express app setup
- [ ] `src/server.ts` entry point listening on PORT env var (default 3000)
- [ ] `GET /health` returns `{ status: "ok" }`
- [ ] Basic test for health endpoint

### Feature 2: Create Task Endpoint
Add `POST /tasks` to create a new task.

**Acceptance Criteria:**
- [ ] Request body: `{ title: string, description?: string }`
- [ ] Returns 201 with `{ id, title, description, status: "todo", createdAt }`
- [ ] Returns 400 if title is missing
- [ ] Task stored in memory with unique ID
- [ ] Tests for success and validation cases

### Feature 3: List Tasks Endpoint
Add `GET /tasks` to list all tasks.

**Acceptance Criteria:**
- [ ] Returns 200 with `{ tasks: [...] }`
- [ ] Supports `?status=todo|in_progress|done` filter
- [ ] Returns empty array when no tasks exist
- [ ] Tests for empty, filtered, and unfiltered cases

### Feature 4: Update Task Status Endpoint
Add `PATCH /tasks/:id` to update a task's status.

**Acceptance Criteria:**
- [ ] Request body: `{ status: "todo" | "in_progress" | "done" }`
- [ ] Returns 200 with updated task
- [ ] Returns 404 if task not found
- [ ] Returns 400 if status is invalid
- [ ] Tests for success, not found, and validation cases

### Feature 5: Delete Task Endpoint
Add `DELETE /tasks/:id` to remove a task.

**Acceptance Criteria:**
- [ ] Returns 204 on success
- [ ] Returns 404 if task not found
- [ ] Tests for success and not found cases

## Non-Functional Requirements
- All endpoints return JSON with `Content-Type: application/json`
- Error responses follow `{ error: string }` format
- No authentication required (test project)

## Out of Scope
- Persistent storage / database
- Authentication / authorization
- Deployment / Docker
- Rate limiting
```

**Step 2: Commit**

```bash
git add templates/sample-prd.md
git commit -m "feat: add sample PRD template for testing"
```

---

## Task 15: README

**Files:**
- Create: `README.md`

**Step 1: Write the README**

```markdown
# Agentic Pipeline

Autonomous GitHub development pipeline powered by the Copilot SDK.

Feed it a PRD → it creates GitHub Issues → Copilot Coding Agent writes code → PRs open for review.

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USER/agentic-pipeline.git
cd agentic-pipeline
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your GitHub PAT and target repo

# 3. Bootstrap labels in your target repo
cd /path/to/target-repo
bash /path/to/agentic-pipeline/scripts/bootstrap-labels.sh

# 4. Enable Copilot Coding Agent
# Go to target repo → Settings → Copilot → Coding Agent → Enable

# 5. Copy workflows to target repo
cp -r .github/workflows /path/to/target-repo/.github/workflows/
cp .github/copilot-instructions.md /path/to/target-repo/.github/
cp .github/copilot-setup-steps.yml /path/to/target-repo/.github/

# 6. Run the pipeline
npx tsx src/index.ts run templates/sample-prd.md --repo owner/repo
```

## Commands

| Command | Description |
|---|---|
| `run <prd-file> --repo <owner/repo>` | Parse PRD, create issues, trigger agent |
| `status --repo <owner/repo>` | Check pipeline progress |
| `trigger <issue-number> --repo <owner/repo>` | Trigger agent on existing issue |
| `init --repo <owner/repo>` | Show setup instructions |

## How It Works

1. **You run** `agentic-pipeline run PRD.md --repo owner/repo`
2. **Copilot SDK** reads the PRD, decomposes it into tasks, creates GitHub Issues
3. **GitHub Actions** detect `agent-ready` label → assign Copilot Coding Agent
4. **Copilot** writes code, runs tests, opens PRs
5. **You review** and merge. Pipeline tracks progress end-to-end.

## Requirements

- Node.js 20+
- GitHub Copilot Pro+ or Business plan
- Copilot CLI installed (`npm install -g @anthropic-ai/copilot-cli` or via GitHub)
- GitHub PAT with `repo`, `project` scopes

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions"
```

---

## Task 16: Create Public GitHub Repository and Push

**Step 1: Create the repo**

Run: `gh repo create agentic-pipeline --public --source=. --push`

This creates the public repo, sets the remote, and pushes all commits.

**Step 2: Verify**

Run: `gh repo view --web`
Expected: Opens the repo in browser with all files visible.

---

## Task 17: End-to-End Smoke Test

**Step 1: Build the project**

Run: `npm run build`
Expected: `dist/` directory created with compiled JS

**Step 2: Test CLI help**

Run: `npx tsx src/index.ts --help`
Expected: Shows all 4 commands with descriptions

**Step 3: Test with sample PRD (dry run)**

This step requires Copilot CLI to be installed and authenticated. If it's not available yet, skip to Task 16 and verify the build/types/tests pass.

Run: `npx tsx src/index.ts run templates/sample-prd.md --repo YOUR_USER/agentic-pipeline`

Expected:
- Copilot SDK connects
- PRD is parsed
- 5-6 issues created
- First batch labeled `agent-ready`
- assign-to-agent workflow triggers

**Step 4: Verify issues in GitHub**

Run: `gh issue list --label agent-ready`
Expected: Shows issues created by the pipeline

**Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix: adjustments from smoke test" && git push
```
