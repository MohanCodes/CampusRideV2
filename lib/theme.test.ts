import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from "./theme";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function block(startMarker: string): Record<string, string> {
  const start = css.indexOf(startMarker);
  expect(start, `${startMarker} not found`).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2].toLowerCase()]),
  );
}

const light = block(":root {");
const dark = block(':root:not([data-theme="light"]) {');
const darkForced = block(':root[data-theme="dark"] {');

const TOKENS = [
  "ink", "on-ink", "green", "mint", "pale", "bg", "bg-alt",
  "surface", "muted", "line", "focus", "danger", "star",
];

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("design tokens (WEB_FLOWS.md Section 7)", () => {
  it("defines every token in Light and Dark", () => {
    for (const t of TOKENS) {
      expect(light[t], `light --${t}`).toBeDefined();
      expect(dark[t], `dark --${t}`).toBeDefined();
    }
  });

  it("keeps the forced-dark block identical to the media-query block", () => {
    expect(darkForced).toEqual(dark);
  });

  it("matches the spec's Light values", () => {
    expect(light).toMatchObject({
      ink: "#17392e", "on-ink": "#ffffff", green: "#276e50", mint: "#ddf9ea",
      pale: "#eaf9f1", bg: "#fcfdf9", "bg-alt": "#f0f4ee", surface: "#ffffff",
      muted: "#5d7168", line: "#cedcd3", focus: "#36805b", danger: "#b42318", star: "#f59e0b",
    });
  });

  it("keeps the theme-color meta values in sync with --bg", () => {
    expect(THEME_COLOR_LIGHT).toBe(light.bg);
    expect(THEME_COLOR_DARK).toBe(dark.bg);
  });

  // Text pairings need 4.5:1 in both themes. Focus ring is a UI outline, so 3:1.
  const textPairs: [string, string][] = [
    ["ink", "bg"], ["ink", "surface"], ["ink", "mint"], ["ink", "pale"], ["ink", "bg-alt"],
    ["muted", "bg"], ["muted", "surface"], ["muted", "mint"], ["muted", "pale"], ["muted", "bg-alt"],
    ["green", "bg"], ["green", "surface"], ["green", "mint"], ["green", "bg-alt"],
    ["on-ink", "ink"],
    ["danger", "bg"], ["danger", "surface"],
  ];

  for (const [name, theme] of [["Light", light], ["Dark", dark]] as const) {
    describe(name, () => {
      for (const [fg, bg] of textPairs) {
        it(`${fg} on ${bg} is at least 4.5:1`, () => {
          expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
        });
      }
      it("focus ring on page is at least 3:1", () => {
        expect(contrast(theme.focus, theme.bg)).toBeGreaterThanOrEqual(3);
      });
      it("panel text (Mint on Ink in Light, Ink on Mint in Dark) is at least 4.5:1", () => {
        const [fg, bg] = name === "Light" ? ["mint", "ink"] : ["ink", "mint"];
        expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
      });
    });
  }
});
