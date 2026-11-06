import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DebtsPage from "./dividas/page";
import HomePage from "./page";

describe("HomePage", () => {
  const html = renderToStaticMarkup(<HomePage />);

  it("renders Início as the main heading inside the main landmark", () => {
    expect(html).toContain("<main");
    expect(html).toContain("<h1");
    expect(html).toContain("Início");
  });
});

describe("DebtsPage", () => {
  const html = renderToStaticMarkup(<DebtsPage />);

  it("renders Dívidas as the main heading with the empty state", () => {
    expect(html).toContain("<main");
    expect(html).toContain("Dívidas");
    expect(html).toContain("ainda não tem dívidas");
  });
});
