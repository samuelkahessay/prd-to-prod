const styles = new Proxy<Record<string, string>>(
  {},
  {
    get: (_target, prop) => (typeof prop === "string" ? prop : ""),
  },
);

export default styles;
