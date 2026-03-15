function registerBuildStreamRoutes(app, { buildSessionStore }) {
  app.get("/pub/build-session/:id/stream", (req, res) =>
    streamBuildSessionEvents(req, res, buildSessionStore)
  );
}

function streamBuildSessionEvents(req, res, buildSessionStore) {
  const sessionId = req.params.id;
  const session = buildSessionStore.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  let lastSentId = parseLastEventId(req.headers["last-event-id"]);
  const pending = [];
  let replaying = true;

  const unsubscribe = buildSessionStore.subscribe(sessionId, (event) => {
    if (replaying) {
      pending.push(event);
      return;
    }

    if (event.id <= lastSentId) {
      return;
    }

    writeEvent(res, event);
    lastSentId = event.id;
  });

  const historical = buildSessionStore.getEvents(sessionId, { afterId: lastSentId });
  for (const event of historical) {
    writeEvent(res, event);
    lastSentId = event.id;
  }

  replaying = false;
  pending.sort((left, right) => left.id - right.id);
  for (const event of pending) {
    if (event.id <= lastSentId) {
      continue;
    }

    writeEvent(res, event);
    lastSentId = event.id;
  }

  const keepalive = setInterval(() => {
    res.write(":keepalive\n\n");
  }, 30_000);

  req.on("close", () => {
    clearInterval(keepalive);
    unsubscribe();
    res.end();
  });
}

function parseLastEventId(headerValue) {
  if (Array.isArray(headerValue)) {
    return parseLastEventId(headerValue[0]);
  }

  return Number.parseInt(headerValue || "0", 10) || 0;
}

function writeEvent(res, event) {
  res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
}

module.exports = { registerBuildStreamRoutes, streamBuildSessionEvents };
