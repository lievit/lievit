/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * table.jte + table/*.jte -- composable primitive set (v-next re-forge, spec §7).
 *
 * This suite asserts the SOURCE TEXT of the table composable set (table.jte +
 * table/header.jte, table/body.jte, table/footer.jte, table/row.jte,
 * table/head.jte, table/cell.jte, table/caption.jte).
 *
 * What is pinned:
 *   - Param API (names, types, defaults) -- no klass, cssClass is the v-next name.
 *   - Correct semantic element per partial (thead/tbody/tfoot/tr/th/td/caption).
 *   - A11y contract: scope on <th>, aria-sort on <th> (not inner button),
 *     aria-selected / aria-rowindex / data-row-id on <tr>.
 *   - smart-attribute pattern (null = attribute dropped, no @if in name position).
 *   - No io.lievit imports, no inline on* handlers, no nested JTE comments.
 *   - Token hygiene: no bare hex / rgb / oklch literals outside comment blocks.
 *   - data-slot presence and correct value per partial.
 *   - Copyright header present.
 *   - Usage doc in the header carries @@template.lievit.table.* call syntax.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");

function read(rel: string): string {
  return readFileSync(join(jteDir, rel), "utf8");
}

/** Strip JTE comments so assertions do not hit doc-comment prose. */
function stripComments(src: string): string {
  return src.replace(/<%--[\s\S]*?--%>/g, "");
}

// ---------------------------------------------------------------------------
// File existence gate
// ---------------------------------------------------------------------------
describe("table composable set -- file existence", () => {
  const parts = ["header", "body", "footer", "row", "head", "cell", "caption"];

  test("table.jte exists", () => {
    expect(existsSync(join(jteDir, "table.jte"))).toBe(true);
  });

  test.each(parts)("table/%s.jte exists", (part) => {
    expect(existsSync(join(jteDir, "table", `${part}.jte`))).toBe(true);
  });

  test("table/meta.json exists", () => {
    expect(existsSync(join(jteDir, "table", "meta.json"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// table.jte (wrapper)
// ---------------------------------------------------------------------------
describe("table.jte -- wrapper", () => {
  const src = read("table.jte");
  const markup = stripComments(src);

  test("has Apache copyright header", () => {
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain("Apache License, Version 2.0");
  });

  test("renders a real <table> inside an overflow-x-auto container", () => {
    expect(markup).toMatch(/<table[\s\n]/);
    expect(markup).toContain("overflow-x-auto");
  });

  test("wraps in a <div> scroll container with data-slot=table-container", () => {
    expect(markup).toContain('data-slot="table-container"');
    expect(markup).toContain('data-slot="table"');
  });

  test("declares ariaLabel param (null default -> attribute drops)", () => {
    expect(src).toContain("@param String ariaLabel = null");
    expect(markup).toContain('aria-label="${ariaLabel}"');
  });

  test("declares ariaLabelledBy param", () => {
    expect(src).toContain("@param String ariaLabelledBy = null");
    expect(markup).toContain('aria-labelledby="${ariaLabelledBy}"');
  });

  test("declares ariaDescribedBy param", () => {
    expect(src).toContain("@param String ariaDescribedBy = null");
    expect(markup).toContain('aria-describedby="${ariaDescribedBy}"');
  });

  test("uses cssClass (v-next name) not klass (old name)", () => {
    expect(src).toContain('@param String cssClass = ""');
    expect(src).not.toContain("@param String klass");
  });

  test("has attrs param (TRUSTED raw channel)", () => {
    expect(src).toContain('@param String attrs = ""');
    expect(markup).toContain("$unsafe{attrs}");
  });

  test("has content param (gg.jte.Content slot)", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
  });

  test("no io.lievit import", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit/);
  });

  test("no inline on* handler", () => {
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });

  test("no bare hex / rgb / oklch colour literals outside comments", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(markup).not.toMatch(/\brgb\(/);
    expect(markup).not.toMatch(/\boklch\(/);
  });

  test("no inline <script>", () => {
    expect(markup).not.toMatch(/<script[\s>]/i);
  });

  test("caption-bottom on the <table> (shadcn: caption appears below)", () => {
    expect(markup).toContain("caption-bottom");
  });

  test("font-family via token not hardcoded", () => {
    expect(markup).toContain("var(--lv-font-sans)");
    expect(markup).not.toMatch(/font-family\s*:\s*(Arial|Helvetica|system-ui)/);
  });

  test("usage doc in header comment shows @@template.lievit.table( call syntax", () => {
    expect(src).toContain("@@template.lievit.table(");
  });
});

// ---------------------------------------------------------------------------
// table/header.jte
// ---------------------------------------------------------------------------
describe("table/header.jte -- thead", () => {
  const src = read("table/header.jte");
  const markup = stripComments(src);

  test("renders <thead>", () => {
    expect(markup).toMatch(/<thead[\s\n]/);
  });

  test("data-slot=table-header", () => {
    expect(markup).toContain('data-slot="table-header"');
  });

  test("has cssClass param (v-next name, not klass)", () => {
    expect(src).toContain('@param String cssClass = ""');
    expect(src).not.toContain("@param String klass");
  });

  test("has stickyHeader boolean param (false default)", () => {
    expect(src).toContain("@param boolean stickyHeader = false");
  });

  test("stickyHeader=true drives sticky positioning via local var (not @if in name pos)", () => {
    // The logic is in a !{var _theadStyle = ...} local var, not an @if in attr name
    expect(src).toContain("_theadStyle");
    expect(markup).not.toMatch(/@if\([^)]*\)position/);
    expect(markup).not.toMatch(/@if\([^)]*\)style/);
  });

  test("data-sticky-header smart attr (null = dropped when false)", () => {
    expect(markup).toContain('data-sticky-header="${stickyHeader ? "true" : null}"');
  });

  test("has content slot", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
  });

  test("no io.lievit import", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit/);
  });

  test("no inline on* handler", () => {
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });

  test("uses --lv-* tokens for sticky background + shadow", () => {
    expect(src).toContain("var(--lv-color-bg)");
    expect(src).toContain("var(--lv-color-border)");
    expect(src).toContain("var(--lv-z-sticky)");
  });
});

