const { EventEmitter } = require("events");

const { streamBuildSessionEvents } = require("../routes/pub-build-stream");

function createResponse() {
  return {
    flushHeaders: jest.fn(),
    writeHead: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(),
  };
}

test("replays buffered events that arrive while history is being replayed", () => {
  const req = new EventEmitter();
  req.params = { id: "session-1" };
  req.headers = { "last-event-id": "1" };

  const res = createResponse();
  const unsubscribe = jest.fn();
  let listener;

  const buildSessionStore = {
    getSession: jest.fn().mockReturnValue({ id: "session-1" }),
    subscribe: jest.fn((_sessionId, callback) => {
      listener = callback;
      return unsubscribe;
    }),
    getEvents: jest.fn(() => {
      listener({
        id: 3,
        build_session_id: "session-1",
        category: "build",
        kind: "stage_progress",
        data: { label: "buffered-event" },
        created_at: "2026-03-14T18:00:00.000Z",
      });

      return [
        {
          id: 2,
          build_session_id: "session-1",
          category: "chat",
          kind: "assistant_message",
          data: { role: "assistant", content: "historical-event" },
          created_at: "2026-03-14T17:59:00.000Z",
        },
      ];
    }),
  };

  streamBuildSessionEvents(req, res, buildSessionStore);

  expect(res.write.mock.calls[0][0]).toContain("id: 2");
  expect(res.write.mock.calls[0][0]).toContain("historical-event");
  expect(res.write.mock.calls[1][0]).toContain("id: 3");
  expect(res.write.mock.calls[1][0]).toContain("buffered-event");

  req.emit("close");

  expect(unsubscribe).toHaveBeenCalled();
  expect(res.end).toHaveBeenCalled();
});
