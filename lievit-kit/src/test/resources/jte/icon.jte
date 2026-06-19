<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  Minimal icon partial stub for the kit wire test. The shipped registry icon.jte imports an
  adopter-supplied LievitIcons.body(name) map (gest provides one); the kit test does not ship that
  map, so this stub renders the uniform token-sized <svg> wrapper with no inner body. It is enough
  to prove the wire template COMPOSES the icon partial (@template.icon) through the real JTE engine;
  the icon body map is an adopter concern, covered where the map exists.
--%>
@param String name
@param String size = "var(--lv-icon-size)"
@param String cssClass = ""
@param String label = null
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  width="${size}"
  height="${size}"
  fill="none"
  stroke="currentColor"
  data-icon="${name}"
  aria-hidden="true"
  focusable="false"
  class="${cssClass}"></svg>
