<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# 07 — Distribution design (consumable-by-import) — docs-first findings

Stato: RICERCA (2026-06-25). Solo design, NON ancora implementato. Output del docs-first che la RFC 0036 richiede prima di ogni stadio. Sblocca la promozione RFC 0036 -> ADR sw-architecture-007 e, a valle, il cutover gest.
Fonti: 4 deep-research paralleli (JTE jar/precompile, runtime JS per app Java, meccanica Maven, prior art cross-ecosistema), tutti con URL in fondo a questo file + nei transcript.

## Il problema

lievit-ui oggi è un **copy-in registry** (modello shadcn, `private:true`, niente jar): l'adopter copia i `.jte` + il runtime TS. La RFC 0036 ha lockato la direzione: **import come default, copy-in come opt-out**. Mancava il COME. Questo documento lo porta, docs-first.
Tre artefatti, tre canali diversi: (1) i template `.jte`; (2) il runtime TS + i token CSS; (3) le classi Java di supporto. Più: la coesistenza del namespace `lievit.*` e la postura no-CDN/first-party.

## Reperto chiave (verificato avversarialmente sul sorgente JTE)

**JTE non ha un percorso canonico jar-import-precompile.** Il `jte-maven-plugin` (`generate`/`precompile`) prende UNA `sourceDirectory` filesystem (hardcoded `new DirectoryCodeResolver(path)`); non legge i `.jte` da un jar di dipendenza. È un gap noto e aperto (issue #449, #278; nessun piano del maintainer). Quindi l'import-distribution si costruisce su meccanismi documentati ma non-nativi: la complessità va messa UNA volta, nel build, in modo canonico.
Esistono però due risorse JTE che abilitano la soluzione: `ResourceCodeResolver` (legge `.jte` dal CLASSPATH via `ClassLoader.getResourceAsStream`, ma è runtime/dev-mode) e `TemplateEngine.createPrecompiled(ContentType.Html)` (carica le CLASSI precompilate dal classloader dell'app, **inclusi i jar di dipendenza**).

## Design raccomandato (per artefatto)

### A. Template `.jte` — doppio canale nel jar di lievit-ui

Il jar `io.lievit:lievit-ui` spedisce ENTRAMBI:
1. **i `.class` precompilati** (lievit gira il `jte precompile` nel SUO build, package di default `gg.jte.generated.precompiled`): il consumer in PROD usa `usePrecompiledTemplates=true` -> `createPrecompiled(ContentType.Html)` (autoconfig Spring Boot 4) li carica dal classpath **zero-config**. Funziona perché entrambi usano lo stesso package precompiled. È il path più vicino a "vero import, consumo zero-config".
2. **i `.jte` sorgente** come risorse classpath sotto `lievit/` (es. `lievit/button.jte`): servono per il DEV-mode e per chi vuole il gate di compilazione completo nel proprio CI.

Per il DEV-mode (hot-reload) il consumer riceve da lievit una **`LievitJteAutoConfiguration`** (SPI Spring Boot, `META-INF/spring/...AutoConfiguration.imports`) che, quando NON precompiled, registra un **`CompositeCodeResolver`**: prima il `DirectoryCodeResolver` del consumer (`src/main/jte/`, le SUE override vincono), poi in fallback un `ResourceCodeResolver("lievit", classLoader)` (i primitivi lievit dal jar). È l'esatto analogo Java del cascade `loadViewsFrom` di Laravel/Blade: override del consumer > template di libreria.
- Namespace: il nome-template deriva dal path relativo, quindi `lievit/button.jte` -> `@template.lievit.button(...)`. Coesiste pulito perché ogni libreria sta sotto il suo prefisso (niente collisioni stile Thymeleaf-scan-globale).

OPZIONE per chi vuole il gate-di-compilazione nel proprio build (non solo le classi pre-compilate): `maven-dependency-plugin:unpack` (@generate-sources) estrae i `.jte` dal jar -> `maven-resources-plugin:copy-resources` (@process-sources) li MERGE con i template dell'app sotto `lievit/` (un solo dir, perché il `jte precompile` PULISCE il targetDirectory a ogni esecuzione: niente esecuzioni multiple) -> un solo `jte precompile` (@process-classes). Più lento ma cattura gli errori di template in CI.

### B. Runtime TS + token CSS — WebJar first-party (no-CDN, CSP-clean)

Il pattern canonico del mondo Java (htmx, Turbo, Alpine, Lit, Vaadin spediscono tutti così): un **WebJar custom**.
- lievit-ui builda il TS in UN bundle ESM (`dist/lievit-ui.esm.js` + `lievit-ui.css`) e lo impacchetta nel jar sotto `META-INF/resources/webjars/lievit-ui/<version>/` + un `META-INF/resources/webjars-locator.properties` (così `webjars-locator-lite`, il default Spring Boot 3.4+, lo auto-scopre anche se il groupId non è `org.webjars`).
- Spring Boot 4 serve `/webjars/**` da `classpath:/META-INF/resources/webjars/` **zero-config**. Il consumer fa `<script type="module" src="/webjars/lievit-ui/lievit-ui.esm.js">` + `<link href="/webjars/lievit-ui/lievit-ui.css">`.
- **CSP `script-src 'self'`**: il modulo è servito dalla STESSA origine (no nonce necessario per il `<script src>`). Solo un eventuale `<script type="importmap">` inline avrebbe bisogno del nonce per-request. lievit è già CSP-clean (no eval, no inline handler): regge la policy più stretta. **Postura no-CDN soddisfatta**: tutto first-party, dal classpath.
- UN solo `npm run build` -> UN `dist/` -> alimenta SIA il WebJar SIA un'eventuale publish npm (canali indipendenti, stesso artefatto).

### C. copy-in = l'escape-hatch "publish-to-customize" (valida RFC 0036)

Il prior art (Flux UI per Laravel, Vaadin, il cascade Thymeleaf) dice che il modello vincente per le librerie di componenti server-rendered è **import-first con publish-to-customize**: importi e usi così per l'80%, e quando UN componente ti serve con markup tuo lo "pubblichi" (copi il suo `.jte` nel tuo `src/main/jte/lievit/`), dove il `CompositeCodeResolver` lo fa vincere sul fallback di libreria. È esattamente la decisione RFC 0036: **import default, `lievit add` (copy-in) come opt-out per evitare lock-in**. Il design la realizza nativamente (il publish È solo copiare il file: l'override vince per cascade).

## Roadmap a fasi (proposta, ognuna spedibile)

- **Fase 1 (ora, lievit-ui privato)**: il runtime resta vendorizzato (il `dist/` pre-buildato copiato in `gest/.../static/vendor/lievit-ui/`, come gest già fa). Zero infrastruttura nuova. Sblocca il cutover gest SENZA il jar.
- **Fase 2 (lievit-ui pubblico / 2° consumer Java)**: si crea il modulo Maven `lievit-ui` (jar) con il WebJar del runtime + i `.class` precompilati + i `.jte` sorgente + la `LievitJteAutoConfiguration`; publish su Maven Central (o JitPack come bootstrap). Il consumer aggiunge UNA `<dependency>`.
- **Fase 3 (open-source JS-first)**: npm dual-publish (stesso `dist/`, `exports`/ESM, togli `private:true`).

## Decisioni aperte per Francesco (da lockare prima di implementare)

1. **Template: precompiled-class-in-jar (M2, zero-config consumer) come primario, o l'unpack+precompile (M1, gate completo in CI consumer)?** Raccomando M2 primario + i `.jte` sorgente shippati comunque per dev/CI. (Una `CompositeCodeResolver` completa per il `precompile` plugin non esiste built-in: per il gate-in-CI serve M1.)
2. **Runtime: restare vendorizzati (Fase 1) finché lievit è privato, o fare subito il WebJar (Fase 2)?** Il vendoring sblocca il cutover gest ORA senza pubblicare nulla; il WebJar è il "fatto bene" definitivo ma richiede il modulo Maven + il publish.
3. **Quando lievit-ui diventa pubblico** (decide il timing di Fase 2/3 e quindi della promozione ADR).
4. **groupId/coordinate** del jar (`io.lievit:lievit-ui`) e repo di publish (Central vs JitPack vs privato).

Niente di tutto questo è una porta a senso unico finché lievit-ui è privato e il branch non è mergiato: si può lockare il design ora e implementare a fasi sul tuo via, esattamente come la RFC 0036 prescrive.

## Fonti (deep-research 2026-06-25)

JTE: ResourceCodeResolver.java, CompilerMojo.java, GeneratorMojo.java, JteAutoConfiguration.java (casid/jte `main`); issue #449, #278, discussion #273; jte.gg/pre-compiling, /maven-plugin.
Maven: maven-resources-plugin, maven-dependency-plugin (unpack), build-helper-maven-plugin, build-lifecycle (Apache + Sonatype); webjars.org.
Runtime JS: Spring Boot servlet/static-resources + WebJars docs; webjars-locator-lite (INNOQ 2024, README, Spring Boot commit c693b2b); htmx/Turbo webjar coords su mvnrepository; Vaadin WebJars; CSP+import-maps (lennybacon, stackhawk); ESM publish (2ality 2025, esmodules.com).
Prior art: Laravel packages/Flux UI/BlatUI; Phoenix Petal/Surface; Thymeleaf POC; JSF composite; Vaadin Flow; Wicket; shadcn registry vs Radix/MUI.
