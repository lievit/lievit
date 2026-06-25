/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Clusters (the Filament {@code Cluster}): group several resources/pages under one url prefix with a
 * shared sub-navigation and breadcrumb prefix. A {@link dev.lievit.kit.cluster.Cluster} is a page that
 * owns child resources/pages ("Settings" holding Users / Roles / Permissions), registered on a panel
 * via {@code Panel.cluster(...)}. It owns {@code prependClusterSlug} (url prefixing),
 * {@code getSubNavigation} (the in-cluster nav), and {@code canAccessClusteredComponents} (a
 * cluster-level gate).
 */
@NullMarked
package dev.lievit.kit.cluster;

import org.jspecify.annotations.NullMarked;
