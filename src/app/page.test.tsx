import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  const html = renderToStaticMarkup(<HomePage />);

  it("renders the app name as the main heading", () => {
    expect(html).toContain("<h1");
    expect(html).toContain("Conta Leve");
  });

  it("renders the description inside the main landmark", () => {
    expect(html).toContain("<main");
    expect(html).toContain("Controle de dívidas pessoais");
  });
});
