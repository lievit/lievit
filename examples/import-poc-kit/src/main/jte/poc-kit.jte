@import io.lievit.kit.StatWidget
<%--
  import-poc-kit consumer template.

  Proves the FULL two-jar import chain:
    1. lievit-maven-plugin:stage-templates stages BOTH lievit/ (from lievit-ui jar)
       AND kit/ (from lievit-kit jar) into one merged jte-src tree.
    2. This template calls @template.kit.widget.stat — a kit template from the lievit-kit jar.
    3. kit/widget/stat.jte in turn calls @template.lievit.stat-card — a lievit-ui primitive.

  If both @template.kit.widget.stat and @template.lievit.stat-card resolve and render,
  the kit->lievit composition chain from imported jars is proven (RFC 0036 full-chain proof).
--%>
@param StatWidget stat
<!DOCTYPE html>
<html lang="en">
<body data-slot="poc-kit-page">
@template.kit.widget.stat(stat = stat)
</body>
</html>
