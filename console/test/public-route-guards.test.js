const express = require("express");

const { createPublicRouteGuards } = require("../lib/public-route-guards");

async function withServer(setup, run) {
  const app = express();
  app.use(express.json());
  setup(app);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    await run(server);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function makeUrl(server, path) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}${path}`;
}

test("auth limiter only applies to login start route", async () => {
  const registerGuards = createPublicRouteGuards({
    authStart: { max: 1, windowMs: 60_000 },
  });

  await withServer((app) => {
    registerGuards(app);
    app.get("/pub/auth/github", (_req, res) => res.json({ ok: true }));
    app.get("/pub/auth/me", (_req, res) => res.json({ ok: true }));
    app.get("/pub/auth/github/callback", (_req, res) => res.json({ ok: true }));
  }, async (server) => {
    const loginOne = await fetch(makeUrl(server, "/pub/auth/github"));
    const loginTwo = await fetch(makeUrl(server, "/pub/auth/github"));
    const meOne = await fetch(makeUrl(server, "/pub/auth/me"));
    const meTwo = await fetch(makeUrl(server, "/pub/auth/me"));
    const callback = await fetch(makeUrl(server, "/pub/auth/github/callback"));

    expect(loginOne.status).toBe(200);
    expect(loginTwo.status).toBe(429);
    expect(meOne.status).toBe(200);
    expect(meTwo.status).toBe(200);
    expect(callback.status).toBe(200);
  });
});

test("build-session create limiter does not throttle message route", async () => {
  const registerGuards = createPublicRouteGuards({
    sessionCreate: { max: 1, windowMs: 60_000 },
    sessionMessage: { max: 2, windowMs: 60_000 },
  });

  await withServer((app) => {
    registerGuards(app);
    app.post("/pub/build-session", (_req, res) => res.json({ ok: true }));
    app.post("/pub/build-session/:buildSessionId/message", (_req, res) =>
      res.json({ ok: true })
    );
    app.get("/pub/build-session/:buildSessionId", (_req, res) => res.json({ ok: true }));
  }, async (server) => {
    const createOne = await fetch(makeUrl(server, "/pub/build-session"), { method: "POST" });
    const createTwo = await fetch(makeUrl(server, "/pub/build-session"), { method: "POST" });
    const messageOne = await fetch(makeUrl(server, "/pub/build-session/abc/message"), {
      method: "POST",
    });
    const messageTwo = await fetch(makeUrl(server, "/pub/build-session/abc/message"), {
      method: "POST",
    });
    const sessionRead = await fetch(makeUrl(server, "/pub/build-session/abc"));

    expect(createOne.status).toBe(200);
    expect(createTwo.status).toBe(429);
    expect(messageOne.status).toBe(200);
    expect(messageTwo.status).toBe(200);
    expect(sessionRead.status).toBe(200);
  });
});