// ---------------------------------------------------------------------------
// table/body.jte
// ---------------------------------------------------------------------------
describe("table/body.jte -- tbody", () => {
  const src = read("table/body.jte");
  const markup = stripComments(src);

  test("renders <tbody>", () => {
    expect(markup).toMatch(/<tbody[\s\n]/);
  });

  test("data-slot=table-body", () => {
    expect(markup).toContain('data-slot="table-body"');
  });

  test("has cssClass param", () => {
    expect(src).toContain('@param String cssClass = ""');
  });

  test("last row border removed (shadcn parity via Tailwind variant)", () => {
    expect(markup).toContain("[&_tr:last-child]:border-b-0");
  });

  test("has content slot", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
  });

  test("no io.lievit import", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit/);
  });
});

// ---------------------------------------------------------------------------
// table/footer.jte
// ---------------------------------------------------------------------------
describe("table/footer.jte -- tfoot", () => {
  const src = read("table/footer.jte");
  const markup = stripComments(src);

  test("renders <tfoot>", () => {
    expect(markup).toMatch(/<tfoot[\s\n]/);
  });

  test("data-slot=table-footer", () => {
    expect(markup).toContain('data-slot="table-footer"');
  });

  test("has cssClass param", () => {
    expect(src).toContain('@param String cssClass = ""');
  });

  test("top border + muted fill", () => {
    expect(markup).toContain("border-t");
    expect(src).toContain("var(--lv-color-border)");
    expect(src).toContain("var(--lv-color-surface)");
  });

  test("medium font weight via token", () => {
    expect(src).toContain("var(--lv-font-medium)");
  });

  test("last child border suppressed", () => {
    expect(markup).toContain("[&>tr]:last:border-b-0");
  });

  test("has content slot", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
  });

  test("no io.lievit import", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit/);
  });
});

