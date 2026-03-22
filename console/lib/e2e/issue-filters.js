const TYPED_ISSUE_LABELS = new Set(["feature", "bug", "infra", "test", "docs"]);

function normalizeIssueLabels(labels = []) {
  return labels.map((label) => {
    if (typeof label === "string") {
      return label;
    }
    return label?.name || "";
  }).filter(Boolean);
}

function isAgenticWorkflowIssue(issue = {}) {
  const labels = normalizeIssueLabels(issue.labels || []);
  const title = String(issue.title || "");
  return labels.includes("agentic-workflows") || /^\[aw\]/i.test(title);
}

function hasTypedIssueLabel(issue = {}) {
  return normalizeIssueLabels(issue.labels || []).some((label) => TYPED_ISSUE_LABELS.has(label));
}

function filterTrackedChildIssues(issues = [], rootIssueNumber = null) {
  return issues.filter((issue) => {
    if (issue.number === rootIssueNumber) {
      return false;
    }
    return !isAgenticWorkflowIssue(issue);
  });
}

module.exports = {
  TYPED_ISSUE_LABELS,
  normalizeIssueLabels,
  isAgenticWorkflowIssue,
  hasTypedIssueLabel,
  filterTrackedChildIssues,
};
