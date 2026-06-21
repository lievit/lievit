@import io.lievit.kit.StatWidget
@import io.lievit.kit.IconPosition
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.widget.stat - renders ONE io.lievit.kit.StatWidget as the lievit-ui stat-card
  (the Filament StatsOverview stat / KPI card). This is the widget twin of kit.table.rich-cell: the
  single canonical place a kit StatWidget paints onto the lievit-ui presentational primitive, so an
  adopter stops hand-assembling a KPI card per dashboard.

  The StatWidget carries (issue #309): heading, value() (a Supplier already resolved to a String by
  the controller / the model accessor), description, a leading icon() (an io.lievit.kit.Icon alias),
  a color() (io.lievit.kit.Color, semantic name), a descriptionIcon() + descriptionIconPosition()
  (the trend arrow before/after the description), an optional chart() sparkline (small line of
  values), and an optional url() + opensInNewTab() turning the whole card into a link.

  The mapping onto lievit-ui stat-card:
    heading            -> heading
    value()            -> value
    description()       -> description (omitted when empty)
    icon()             -> icon (the Icon alias as the glyph name; the theme's IconRegistry resolves it)
    color()            -> color (the semantic Color name, mapped to a --lv-color-* tint by the card)
    descriptionIcon()  -> descriptionIcon (the trend glyph) + iconPosition (before|after)
    url()/opensInNewTab() -> url + newTab (whole-card stretched-link, ONE always-present <a>)
    chart()            -> a server-pure SVG sparkline (lievit-ui chart, type=line) in the chart slot

  Server-first, token-driven, strict-CSP clean: the card is the lievit-ui partial (zero inline
  script), the sparkline is the server-rendered chart SVG, the link is a real <a href>. The Icon
  alias is passed as the glyph name string (the same seam kit.table.rich-cell uses for Cell.Icon):
  alias-to-glyph resolution is the theme's IconRegistry concern, out of this render's scope.

  Params: stat - the StatWidget to render.
--%>
@param StatWidget stat
!{var iconPosToken = stat.descriptionIconPosition() == IconPosition.AFTER ? "after" : "before";}
@template.lievit.stat-card(
  heading = stat.heading(),
  value = stat.value(),
  description = stat.description().orElse(null),
  icon = stat.icon().map(io.lievit.kit.Icon::alias).orElse(null),
  descriptionIcon = stat.descriptionIcon().map(io.lievit.kit.Icon::alias).orElse(null),
  iconPosition = iconPosToken,
  color = stat.color().map(io.lievit.kit.Color::name).orElse(null),
  url = stat.url().orElse(null),
  newTab = stat.opensInNewTab(),
  chart = stat.chart().isEmpty() ? null : @`
    !{var values = stat.chart().get();}
    !{int[] points = new int[values.size()];}
    !{for (int i = 0; i < values.size(); i++) points[i] = values.get(i).intValue();}
    !{String[] cats = new String[points.length];}
    !{for (int i = 0; i < cats.length; i++) cats[i] = "";}
    !{String tint = stat.color().map(c -> "var(--lv-color-" + c.name() + ")").orElse("var(--lv-color-chart-1)");}
    @template.lievit.chart(label = stat.heading() + " trend", categories = cats, values = points,
      type = "line", color = tint, showAxis = false, height = 64, width = 240)
  `
)