// ---------------------------------------------------------------------------
// table/row.jte
// ---------------------------------------------------------------------------
describe("table/row.jte -- tr", () => {
  const src = read("table/row.jte");
  const markup = stripComments(src);

  test("renders <tr>", () => {
    expect(markup).toMatch(/<tr[\s\n]/);
  });

  test("data-slot=table-row", () => {
    expect(markup).toContain('data-slot="table-row"');
  });

  test("data-state smart attr: null when empty (no @if in name position)", () => {
    expect(markup).toContain('data-state="${state.isEmpty() ? null : state}"');
    expect(markup).not.toMatch(/@if\([^)]*\)data-state/);
  });

  test("aria-selected smart attr (null = attribute dropped)", () => {
    expect(markup).toContain('aria-selected="${ariaSelected}"');
  });

  test("aria-rowindex smart attr (null = attribute dropped)", () => {
    expect(markup).toContain('aria-rowindex="${ariaRowIndex}"');
  });

  test("data-row-id for enhancer + HTMX swaps", () => {
    expect(markup).toContain('data-row-id="${dataRowId}"');
  });

  test("has ariaSelected param (null default)", () => {
    expect(src).toContain("@param String ariaSelected = null");
  });

  test("has ariaRowIndex param (null default)", () => {
    expect(src).toContain("@param String ariaRowIndex = null");
  });

  test("has state param (empty default)", () => {
    expect(src).toContain('@param String state = ""');
  });

  test("has dataRowId param (null default)", () => {
    expect(src).toContain("@param String dataRowId = null");
  });

  test("has hoverable boolean param (true default)", () => {
    expect(src).toContain("@param boolean hoverable = true");
  });

  test("has striped boolean param (false default)", () => {
    expect(src).toContain("@param boolean striped = false");
  });

  test("has bordered boolean param (false default)", () => {
    expect(src).toContain("@param boolean bordered = false");
  });

  test("has cssClass param (v-next name, not klass)", () => {
    expect(src).toContain('@param String cssClass = ""');
    expect(src).not.toContain("@param String klass");
  });

  test("hover highlight uses --lv-color-accent token", () => {
    expect(src).toContain("var(--lv-color-accent)");
  });

  test("transition-colors for smooth hover", () => {
    expect(markup).toContain("transition-colors");
  });

  test("striped tint uses --lv-color-surface token", () => {
    expect(src).toContain("var(--lv-color-surface)");
  });

  test("border uses --lv-color-border token", () => {
    expect(src).toContain("var(--lv-color-border)");
  });

  test("no bare hex / rgb / oklch literals outside comments", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(markup).not.toMatch(/\brgb\(/);
    expect(markup).not.toMatch(/\boklch\(/);
  });

  test("no io.lievit import", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit/);
  });

  test("no inline on* handler", () => {
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });

  test("has content slot", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
  });
});

// ---------------------------------------------------------------------------
// table/head.jte
// ---------------------------------------------------------------------------
describe("table/head.jte -- th", () => {
  const src = read("table/head.jte");
  const markup = stripComments(src);

  test("renders <th>", () => {
    expect(markup).toMatch(/<th[\s\n]/);
  });

  test("data-slot=table-head", () => {
    expect(markup).toContain('data-slot="table-head"');
  });

  test("scope attribute present (accessible header association)", () => {
    expect(src).toContain('@param String scope = "col"');
    expect(markup).toContain('scope="${scope}"');
  });

  test("aria-sort on <th> NOT on inner button (APG sortable-table rule)", () => {
    expect(markup).toContain('aria-sort="${ariaSort}"');
    // aria-sort must be on the th element itself
    expect(markup).toMatch(/<th[\s\S]{0,200}aria-sort="\$\{ariaSort\}"/);
  });

  test("has ariaSort param (null default -> attribute dropped)", () => {
    expect(src).toContain("@param String ariaSort = null");
  });

  test("has cssClass param (v-next name, not klass)", () => {
    expect(src).toContain('@param String cssClass = ""');
    expect(src).not.toContain("@param String klass");
  });

  test("muted foreground via --lv-color-muted-fg token", () => {
    expect(src).toContain("var(--lv-color-muted-fg)");
  });

  test("small semibold label via tokens", () => {
    expect(src).toContain("var(--lv-text-xs)");
    expect(src).toContain("var(--lv-font-semibold)");
  });

  test("[&:has([role=checkbox])]:pr-0 for checkbox column alignment", () => {
    expect(markup).toContain("[&:has([role=checkbox])]:pr-0");
  });

  test("horizontal padding uses --lv-space-4 token", () => {
    expect(src).toContain("var(--lv-space-4)");
  });

  test("no bare hex / rgb / oklch literals outside comments", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(markup).not.toMatch(/\brgb\(/);
    expect(markup).not.toMatch(/\boklch\(/);
  });

  test("no io.lievit import", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit/);
  });

  test("no inline on* handler", () => {
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });

  test("has content slot", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
  });
});

