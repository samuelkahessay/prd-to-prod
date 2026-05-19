import fs from "node:fs";
import path from "node:path";

const publicSourceRoots = ["app", "components"].map((segment) =>
  path.join(__dirname, "..", segment),
);

function sourceFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(fullPath);
    }

    if (/\.(tsx?|css)$/.test(entry.name)) {
      return [fullPath];
    }

    return [];
  });
}

describe("public site hygiene", () => {
  it("does not expose the retired pitch route", () => {
    expect(fs.existsSync(path.join(__dirname, "..", "app", "pitch", "page.tsx"))).toBe(false);
  });

  it("does not include Calendly or investor-seeking language in public source", () => {
    const source = publicSourceRoots
      .flatMap(sourceFiles)
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");

    expect(source).not.toMatch(/calendly\.com/i);
    expect(source).not.toMatch(/Book a call/i);
    expect(source).not.toMatch(/href=["']\/pitch["']/i);
    expect(source).not.toMatch(/\binvestors?\b/i);
    expect(source).not.toMatch(/Factory raised/i);
    expect(source).not.toMatch(/Sequoia/i);
    expect(source).not.toMatch(/raise money/i);
  });
});
