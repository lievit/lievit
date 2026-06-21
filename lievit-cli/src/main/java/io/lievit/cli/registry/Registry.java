package io.lievit.cli.registry;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The consolidated registry the copy-in CLI resolves against — the Java mirror of lievit-ui's
 * {@code registry.ts} schema, deserialized from the {@code registry.json} that {@code npm run
 * build:registry} produces. The CLI is a strict consumer: it reads the manifest, follows
 * {@code registryDependencies}, and copies each item's verbatim {@code content} into the adopter's
 * tree (shadcn copy-in, ADR-0009). Only the fields the CLI uses are typed; unknown fields are
 * ignored so the registry can grow on the lievit-ui side without breaking the Java CLI.
 *
 * @param schema   the optional {@code $schema} URL (documentation only)
 * @param name     the registry name (e.g. {@code lievit-ui})
 * @param homepage the registry homepage
 * @param items    the catalog of resolvable items
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record Registry(
        @JsonProperty("$schema") String schema,
        String name,
        String homepage,
        List<Item> items) {

    public Registry {
        items = items == null ? List.of() : List.copyOf(items);
    }

    /** Finds an item by name, or {@code null} when the registry does not contain it. */
    public Item find(String itemName) {
        for (Item item : items) {
            if (item.name().equals(itemName)) {
                return item;
            }
        }
        return null;
    }

    /**
     * Resolves the requested names to the transitive closure of items (the requested ones plus
     * everything reachable via {@code registryDependencies}), topologically ordered so a dependency
     * is always emitted before the item that needs it. Mirrors {@code resolve()} in registry.ts.
     *
     * <p>Cycle-safe: an item already on the resolution stack is not re-entered. Throws on an unknown
     * name — a dangling dependency edge is a registry defect, and a missing requested name is an
     * adopter error; both must fail loudly rather than silently copy nothing.
     *
     * @param names the item names requested on the command line
     * @return the ordered list of items to copy (dependencies first)
     * @throws IllegalArgumentException if any requested name or dependency edge is unknown
     */
    public List<Item> resolve(List<String> names) {
        Map<String, Item> byName = new LinkedHashMap<>();
        for (Item item : items) {
            byName.put(item.name(), item);
        }
        List<Item> ordered = new ArrayList<>();
        Set<String> done = new LinkedHashSet<>();
        Set<String> inProgress = new LinkedHashSet<>();
        for (String name : names) {
            visit(name, byName, ordered, done, inProgress);
        }
        return ordered;
    }

    private static void visit(
            String name,
            Map<String, Item> byName,
            List<Item> ordered,
            Set<String> done,
            Set<String> inProgress) {
        if (done.contains(name) || inProgress.contains(name)) {
            return;
        }
        Item item = byName.get(name);
        if (item == null) {
            throw new IllegalArgumentException("unknown registry item: " + name);
        }
        inProgress.add(name);
        for (String dep : item.registryDependencies()) {
            visit(dep, byName, ordered, done, inProgress);
        }
        inProgress.remove(name);
        done.add(name);
        ordered.add(item);
    }

    /**
     * A single registry item: the unit {@code lievit add} resolves and copies.
     *
     * @param name                 unique item name (the {@code add} argument)
     * @param type                 registry type tag (e.g. {@code registry:jte})
     * @param description          one-line description
     * @param registryDependencies other items, by name, this one needs (copied transitively)
     * @param files                the source files copied into the adopter's tree
     * @param docs                 post-copy instruction printed to the adopter (may be empty)
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(
            String name,
            String type,
            String description,
            List<String> registryDependencies,
            List<File> files,
            String docs) {

        public Item {
            registryDependencies =
                    registryDependencies == null ? List.of() : List.copyOf(registryDependencies);
            files = files == null ? List.of() : List.copyOf(files);
            docs = docs == null ? "" : docs;
        }
    }

    /**
     * A copied file inside an item. {@code target} is resolved under the root named by {@code root}
     * ({@code "java"} / {@code "jte"} / absent = the {@code "alias"} single root), exactly as in
     * registry.ts (ADR-0012 server-first two-root copy-in).
     *
     * @param path    source path relative to the registry root (provenance only)
     * @param type    the file's registry type tag
     * @param target  destination relative to the resolved root (e.g. {@code lievit/button.jte})
     * @param root    which adopter root resolves {@code target}; absent = {@code alias}
     * @param content the inlined verbatim file content the CLI writes
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record File(String path, String type, String target, String root, String content) {

        public File {
            content = content == null ? "" : content;
        }
    }
}
