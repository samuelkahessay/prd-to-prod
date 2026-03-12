const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const readline = require("readline");

function createOrchestrator({ projectRoot, dataDir, eventStore }) {
  function stageForStep(step) {
    if (step === 1) return "EXTRACT";
    if (step === 2) return "ANALYZE";
    return "BUILD";
  }

  function appendEvent(runId, stage, kind, data, type = "auto") {
    eventStore.appendEvent(runId, {
      id: crypto.randomUUID(),
      stage,
      type,
      kind,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    listRuns() {
      return eventStore.listRuns();
    },
    startRun(payload) {
      const runId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const run = eventStore.createRun({
        id: runId,
        createdAt,
        updatedAt: createdAt,
        status: "queued",
        mode: payload.displayMode || payload.mode,
        inputSource: payload.inputSource,
        targetRepo: payload.targetRepo || "",
        summary: payload.summary || "",
      });

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prd-to-prod-console-"));
      let inputArg = "";
      const env = { ...process.env };
      const args = [path.join(projectRoot, "extraction", "run.sh"), "--mode", payload.mode];

      if (payload.mode === "existing" && payload.targetRepo) {
        env.TARGET_REPO = payload.targetRepo;
      }
      if (payload.mockMode) {
        env.WORKIQ_LIVE = "";
      }
      if (payload.inputSource === "workiq") {
        env.WORKIQ_LIVE = payload.mockMode ? "" : "true";
        inputArg = payload.query || "Product Sync";
      } else {
        const notesPath = path.join(tempDir, "notes.txt");
        fs.writeFileSync(notesPath, payload.notes || "");
        inputArg = notesPath;
      }

      args.push(inputArg);

      appendEvent(runId, "EXTRACT", "stage_start", {
        label: "Collecting input and extracting plan",
      });
      eventStore.updateRun(runId, { status: "running" });

      const child = spawn("bash", args, {
        cwd: projectRoot,
        env,
      });

      let currentStage = "EXTRACT";
      const seenStages = new Set(["EXTRACT"]);

      function handleLine(source, line) {
        const text = line.trimEnd();
        if (!text) {
          return;
        }

        const progressMatch = text.match(/^\[(\d+)\/(\d+)\]\s+(.*)$/);
        if (progressMatch) {
          const nextStage = stageForStep(Number(progressMatch[1]));
          if (nextStage !== currentStage) {
            appendEvent(runId, currentStage, "stage_complete", { label: currentStage });
            currentStage = nextStage;
            if (!seenStages.has(nextStage)) {
              appendEvent(runId, currentStage, "stage_start", { label: currentStage });
              seenStages.add(nextStage);
            }
          }
          appendEvent(runId, currentStage, "progress", {
            source,
            step: Number(progressMatch[1]),
            total: Number(progressMatch[2]),
            message: progressMatch[3],
          });
          return;
        }

        if (text.startsWith("PIPELINE_REPO=")) {
          appendEvent(runId, currentStage, "artifact", {
            key: "pipeline_repo",
            value: text.slice("PIPELINE_REPO=".length),
          });
          return;
        }

        if (text.startsWith("PIPELINE_TARGET_REPO=")) {
          appendEvent(runId, currentStage, "artifact", {
            key: "pipeline_target_repo",
            value: text.slice("PIPELINE_TARGET_REPO=".length),
          });
          return;
        }

        if (text.startsWith("PIPELINE_TRACKING_ISSUE_NUMBER=")) {
          currentStage = "BUILD";
          appendEvent(runId, currentStage, "artifact", {
            key: "tracking_issue_number",
            value: text.slice("PIPELINE_TRACKING_ISSUE_NUMBER=".length),
          });
          return;
        }

        appendEvent(runId, currentStage, "log", {
          source,
          level: source === "stderr" || text.includes("ERROR") ? "error" : "info",
          message: text,
        });
      }

      readline.createInterface({ input: child.stdout }).on("line", (line) => handleLine("stdout", line));
      readline.createInterface({ input: child.stderr }).on("line", (line) => handleLine("stderr", line));

      child.on("close", (code) => {
        appendEvent(runId, currentStage, code === 0 ? "stage_complete" : "stage_error", {
          code,
        });
        appendEvent(runId, currentStage, code === 0 ? "run_complete" : "run_error", {
          code,
        });
        eventStore.updateRun(runId, {
          status: code === 0 ? "completed" : "failed",
          updatedAt: new Date().toISOString(),
        });
        fs.rmSync(tempDir, { recursive: true, force: true });
      });

      return run;
    },
  };
}

module.exports = {
  createOrchestrator,
};
