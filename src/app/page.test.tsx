import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the app name as the main heading", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("<h1");
    expect(html).toContain("Conta Leve");
  });

  it("renders the page inside a main landmark", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("<main");
  });
});
