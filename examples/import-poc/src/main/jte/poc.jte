<%--
  import-poc consumer template. Proves @template.lievit.button resolves from the imported
  lievit-ui jar (not a filesystem sibling): the lievit/ directory arrived via unpack+merge,
  not a manual copy-in. If the precompile fails here, the import path is broken.
--%>
@param String label = "Save"
<!DOCTYPE html>
<html lang="en">
<body>
@template.lievit.button(variant = "primary", content = @`${label}`)
</body>
</html>