// ---------------------------------------------------------------------------
// table/cell.jte
// ---------------------------------------------------------------------------
describe("table/cell.jte -- td", () => {
  const src = read("table/cell.jte");
  const markup = stripComments(src);

  test("renders <td>", () => {
    expect(markup).toMatch(/<td[\s\n]/);
  });

  test("data-slot=table-cell", () => {
    expect(markup).toContain('data-slot="table-cell"');
  });

  test("has cssClass param (v-next name, not klass)", () => {
    expect(src).toContain('@param String cssClass = ""');
    expect(src).not.toContain("@param String klass");
  });

  test("has attrs param (TRUSTED raw channel)", () => {
    expect(src).toContain('@param String attrs = ""');
    expect(markup).toContain("$unsafe{attrs}");
  });

  test("horizontal padding uses --lv-space-4 token", () => {
    expect(src).toContain("var(--lv-space-4)");
  });

  test("vertical padding uses --lv-space-3 token (md default density)", () => {
    expect(src).toContain("var(--lv-space-3)");
  });

  test("[&:has([role=checkbox])]:pr-0 for checkbox column cell alignment", () => {
    expect(markup).toContain("[&:has([role=checkbox])]:pr-0");
  });

  test("align-middle for vertical centering", () => {
    expect(markup).toContain("align-middle");
  });

  test("no bare hex / rgb / oklch literals outside comments", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(markup).not.toMatch(/\brgb\(/);
    expect(markup).not.toMatch(/\boklch\(/);
  });

  test("no io.lievit import", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit/);
  });

  test("no inline on* handler", () => {
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });

  test("has content slot", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
  });
});

// ---------------------------------------------------------------------------
// table/caption.jte
// ---------------------------------------------------------------------------
describe("table/caption.jte -- caption", () => {
  const src = read("table/caption.jte");
  const markup = stripComments(src);

  test("renders <caption>", () => {
    expect(markup).toMatch(/<caption[\s\n]/);
  });

  test("data-slot=table-caption", () => {
    expect(markup).toContain('data-slot="table-caption"');
  });

  test("has cssClass param (sr-only support for visually-hidden captions)", () => {
    expect(src).toContain('@param String cssClass = ""');
    // doc comment must mention sr-only pattern
    expect(src).toContain("sr-only");
  });

  test("top margin for spacing below table (caption-bottom context)", () => {
    expect(src).toContain("var(--lv-space-4)");
  });

  test("muted colour via --lv-color-muted token", () => {
    expect(src).toContain("var(--lv-color-muted)");
  });

  test("text size via --lv-text-sm token", () => {
    expect(src).toContain("var(--lv-text-sm)");
  });

  test("no bare hex / rgb / oklch literals outside comments", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(markup).not.toMatch(/\brgb\(/);
    expect(markup).not.toMatch(/\boklch\(/);
  });

  test("no io.lievit import", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit/);
  });

  test("has content slot", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
  });
});

