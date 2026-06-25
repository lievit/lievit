/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.maven;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.maven.artifact.Artifact;
import org.apache.maven.artifact.DefaultArtifact;
import org.apache.maven.artifact.handler.DefaultArtifactHandler;
import org.apache.maven.project.MavenProject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Unit tests for {@link StageTemplatesMojo}.
 *
 * <p>No Spring context, no Maven runtime. The Mojo is constructed directly and its private fields
 * are injected via reflection (the standard pattern for testing Mojos without the Maven plugin
 * testing harness, which does not support Java 25 yet).
 */
class StageTemplatesMojoTest {

  @TempDir
  Path tmp;

  /**
   * @spec.given a fake lievit-ui jar containing lievit/button.jte + a consumer src/main/jte/
   *             with poc.jte
   * @spec.when  stage-templates executes with no namespace filter (auto mode)
   * @spec.then  the staging directory contains both lievit/button.jte and poc.jte, proving
   *             the unpack + consumer-merge logic works end-to-end (single-lib regression)
   */
  @Test
  void stage_merges_lievit_jar_resources_with_consumer_templates() throws Exception {
    // --- arrange: fake lievit-ui jar with lievit/button.jte inside ---
    Path fakeJar = tmp.resolve("lievit-ui-0.1.0-SNAPSHOT.jar");
    createFakeJar(fakeJar, "lievit/button.jte", "@param String label\n<button>${label}</button>");

    // --- arrange: consumer src/main/jte/poc.jte ---
    Path consumerJte = tmp.resolve("src/main/jte");
    Files.createDirectories(consumerJte);
    Files.writeString(consumerJte.resolve("poc.jte"), "@param String x\n${x}");

    // --- arrange: fake MavenProject with one lievit-ui artifact ---
    Path stagingDir = tmp.resolve("jte-src");
    MavenProject fakeProject = new MavenProject();
    Artifact lievitUi = buildArtifact("io.github.lievit", "lievit-ui", "0.1.0-SNAPSHOT", fakeJar.toFile());
    fakeProject.setArtifacts(Set.of(lievitUi));

    // --- act: no namespace filter (null = auto) ---
    StageTemplatesMojo mojo = new StageTemplatesMojo();
    inject(mojo, "project", fakeProject);
    inject(mojo, "stagingDirectory", stagingDir.toFile());
    inject(mojo, "consumerJteSourceDirectory", consumerJte.toFile());
    inject(mojo, "namespaces", null);
    inject(mojo, "skip", false);
    mojo.execute();

    // --- assert ---
    assertTrue(Files.exists(stagingDir.resolve("lievit/button.jte")),
        "lievit/button.jte must be extracted from the fake lievit-ui jar");
    assertTrue(Files.exists(stagingDir.resolve("poc.jte")),
        "poc.jte must be copied from the consumer src/main/jte/");
  }

  /**
   * @spec.given two fake lievit jars: lievit-ui (lievit/button.jte) and lievit-kit (kit/table.jte)
   * @spec.when  stage-templates executes with no namespace filter (auto mode)
   * @spec.then  the staging directory contains BOTH lievit/button.jte and kit/table.jte,
   *             proving multi-namespace auto-detection from multiple jars works
   */
  @Test
  void stage_extracts_all_jte_namespaces_from_multiple_lievit_jars() throws Exception {
    // --- arrange: fake lievit-ui jar ---
    Path fakeUiJar = tmp.resolve("lievit-ui-0.1.0-SNAPSHOT.jar");
    createFakeJar(fakeUiJar, "lievit/button.jte", "@param String label\n<button>${label}</button>");

    // --- arrange: fake lievit-kit jar with a kit/ entry and a non-.jte entry ---
    Path fakeKitJar = tmp.resolve("lievit-kit-0.1.0-SNAPSHOT.jar");
    createFakeJarMulti(fakeKitJar,
        new String[]{"kit/table.jte",        "@param String title\n<table>${title}</table>"},
        new String[]{"META-INF/MANIFEST.MF",  "Manifest-Version: 1.0\n"},
        new String[]{"kit/SomeClass.class",   "Êþº¾"});  // class file, must NOT be staged

    Path stagingDir = tmp.resolve("jte-src");
    MavenProject fakeProject = new MavenProject();
    Artifact lievitUi  = buildArtifact("io.github.lievit", "lievit-ui",  "0.1.0-SNAPSHOT", fakeUiJar.toFile());
    Artifact lievitKit = buildArtifact("io.github.lievit", "lievit-kit", "0.1.0-SNAPSHOT", fakeKitJar.toFile());
    fakeProject.setArtifacts(Set.of(lievitUi, lievitKit));

    // --- act ---
    StageTemplatesMojo mojo = new StageTemplatesMojo();
    inject(mojo, "project", fakeProject);
    inject(mojo, "stagingDirectory", stagingDir.toFile());
    inject(mojo, "consumerJteSourceDirectory", tmp.resolve("nonexistent").toFile());
    inject(mojo, "namespaces", null);
    inject(mojo, "skip", false);
    mojo.execute();

    // --- assert ---
    assertTrue(Files.exists(stagingDir.resolve("lievit/button.jte")),
        "lievit/button.jte must be extracted from lievit-ui jar");
    assertTrue(Files.exists(stagingDir.resolve("kit/table.jte")),
        "kit/table.jte must be extracted from lievit-kit jar");
    assertFalse(Files.exists(stagingDir.resolve("kit/SomeClass.class")),
        "class files must NOT be staged (only *.jte entries)");
    assertFalse(Files.exists(stagingDir.resolve("META-INF/MANIFEST.MF")),
        "META-INF entries must NOT be staged (only *.jte entries)");
  }

