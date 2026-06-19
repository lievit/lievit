@import gg.jte.Content
<%--
  lievit-ui :: table (static JTE partial - composable set)

  The table PRIMITIVE markup, mirroring shadcn's Table / TableHeader / TableBody /
  TableFooter / TableRow / TableHead / TableCell / TableCaption. This is layout-only
  chrome: borders, a muted header, hover rows. Sorting / selection / pagination are the
  caller's job (or the interactive data-table island), keeping this tier presentational.

  Tier rationale: pure presentation, no client state, so a JTE partial (DONE criterion 1).

  SHAPE DECISION (scientific rule). Two options were compared:
    (A) one parameterised partial fed a rows/headers data model - closed, forces a rigid
        data shape, not composable, does NOT match shadcn's component set.
    (B) a SET of composable sub-templates, one per shadcn part, each taking a Content
        block - "data down, events up", lets the caller own the row/cell loop, matches
        shadcn's structure 1:1.
  (B) wins on (4) API ergonomics / composability and (2) customisability, so the table is
  shipped as this entry file plus sibling parts in `table/`:
    table.jte         -> @@template.table(...)          the <table> wrapper (+ scroll container)
    table/header.jte  -> @@template.table.header(...)   <thead>
    table/body.jte    -> @@template.table.body(...)     <tbody>
    table/footer.jte  -> @@template.table.footer(...)   <tfoot>
    table/row.jte     -> @@template.table.row(...)      <tr> (hover; data-state=selected)
    table/head.jte    -> @@template.table.head(...)     <th scope=col> (muted header cell)
    table/cell.jte    -> @@template.table.cell(...)     <td>
    table/caption.jte -> @@template.table.caption(...)  <caption>

  Accessibility: real <table>/<thead>/<tbody>/<tfoot>/<tr>/<th>/<td>/<caption> elements;
  header cells are <th scope="col"> (row headers pass scope="row"); the caption is the
  accessible name of the table. The wrapper sets overflow-x-auto so wide tables scroll
  without breaking the page (shadcn parity).

  Params:
    klass   - extra classes for the <table>.
    content - the <thead>/<tbody>/<tfoot>/<caption> blocks, composed by the caller.

  Usage:
    @@template.table(content = @@`
      @@template.table.caption(content = @@`Q2 listings`)
      @@template.table.header(content = @@`
        @@template.table.row(content = @@`
          @@template.table.head(content = @@`Ref`)
          @@template.table.head(content = @@`Agent`)
          @@template.table.head(klass = "text-right", content = @@`Price`)
        `)
      `)
      @@template.table.body(content = @@`
        @@template.table.row(content = @@`
          @@template.table.cell(content = @@`A-1024`)
          @@template.table.cell(content = @@`Cecchetto`)
          @@template.table.cell(klass = "text-right", content = @@`240000`)
        `)
      `)
    `)
--%>
@param String klass = ""
@param gg.jte.Content content
<div class="lv-table-container relative w-full overflow-x-auto">
  <table
    class="lv-table w-full caption-bottom text-[var(--lv-text-sm)] ${klass}"
    style="font-family:var(--lv-font-sans);color:var(--lv-color-fg);border-collapse:collapse;"
  >
    ${content}
  </table>
</div>
