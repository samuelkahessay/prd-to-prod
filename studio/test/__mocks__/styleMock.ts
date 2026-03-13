const styleMock = new Proxy(
  {},
  {
    get: (_, key) => (typeof key === "string" ? key : ""),
  }
);

export default styleMock;
