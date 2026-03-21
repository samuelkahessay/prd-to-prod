const crypto = require("crypto");
const sodium = require("libsodium-wrappers");

const GITHUB_API = "https://api.github.com";

function createGitHubClient() {
  const appId = process.env.PIPELINE_APP_ID;
  const appPrivateKey = process.env.PIPELINE_APP_PRIVATE_KEY;

  async function generateAppJwt() {
    if (!appId || !appPrivateKey) {
      throw new Error("PIPELINE_APP_ID and PIPELINE_APP_PRIVATE_KEY are required");
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = { iss: appId, iat: now - 60, exp: now + 600 };

    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;

    const sign = crypto.createSign("RSA-SHA256");
    sign.update(signingInput);
    const signature = base64url(sign.sign(appPrivateKey));

    return `${signingInput}.${signature}`;
  }

  async function getInstallationToken(installationId) {
    const jwt = await generateAppJwt();
    const res = await githubFetch(
      `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
      { method: "POST", headers: { Authorization: `Bearer ${jwt}` } }
    );
    return res.token;
  }

  async function checkAppInstallation(owner, repo) {
    try {
      const jwt = await generateAppJwt();
      const res = await githubFetch(
        `${GITHUB_API}/repos/${owner}/${repo}/installation`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      return { installed: true, installationId: res.id };
    } catch {
      return { installed: false, installationId: null };
    }
  }

  async function createRepoFromTemplate(token, { templateOwner, templateRepo, owner, name, isPrivate }) {
    return githubFetch(
      `${GITHUB_API}/repos/${templateOwner}/${templateRepo}/generate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          owner,
          name,
          private: isPrivate,
          include_all_branches: false,
        },
      }
    );
  }

  async function waitForRepo(token, owner, repo, maxAttempts = 15) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await githubFetch(
          `${GITHUB_API}/repos/${owner}/${repo}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch {
        await sleep(2000);
      }
    }
    throw new Error(`Repository ${owner}/${repo} was not ready after ${maxAttempts} attempts`);
  }

  async function createLabel(token, owner, repo, { name, color, description }) {
    try {
      return await githubFetch(
        `${GITHUB_API}/repos/${owner}/${repo}/labels`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: { name, color, description },
        }
      );
    } catch {
      // Label may already exist
    }
  }

  async function configureActionsPermissions(token, owner, repo) {
    await githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/permissions/workflow`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          default_workflow_permissions: "write",
          can_approve_pull_request_reviews: true,
        },
      }
    );
  }

  async function enableAutoMerge(token, owner, repo) {
    await githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: { allow_auto_merge: true },
      }
    );
  }

  async function createIssue(token, owner, repo, { title, body, labels }) {
    return githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/issues`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { title, body, labels },
      }
    );
  }

  async function createIssueComment(token, owner, repo, issueNumber, body) {
    return githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { body },
      }
    );
  }

  async function upsertActionsVariable(token, owner, repo, { name, value }) {
    try {
      return await githubFetch(
        `${GITHUB_API}/repos/${owner}/${repo}/actions/variables/${name}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: { name, value },
        }
      );
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
    }

    return githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/variables`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { name, value },
      }
    );
  }

  async function createOrUpdateActionsSecret(token, owner, repo, { name, value }) {
    await sodium.ready;
    const key = await githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/secrets/public-key`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const encrypted = sodium.crypto_box_seal(
      Buffer.from(String(value)),
      sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL)
    );

    return githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/secrets/${name}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          encrypted_value: sodium.to_base64(
            encrypted,
            sodium.base64_variants.ORIGINAL
          ),
          key_id: key.key_id,
        },
      }
    );
  }

  async function getBranchRef(token, owner, repo, branch) {
    return githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  async function ensureRepoMemoryBranch(token, owner, repo, {
    branch = "memory/repo-assist",
    seedPath = "state.json",
    seedContent = JSON.stringify(
      { initialized: true, note: "Seeded by public beta bootstrap" },
      null,
      2
    ) + "\n",
  } = {}) {
    try {
      await getBranchRef(token, owner, repo, branch);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }

      const repoData = await githubFetch(
        `${GITHUB_API}/repos/${owner}/${repo}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const baseRef = await getBranchRef(token, owner, repo, repoData.default_branch);
      try {
        await githubFetch(
          `${GITHUB_API}/repos/${owner}/${repo}/git/refs`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: {
              ref: `refs/heads/${branch}`,
              sha: baseRef.object.sha,
            },
          }
        );
      } catch (refError) {
        if (refError.status === 422) {
          // Branch was created by a concurrent request — safe to continue
        } else {
          throw refError;
        }
      }
    }

    let existingSha = null;
    try {
      const existing = await githubFetch(
        `${GITHUB_API}/repos/${owner}/${repo}/contents/${seedPath}?ref=${encodeURIComponent(branch)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      existingSha = existing.sha || null;
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
    }

    return githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${seedPath}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          message: "Seed repo memory",
          content: Buffer.from(seedContent).toString("base64"),
          branch,
          ...(existingSha ? { sha: existingSha } : {}),
        },
      }
    );
  }

  async function ensureBranchProtection(token, owner, repo, {
    branch = "main",
    requiredStatusChecks = ["review"],
  } = {}) {
    return githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/branches/${branch}/protection`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          required_status_checks: {
            strict: false,
            contexts: requiredStatusChecks,
          },
          enforce_admins: false,
          required_pull_request_reviews: {
            dismiss_stale_reviews: false,
            require_code_owner_reviews: false,
            required_approving_review_count: 1,
          },
          restrictions: null,
          required_linear_history: false,
          allow_force_pushes: false,
          allow_deletions: false,
          block_creations: false,
          required_conversation_resolution: false,
          lock_branch: false,
        },
      }
    );
  }

  async function dispatchWorkflow(token, owner, repo, workflowFile, inputs) {
    return githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { ref: "main", inputs },
      }
    );
  }

  return {
    generateAppJwt,
    getInstallationToken,
    checkAppInstallation,
    createRepoFromTemplate,
    waitForRepo,
    createLabel,
    configureActionsPermissions,
    enableAutoMerge,
    createIssue,
    createIssueComment,
    upsertActionsVariable,
    createOrUpdateActionsSecret,
    ensureRepoMemoryBranch,
    ensureBranchProtection,
    dispatchWorkflow,
  };
}

async function githubFetch(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...headers,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`GitHub API ${method} ${url}: ${res.status} ${text}`);
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

function base64url(input) {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { createGitHubClient };
