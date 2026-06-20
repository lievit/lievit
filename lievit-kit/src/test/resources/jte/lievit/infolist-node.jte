@import java.util.Map
@import io.lievit.kit.schema.infolist.ResolvedNode
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  Renders ONE resolved infolist node (the structured read of an Infolist schema), recursing into its
  children. The closed set of node kinds (the sealed ResolvedNode permit set) maps 1:1 to a branch:
  a section (heading/description/icon/aside/collapsible/columns + children), a tabs container
  (active tab + persistence/orientation/contained + tabs), a fieldset (legend + children), a grid
  (bare columns + children), a key-value table (the resolveMap output, the audit's unwired fix), and
  a leaf field (label + projected display + kind + span). Layout containers carry their column count
  in data-* so a renderer/test can assert the grid; visibility was already applied at resolve time
  (a hidden component is simply absent from the tree).
--%>
@param ResolvedNode node
@if(node instanceof ResolvedNode.SectionNode s)
    <section
        data-lv-infolist-section
        data-lv-section-columns="${s.columns()}"
        data-lv-section-aside="${s.aside() ? "true" : "false"}"
        data-lv-section-collapsible="${s.collapsible() ? "true" : "false"}"
        data-lv-section-collapsed="${s.collapsed() ? "true" : "false"}"
        style="grid-column: span ${s.columnSpan()};"
    >
        @if(s.hasHeading())
            <h2 data-lv-section-heading>
                @if(s.icon() != null)
                    @template.icon(name = s.icon(), size = "1rem")
                @endif
                ${s.heading()}
            </h2>
        @endif
        @if(s.description() != null)
            <p data-lv-section-description>${s.description()}</p>
        @endif
        <div data-lv-section-body style="display: grid; grid-template-columns: repeat(${s.columns()}, minmax(0, 1fr));">
            @for(ResolvedNode child : s.children())
                @template.lievit.infolist-node(node = child)
            @endfor
        </div>
    </section>
@elseif(node instanceof ResolvedNode.TabsNode t)
    <div
        data-lv-infolist-tabs
        data-lv-tabs-active="${t.activeTabId()}"
        data-lv-tabs-persist="${t.persistInQueryString() ? "true" : "false"}"
        data-lv-tabs-vertical="${t.vertical() ? "true" : "false"}"
        data-lv-tabs-contained="${t.contained() ? "true" : "false"}"
    >
        <div role="tablist" data-lv-tabs-strip aria-orientation="${t.vertical() ? "vertical" : "horizontal"}">
            @for(ResolvedNode.TabNode tab : t.tabs())
                <button
                    type="button"
                    role="tab"
                    id="lv-tab-${tab.id()}"
                    data-lv-tab="${tab.id()}"
                    aria-controls="lv-tabpanel-${tab.id()}"
                    aria-selected="${tab.id().equals(t.activeTabId()) ? "true" : "false"}"
                >
                    @if(tab.icon() != null)
                        @template.icon(name = tab.icon(), size = "1rem")
                    @endif
                    ${tab.label()}
                </button>
            @endfor
        </div>
        @for(ResolvedNode.TabNode tab : t.tabs())
            <div
                role="tabpanel"
                id="lv-tabpanel-${tab.id()}"
                data-lv-tabpanel="${tab.id()}"
                aria-labelledby="lv-tab-${tab.id()}"
                hidden="${!tab.id().equals(t.activeTabId())}"
                style="display: grid; grid-template-columns: repeat(${tab.columns()}, minmax(0, 1fr));"
            >
                @for(ResolvedNode child : tab.children())
                    @template.lievit.infolist-node(node = child)
                @endfor
            </div>
        @endfor
    </div>
@elseif(node instanceof ResolvedNode.FieldsetNode f)
    <fieldset data-lv-infolist-fieldset data-lv-fieldset-columns="${f.columns()}" style="grid-column: span ${f.columnSpan()};">
        <legend data-lv-fieldset-legend>${f.label()}</legend>
        <div data-lv-fieldset-body style="display: grid; grid-template-columns: repeat(${f.columns()}, minmax(0, 1fr));">
            @for(ResolvedNode child : f.children())
                @template.lievit.infolist-node(node = child)
            @endfor
        </div>
    </fieldset>
@elseif(node instanceof ResolvedNode.GridNode g)
    <div data-lv-infolist-grid data-lv-grid-columns="${g.columns()}" style="display: grid; grid-template-columns: repeat(${g.columns()}, minmax(0, 1fr)); grid-column: span ${g.columnSpan()};">
        @for(ResolvedNode child : g.children())
            @template.lievit.infolist-node(node = child)
        @endfor
    </div>
@elseif(node instanceof ResolvedNode.KeyValue kv)
    <div data-lv-infolist-entry="${kv.label()}" data-lv-entry-kind="keyvalue">
        <dt data-lv-entry-label>${kv.label()}</dt>
        <dd>
            <table data-lv-keyvalue>
                <thead><tr><th>${kv.keyLabel()}</th><th>${kv.valueLabel()}</th></tr></thead>
                <tbody>
                    @if(kv.hasPairs())
                        @for(Map.Entry<String, String> pair : kv.pairs().entrySet())
                            <tr data-lv-keyvalue-row="${pair.getKey()}"><td>${pair.getKey()}</td><td>${pair.getValue()}</td></tr>
                        @endfor
                    @else
                        <tr data-lv-keyvalue-empty><td colspan="2"></td></tr>
                    @endif
                </tbody>
            </table>
        </dd>
    </div>
@elseif(node instanceof ResolvedNode.Field fld)
    <div data-lv-infolist-entry="${fld.label()}" data-lv-entry-kind="${fld.kind()}" style="grid-column: span ${fld.columnSpan()};">
        <dt data-lv-entry-label>${fld.label()}</dt>
        <dd data-lv-entry-value>${fld.display()}</dd>
    </div>
@endif
