/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * stage-templates: the RFC 0036 import recipe as a single Maven goal.
 *
 * What this does (replacing the 3-plugin hand-wiring in import-poc):
 *   1. Walk the consumer's resolved compile-scope artifacts.
 *   2. For each artifact whose groupId is "io.github.lievit", open its jar and extract
 *      every *.jte entry into the staging directory, preserving the top-level namespace
 *      directory (e.g. lievit/button.jte -> jte-src/lievit/button.jte,
 *      kit/table.jte -> jte-src/kit/table.jte). Non-.jte resources (lievit-runtime/**,
 *      .class files, META-INF, etc.) are naturally excluded by the .jte suffix filter.
 *   3. Copy the consumer's own JTE sources (consumerJteSourceDirectory) alongside,
 *      preserving their relative paths.
 *
 * After execute() the stagingDirectory contains:
 *   lievit/button.jte, lievit/badge.jte, ...   (from lievit-ui jar)
 *   kit/table.jte, kit/widget/stat.jte, ...    (from lievit-kit jar)
 *   poc.jte, my-feature.jte, ...               (from consumer's src/main/jte/)
 *
 * The consumer then points jte-maven-plugin:precompile's sourceDirectory at stagingDirectory —
 * one merged tree, one precompile run, correct @template.lievit.* and @template.kit.* resolution.
 *
 * Extraction uses java.util.zip.ZipFile (JDK stdlib, no extra dep). The .jte suffix filter is
 * the canonical selector: every lievit module ships its templates as *.jte in the jar, under a
 * top-level namespace directory matching the @template.* call prefix. No hard-wired prefix list
 * is needed — the filter is "ends with .jte".
 *
 * An optional <namespaces> config param lets the consumer restrict extraction to specific
 * top-level namespace directories (e.g. <namespace>lievit</namespace>). When omitted (default),
 * all *.jte entries from every io.github.lievit:* jar are extracted (best DX: add deps + plugin,
 * get everything).
 */
package io.lievit.maven;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Enumeration;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import org.apache.maven.artifact.Artifact;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.LifecyclePhase;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;
import org.apache.maven.plugins.annotations.ResolutionScope;
import org.apache.maven.project.MavenProject;

/**
 * Stages lievit JTE templates from all {@code io.github.lievit:*} dependency jars for
 * precompilation.
 *
 * <p>Resolves every {@code io.github.lievit:*} compile-scope artifact, extracts every {@code
 * *.jte} entry from their jars into {@code stagingDirectory} preserving the namespace path (e.g.
 * {@code lievit/button.jte}, {@code kit/table.jte}), then copies the consumer's own JTE sources
 * alongside. The result is one merged directory that the {@code jte-maven-plugin:precompile} goal
 * reads as its {@code sourceDirectory}.
 *
 * <p>Namespace detection is automatic by default: every {@code *.jte} entry from every {@code
 * io.github.lievit:*} jar is staged, preserving its top-level directory (the JTE namespace). The
 * optional {@code <namespaces>} parameter restricts extraction to specific top-level directories.
 *
 * <p>Minimal consumer pom (instead of three hand-wired plugins):
 *
 * <pre>{@code
 * <plugin>
 *   <groupId>io.github.lievit</groupId>
 *   <artifactId>lievit-maven-plugin</artifactId>
 *   <version>0.1.0-SNAPSHOT</version>
 *   <executions>
 *     <execution>
 *       <goals><goal>stage-templates</goal></goals>
 *     </execution>
 *   </executions>
 * </plugin>
 * }</pre>
 */
@Mojo(
    name = "stage-templates",
    defaultPhase = LifecyclePhase.GENERATE_SOURCES,
    requiresDependencyResolution = ResolutionScope.COMPILE,
    threadSafe = true)
public class StageTemplatesMojo extends AbstractMojo {

  /** GroupId of lievit artifacts whose jars are scanned for *.jte resources. */
  private static final String LIEVIT_GROUP_ID = "io.github.lievit";

  // ---- injected by Maven ---------------------------------------------------------------

  /** The current Maven project (read-only, injected by Maven). */
  @Parameter(defaultValue = "${project}", readonly = true, required = true)
  private MavenProject project;

  // ---- configurable parameters ---------------------------------------------------------

  /**
   * Directory into which the merged JTE tree is staged. The jte-maven-plugin:precompile goal must
   * point its {@code sourceDirectory} here.
   *
   * <p>Default: {@code ${project.build.directory}/jte-src}.
   */
  @Parameter(
      defaultValue = "${project.build.directory}/jte-src",
      property = "lievit.stagingDirectory")
  private File stagingDirectory;

  /**
   * The consumer's own JTE source directory. Its contents are copied into {@code stagingDirectory}
   * alongside the lievit templates. Set to a non-existent path to skip (e.g. if the consumer has
   * no own templates).
   *
   * <p>Default: {@code ${project.basedir}/src/main/jte}.
   */
  @Parameter(
      defaultValue = "${project.basedir}/src/main/jte",
      property = "lievit.consumerJteSourceDirectory")
  private File consumerJteSourceDirectory;

  /**
   * Optional list of top-level namespace directories to extract from lievit jars. When empty or
   * omitted, ALL {@code *.jte} entries from every {@code io.github.lievit:*} jar are extracted
   * (auto-detect mode — the recommended default: add the dep, get the templates). When specified,
   * only entries whose first path segment matches one of the listed names are extracted (e.g.
   * {@code <namespace>lievit</namespace>} extracts only {@code lievit/*.jte}).
   *
   * <p>Example (explicit namespaces):
   * <pre>{@code
   * <namespaces>
   *   <namespace>lievit</namespace>
   *   <namespace>kit</namespace>
   * </namespaces>
   * }</pre>
   */
  @Parameter
  private List<String> namespaces;

  /**
   * Whether to skip the goal entirely.
   *
   * <p>Default: {@code false}.
   */
  @Parameter(defaultValue = "false", property = "lievit.skipStage")
  private boolean skip;

  // --------------------------------------------------------------------------------------

  @Override
  public void execute() throws MojoExecutionException, MojoFailureException {
    if (skip) {
      getLog().info("lievit:stage-templates skipped (lievit.skipStage=true).");
      return;
    }

    Path staging = stagingDirectory.toPath();
    try {
      Files.createDirectories(staging);
    } catch (IOException e) {
      throw new MojoExecutionException(
          "Cannot create staging directory: " + staging, e);
    }

    // Resolve the effective namespace filter (null/empty = accept all *.jte).
    boolean filterByNamespace = namespaces != null && !namespaces.isEmpty();
    if (filterByNamespace) {
      getLog().info("lievit:stage-templates: namespace filter active: " + namespaces);
    } else {
      getLog().info("lievit:stage-templates: namespace filter: auto (all *.jte from lievit jars)");
    }

    // Step 1: extract *.jte resources from every io.github.lievit:* artifact.
    Set<Artifact> artifacts = project.getArtifacts();
    if (artifacts == null || artifacts.isEmpty()) {
      getLog().warn(
          "lievit:stage-templates: no resolved artifacts found. "
              + "Ensure requiresDependencyResolution=COMPILE is honoured and the project "
              + "declares at least one io.github.lievit:* dependency.");
    }
    int extractedTotal = 0;
    for (Artifact artifact : artifacts) {
      if (!LIEVIT_GROUP_ID.equals(artifact.getGroupId())) {
        continue;
      }
      File jarFile = artifact.getFile();
      if (jarFile == null || !jarFile.isFile()) {
        getLog().warn(
            "lievit:stage-templates: artifact "
                + artifact.getId()
                + " has no local file (not yet resolved?), skipping.");
        continue;
      }
      int extracted = extractJteResources(jarFile, staging, artifact.getId(), filterByNamespace);
      extractedTotal += extracted;
      getLog().info(
          "lievit:stage-templates: extracted "
              + extracted
              + " *.jte entries from "
              + artifact.getId());
    }
    if (extractedTotal == 0) {
      getLog().warn(
          "lievit:stage-templates: no *.jte entries extracted. "
              + "Check that at least one io.github.lievit:* artifact with JTE templates "
              + "is on the compile classpath.");
    } else {
      getLog().info("lievit:stage-templates: " + extractedTotal + " *.jte entries staged.");
    }

    // Step 2: copy consumer's own JTE sources into the staging dir alongside lievit/.
    if (consumerJteSourceDirectory != null && consumerJteSourceDirectory.isDirectory()) {
      try {
        int copied = copyDirectory(consumerJteSourceDirectory.toPath(), staging);
        getLog().info(
            "lievit:stage-templates: copied "
                + copied
                + " consumer JTE files from "
                + consumerJteSourceDirectory);
      } catch (IOException e) {
        throw new MojoExecutionException(
            "Failed to copy consumer JTE sources from " + consumerJteSourceDirectory, e);
      }
    } else {
      getLog().debug(
          "lievit:stage-templates: consumerJteSourceDirectory does not exist ("
              + consumerJteSourceDirectory
              + "), skipping consumer copy.");
    }
  }

  /**
   * Extracts all {@code *.jte} entries from {@code jarFile} into {@code staging}, preserving the
   * entry path (so {@code lievit/button.jte} lands as {@code staging/lievit/button.jte} and {@code
   * kit/table.jte} lands as {@code staging/kit/table.jte}).
   *
   * <p>When {@code filterByNamespace} is {@code true}, only entries whose first path segment
   * matches one of the configured {@link #namespaces} are extracted. When {@code false}, every
   * {@code *.jte} entry in the jar is extracted regardless of its top-level directory.
   *
   * <p>Non-{@code .jte} entries (class files, META-INF, TS sources under {@code lievit-runtime/},
   * etc.) are always excluded by the {@code .jte} suffix check.
   *
   * @return the number of entries written
   */
  private int extractJteResources(
      File jarFile, Path staging, String artifactId, boolean filterByNamespace)
      throws MojoExecutionException {
    int count = 0;
    try (ZipFile zip = new ZipFile(jarFile)) {
      Enumeration<? extends ZipEntry> entries = zip.entries();
      while (entries.hasMoreElements()) {
        ZipEntry entry = entries.nextElement();
        if (entry.isDirectory()) {
          continue;
        }
        String name = entry.getName();
        // Only stage JTE template sources; skip class files, TS, CSS, META-INF, etc.
        if (!name.endsWith(".jte")) {
          continue;
        }
        // Optional namespace filter: check the first path segment against the configured list.
        if (filterByNamespace) {
          int slash = name.indexOf('/');
          String topLevel = slash >= 0 ? name.substring(0, slash) : name;
          if (!namespaces.contains(topLevel)) {
            continue;
          }
        }
        Path target = staging.resolve(name);
        // Zip-slip guard: the resolved path must stay inside the staging root.
        if (!target.toAbsolutePath().startsWith(staging.toAbsolutePath())) {
          throw new MojoExecutionException(
              "Zip-slip guard triggered for entry '"
                  + name
                  + "' in artifact "
                  + artifactId
                  + ". Refusing to extract.");
        }
        Files.createDirectories(target.getParent());
        try (InputStream in = zip.getInputStream(entry);
            OutputStream out = Files.newOutputStream(target)) {
          in.transferTo(out);
        }
        count++;
      }
    } catch (IOException e) {
      throw new MojoExecutionException(
          "Failed to extract *.jte resources from " + jarFile, e);
    }
    return count;
  }

  /**
   * Recursively copies all files from {@code src} into {@code dest}, preserving relative paths.
   * Directories are created as needed. Existing files at the destination are overwritten (consumer
   * templates override lievit templates of the same name — RFC 0036 publish-to-customize pattern).
   *
   * @return the number of files copied
   */
  private int copyDirectory(Path src, Path dest) throws IOException {
    int[] count = {0};
    Files.walk(src).forEach(sourcePath -> {
      if (Files.isDirectory(sourcePath)) {
        return;
      }
      Path relative = src.relativize(sourcePath);
      Path target = dest.resolve(relative);
      try {
        Files.createDirectories(target.getParent());
        Files.copy(sourcePath, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        count[0]++;
      } catch (IOException e) {
        // Wrap in unchecked — the caller catches IOException from Files.walk's stream.
        throw new java.io.UncheckedIOException(e);
      }
    });
    return count[0];
  }
}