  /**
   * @spec.given two fake lievit jars (lievit-ui: lievit/button.jte, lievit-kit: kit/table.jte)
   *             and a namespace filter restricted to "lievit"
   * @spec.when  stage-templates executes
   * @spec.then  lievit/button.jte is staged and kit/table.jte is NOT staged,
   *             proving the optional namespace filter works
   */
  @Test
  void stage_respects_explicit_namespace_filter() throws Exception {
    Path fakeUiJar = tmp.resolve("lievit-ui-0.1.0-SNAPSHOT.jar");
    createFakeJar(fakeUiJar, "lievit/button.jte", "@param String label\n<button>${label}</button>");

    Path fakeKitJar = tmp.resolve("lievit-kit-0.1.0-SNAPSHOT.jar");
    createFakeJar(fakeKitJar, "kit/table.jte", "@param String title\n<table>${title}</table>");

    Path stagingDir = tmp.resolve("jte-src");
    MavenProject fakeProject = new MavenProject();
    Artifact lievitUi  = buildArtifact("io.github.lievit", "lievit-ui",  "0.1.0-SNAPSHOT", fakeUiJar.toFile());
    Artifact lievitKit = buildArtifact("io.github.lievit", "lievit-kit", "0.1.0-SNAPSHOT", fakeKitJar.toFile());
    fakeProject.setArtifacts(Set.of(lievitUi, lievitKit));

    // --- act: filter to lievit only ---
    StageTemplatesMojo mojo = new StageTemplatesMojo();
    inject(mojo, "project", fakeProject);
    inject(mojo, "stagingDirectory", stagingDir.toFile());
    inject(mojo, "consumerJteSourceDirectory", tmp.resolve("nonexistent").toFile());
    inject(mojo, "namespaces", List.of("lievit"));
    inject(mojo, "skip", false);
    mojo.execute();

    // --- assert ---
    assertTrue(Files.exists(stagingDir.resolve("lievit/button.jte")),
        "lievit/button.jte must be extracted (lievit namespace is in the filter)");
    assertFalse(Files.exists(stagingDir.resolve("kit/table.jte")),
        "kit/table.jte must NOT be extracted (kit namespace is NOT in the filter)");
  }

  /**
   * @spec.given an artifact with a non-lievit groupId in the project's artifact set
   * @spec.when  stage-templates executes
   * @spec.then  the staging directory does NOT contain any entries from that artifact
   *             (only lievit group IDs are scanned)
   */
  @Test
  void stage_ignores_non_lievit_artifacts() throws Exception {
    Path fakeJar = tmp.resolve("some-other-lib.jar");
    createFakeJar(fakeJar, "lievit/hijack.jte", "malicious");

    Path stagingDir = tmp.resolve("jte-src");
    MavenProject fakeProject = new MavenProject();
    Artifact other = buildArtifact("com.example", "other-lib", "1.0", fakeJar.toFile());
    fakeProject.setArtifacts(Set.of(other));

    StageTemplatesMojo mojo = new StageTemplatesMojo();
    inject(mojo, "project", fakeProject);
    inject(mojo, "stagingDirectory", stagingDir.toFile());
    inject(mojo, "consumerJteSourceDirectory", tmp.resolve("nonexistent").toFile());
    inject(mojo, "namespaces", null);
    inject(mojo, "skip", false);
    mojo.execute();

    // Nothing from a non-lievit jar must land in the staging dir.
    assertFalse(Files.exists(stagingDir.resolve("lievit/hijack.jte")),
        "lievit/** from a non-lievit groupId artifact must NOT be extracted");
  }

  // ---- helpers -------------------------------------------------------------------------

  private static void createFakeJar(Path jarPath, String entryName, String content)
      throws IOException {
    createFakeJarMulti(jarPath, new String[]{entryName, content});
  }

  /** Creates a jar with multiple entries. Each element of {@code entries} is a {name, content} pair. */
  @SafeVarargs
  private static void createFakeJarMulti(Path jarPath, String[]... entries)
      throws IOException {
    try (OutputStream fos = Files.newOutputStream(jarPath);
         ZipOutputStream zos = new ZipOutputStream(fos)) {
      for (String[] entry : entries) {
        zos.putNextEntry(new ZipEntry(entry[0]));
        zos.write(entry[1].getBytes(StandardCharsets.UTF_8));
        zos.closeEntry();
      }
    }
  }

  private static Artifact buildArtifact(String groupId, String artifactId, String version, File file) {
    DefaultArtifact artifact = new DefaultArtifact(
        groupId, artifactId, version, "compile", "jar", null,
        new DefaultArtifactHandler("jar"));
    artifact.setFile(file);
    artifact.setResolved(true);
    return artifact;
  }

  /** Injects a value into a private field on the mojo (standard no-harness Mojo testing). */
  private static void inject(Object target, String fieldName, Object value) throws Exception {
    Field field = findField(target.getClass(), fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  private static Field findField(Class<?> clazz, String name) throws NoSuchFieldException {
    try {
      return clazz.getDeclaredField(name);
    } catch (NoSuchFieldException e) {
      if (clazz.getSuperclass() != null) {
        return findField(clazz.getSuperclass(), name);
      }
      throw e;
    }
  }
}
