function normalizeRunMode(mode) {
  if (mode === "new") {
    return "greenfield";
  }
  return mode;
}

function isSupportedRunMode(mode) {
  return ["auto", "new", "greenfield", "existing"].includes(mode);
}

module.exports = {
  isSupportedRunMode,
  normalizeRunMode,
};
