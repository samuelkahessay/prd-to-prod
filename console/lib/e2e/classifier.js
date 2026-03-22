function classifyFailure({
  lane,
  activeLane,
  session = null,
  buildEvents = [],
  warnings = [],
  timedOut = false,
  uiAuthFailed = false,
  uiFlowFailed = false,
  detail = "",
} = {}) {
  if (uiAuthFailed) {
    return {
      failureClass: "ui_auth_failed",
      failureDetail: detail || "Browser canary could not complete GitHub authentication.",
    };
  }

  if (uiFlowFailed) {
    return {
      failureClass: "ui_flow_failed",
      failureDetail: detail || "Browser canary did not complete the expected UI steps.",
    };
  }

  if (isAuthExpiry(detail)) {
    return {
      failureClass: "auth_required",
      failureDetail: detail || "Browser or GitHub authorization expired.",
    };
  }

  const lastProviderRetry = findLatestEvent(buildEvents, "provider_retry_exhausted");
  if (lastProviderRetry) {
    return {
      failureClass: "provider_retry_exhausted",
      failureDetail: readDetail(lastProviderRetry, detail),
    };
  }

  const lastCapacity = findLatestEvent(buildEvents, "capacity_waitlisted");
  if (lastCapacity || session?.status === "awaiting_capacity") {
    return {
      failureClass: "capacity_waitlisted",
      failureDetail: readDetail(lastCapacity, detail) || "The run is waiting for pipeline capacity.",
    };
  }

  const stalled = findLatestEvent(buildEvents, "pipeline_stalled");
  if (stalled) {
    return classifyStalledEvent(stalled, { warnings, fallbackDetail: detail });
  }

  if (activeLane === "provision-only" || lane === "provision-only") {
    if (/name already exists on this account/i.test(detail)) {
      return {
        failureClass: "provision_failed",
        failureDetail: detail || "Provisioning could not create the requested repository.",
      };
    }
  }

  if (timedOut) {
    const laneForTimeout = activeLane || lane;
    if (hasBootstrapConflictWarning(warnings, detail)) {
      return {
        failureClass: "bootstrap_conflict",
        failureDetail: detail || "Bootstrap encountered a repo-memory 409 conflict and did not recover.",
      };
    }

    if (laneForTimeout === "provision-only") {
      return {
        failureClass: "bootstrap_stalled",
        failureDetail: detail || "Provisioning did not reach ready_to_launch within the SLA.",
      };
    }

    if (laneForTimeout === "decomposer-only") {
      return {
        failureClass: "decomposer_timeout",
        failureDetail: detail || "The pipeline did not create a child issue within the decomposition SLA.",
      };
    }

    if (laneForTimeout === "first-pr") {
      return {
        failureClass: "first_pr_timeout",
        failureDetail: detail || "The pipeline did not open a PR within the first-PR SLA.",
      };
    }
  }

  return {
    failureClass: "unknown",
    failureDetail: detail || "The E2E harness could not classify this failure.",
  };
}

function classifyStalledEvent(event, { warnings = [], fallbackDetail = "" } = {}) {
  const stage = event?.data?.stage || "";
  const detail = readDetail(event, fallbackDetail);

  if (stage === "bootstrap") {
    return {
      failureClass: hasBootstrapConflictWarning(warnings, detail)
        ? "bootstrap_conflict"
        : "bootstrap_stalled",
      failureDetail: detail,
    };
  }

  if (stage === "provision") {
    return {
      failureClass: "provision_failed",
      failureDetail: detail,
    };
  }

  if (stage === "review") {
    return {
      failureClass: "review_stalled",
      failureDetail: detail,
    };
  }

  if (stage === "deploy") {
    return {
      failureClass: "handoff_stalled",
      failureDetail: detail,
    };
  }

  if (stage === "decompose") {
    return {
      failureClass: "decomposer_timeout",
      failureDetail: detail,
    };
  }

  return {
    failureClass: "unknown",
    failureDetail: detail || fallbackDetail || "The pipeline stalled without a classified stage.",
  };
}

function findLatestEvent(events, kind) {
  return [...events].reverse().find((event) => event.kind === kind) || null;
}

function readDetail(event, fallback = "") {
  return event?.data?.detail || fallback || "";
}

function hasBootstrapConflictWarning(warnings, detail) {
  const texts = [...warnings, detail].filter(Boolean);
  return texts.some((value) => /state\.json/i.test(value) && /\b409\b/.test(value));
}

function isAuthExpiry(detail) {
  return /authorization has expired|oauth[_\s-]*grant|re-authenticate/i.test(detail || "");
}

module.exports = {
  classifyFailure,
};
