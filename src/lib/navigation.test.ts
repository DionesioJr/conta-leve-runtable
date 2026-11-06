import { describe, expect, it } from "vitest";
import { NAV_TABS, isActiveTab } from "./navigation";

describe("NAV_TABS", () => {
  it("lists Início and Dívidas in order", () => {
    expect(NAV_TABS.map((tab) => tab.label)).toEqual(["Início", "Dívidas"]);
  });
});

describe("isActiveTab", () => {
  it("matches the home tab only on the root path", () => {
    expect(isActiveTab("/", "/")).toBe(true);
    expect(isActiveTab("/dividas", "/")).toBe(false);
  });

  it("matches the debts tab on its path and nested paths", () => {
    expect(isActiveTab("/dividas", "/dividas")).toBe(true);
    expect(isActiveTab("/dividas/nova", "/dividas")).toBe(true);
  });

  it("does not match unrelated paths with the same prefix", () => {
    expect(isActiveTab("/dividas-antigas", "/dividas")).toBe(false);
    expect(isActiveTab("/", "/dividas")).toBe(false);
  });
});