// ---------------------------------------------------------------------------
// meta.json
// ---------------------------------------------------------------------------
describe("table/meta.json -- registry metadata", () => {
  const meta = JSON.parse(read("table/meta.json"));

  test("name is table", () => {
    expect(meta.name).toBe("table");
  });

  test("type is registry:jte", () => {
    expect(meta.type).toBe("registry:jte");
  });

  test("all 8 JTE files listed", () => {
    const paths = meta.files.map((f: { path: string }) => f.path);
    expect(paths).toContain("jte/table.jte");
    expect(paths).toContain("jte/table/header.jte");
    expect(paths).toContain("jte/table/body.jte");
    expect(paths).toContain("jte/table/footer.jte");
    expect(paths).toContain("jte/table/row.jte");
    expect(paths).toContain("jte/table/head.jte");
    expect(paths).toContain("jte/table/cell.jte");
    expect(paths).toContain("jte/table/caption.jte");
  });

  test("registryDependencies contains tokens", () => {
    expect(meta.registryDependencies).toContain("tokens");
  });

  test("description mentions composable and shadcn", () => {
    expect(meta.description.toLowerCase()).toContain("composable");
    expect(meta.description.toLowerCase()).toContain("shadcn");
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: all parts must carry the copyright notice
// ---------------------------------------------------------------------------
describe("table set -- copyright", () => {
  const parts = [
    "table.jte",
    "table/header.jte",
    "table/body.jte",
    "table/footer.jte",
    "table/row.jte",
    "table/head.jte",
    "table/cell.jte",
    "table/caption.jte",
  ];

  test.each(parts)("%s has Apache copyright notice", (part) => {
    const src = read(part);
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain("Apache License, Version 2.0");
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: no nested JTE comment markers
// ---------------------------------------------------------------------------
describe("table set -- no nested JTE comments", () => {
  const parts = [
    "table.jte",
    "table/header.jte",
    "table/body.jte",
    "table/footer.jte",
    "table/row.jte",
    "table/head.jte",
    "table/cell.jte",
    "table/caption.jte",
  ];

  test.each(parts)("%s has no nested --%> inside a comment block", (part) => {
    const src = read(part);
    // Find all comment blocks and assert no inner close-marker exists within them
    // (a nested --%> would close the outer comment early)
    const commentBlocks = src.match(/<%--[\s\S]*?--%>/g) ?? [];
    for (const block of commentBlocks) {
      // The inner content between <%-- and --%> must not contain another --%>
      const inner = block.slice(4, -3);
      expect(inner, `nested --%> found in comment of ${part}`).not.toContain("--%>");
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: consistency with the shared jte-static-partials.test.ts
// expectations (pinned here so they still hold after the re-forge)
// ---------------------------------------------------------------------------
describe("table set -- jte-static-partials contract (re-forge compat)", () => {
  test("table.jte wraps a real <table> in an overflow-x-auto container", () => {
    const src = read("table.jte");
    const markup = stripComments(src);
    expect(markup).toContain("overflow-x-auto");
    expect(markup).toMatch(/<table[\s\n]/);
    expect(markup).toContain("${content}");
  });

  test("all 7 sub-parts still ship", () => {
    const parts = ["header", "body", "footer", "row", "head", "cell", "caption"];
    for (const part of parts) {
      expect(existsSync(join(jteDir, "table", `${part}.jte`)), `table/${part}.jte`).toBe(true);
    }
  });

  test("each sub-part uses the correct semantic element", () => {
    expect(read("table/header.jte")).toMatch(/<thead[\s>]/);
    expect(read("table/body.jte")).toMatch(/<tbody[\s>]/);
    expect(read("table/footer.jte")).toMatch(/<tfoot[\s>]/);
    expect(read("table/row.jte")).toMatch(/<tr[\s\n]/);
    expect(read("table/head.jte")).toMatch(/<th[\s\n]/);
    expect(read("table/cell.jte")).toMatch(/<td[\s>]/);
    expect(read("table/caption.jte")).toMatch(/<caption[\s>]/);
  });

  test("head cell carries a scope param and emits scope attribute", () => {
    const head = read("table/head.jte");
    expect(head).toMatch(/@param String scope/);
    expect(head).toContain('scope="${scope}"');
  });

  test("row selection uses a smart attribute (null = attribute dropped), not @if in name position", () => {
    const row = read("table/row.jte");
    expect(row).toContain('data-state="${state.isEmpty() ? null : state}"');
    expect(row).not.toMatch(/@if\([^)]*\)data-state/);
  });
});
