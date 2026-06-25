/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.maven;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
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
   * @spec.when  stage-templates executes
   * @spec.then  the staging directory contains both lievit/button.jte and poc.jte, proving
   *             the unpack + consumer-merge logic works end-to-end
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

    // --- act ---
    StageTemplatesMojo mojo = new StageTemplatesMojo();
    inject(mojo, "project", fakeProject);
    inject(mojo, "stagingDirectory", stagingDir.toFile());
    inject(mojo, "consumerJteSourceDirectory", consumerJte.toFile());
    inject(mojo, "skip", false);
    mojo.execute();

    // --- assert ---
    assertTrue(Files.exists(stagingDir.resolve("lievit/button.jte")),
        "lievit/button.jte must be extracted from the fake lievit-ui jar");
    assertTrue(Files.exists(stagingDir.resolve("poc.jte")),
        "poc.jte must be copied from the consumer src/main/jte/");
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
    inject(mojo, "skip", false);
    mojo.execute();

    // Nothing from a non-lievit jar must land in the staging dir.
    assertTrue(!Files.exists(stagingDir.resolve("lievit/hijack.jte")),
        "lievit/** from a non-lievit groupId artifact must NOT be extracted");
  }

  // ---- helpers -------------------------------------------------------------------------

  private static void createFakeJar(Path jarPath, String entryName, String content)
      throws IOException {
    try (OutputStream fos = Files.newOutputStream(jarPath);
         ZipOutputStream zos = new ZipOutputStream(fos)) {
      zos.putNextEntry(new ZipEntry(entryName));
      zos.write(content.getBytes(StandardCharsets.UTF_8));
      zos.closeEntry();
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
