/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installCurrent, isCurrentPath } from "../runtime/features/current.js";

describe("isCurrentPath (#81)", () => {
  it("exact mode requires full path equality", () => {
    expect(isCurrentPath("/posts", "/posts", true)).toBe(true);
    expect(isCurrentPath("/posts", "/posts/3", true)).toBe(false);
  });

  it("section mode marks a parent active on a child path", () => {
    expect(isCurrentPath("/posts", "/posts/3", false)).toBe(true);
    expect(isCurrentPath("/posts", "/posts", false)).toBe(true);
  });

  it("does not match an unrelated path with a shared prefix", () => {
    expect(isCurrentPath("/posts", "/posts-archive", false)).toBe(false);
  });

  it("ignores a trailing slash difference", () => {
    expect(isCurrentPath("/about/", "/about", true)).toBe(true);
  });

  it("strict mode treats a trailing-slash difference as a non-match", () => {
    // .strict (#81): /about/ and /about are NOT the same path when strict trailing-slash is on.
    expect(isCurrentPath("/about/", "/about", true, true)).toBe(false);
    expect(isCurrentPath("/about", "/about", true, true)).toBe(true);
  });

  it("strict section match still requires an exact trailing slash on the boundary", () => {
    // Section + strict: /posts marks /posts/3 active, but /posts/ vs /posts no longer collapses.
    expect(isCurrentPath("/posts", "/posts/3", false, true)).toBe(true);
    expect(isCurrentPath("/posts/", "/posts", false, true)).toBe(false);
  });
});

/** A minimal fake window with a settable pathname + an event target for navigation events. */
function fakeWin(pathname: string): Window {
  const target = new EventTarget();
  return {
    location: { pathname, href: `https://app.test${pathname}`, origin: "https://app.test" },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  } as unknown as Window;
}

describe("l:current directive (#81)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("marks a matching link active with the default class + aria-current", () => {
    document.body.innerHTML =
      '<div data-lievit-component="Nav" data-lievit-id="n" data-lievit-snapshot="s">' +
      '<a href="https://app.test/posts" l:current>Posts</a>' +
      '<a href="https://app.test/users" l:current>Users</a></div>';
    const rt = new LievitRuntime();
    installCurrent(rt, fakeWin("/posts/3"));
    rt.start();

    const [posts, users] = Array.from(document.querySelectorAll("a"));
    expect(posts.classList.contains("active")).toBe(true);
    expect(posts.getAttribute("aria-current")).toBe("page");
    expect(posts.getAttribute("data-current")).toBe("");
    expect(users.classList.contains("active")).toBe(false);
    expect(users.hasAttribute("aria-current")).toBe(false);
    expect(users.hasAttribute("data-current")).toBe(false);
  });

  it("stamps data-current as a parity flag and drops it when no longer current", () => {
    const win = fakeWin("/posts");
    document.body.innerHTML =
      '<div data-lievit-component="Nav" data-lievit-id="n" data-lievit-snapshot="s">' +
      '<a href="https://app.test/posts" l:current>Posts</a></div>';
    const rt = new LievitRuntime();
    installCurrent(rt, win);
    rt.start();

    const a = document.querySelector("a")!;
    expect(a.getAttribute("data-current")).toBe("");

    (win.location as { pathname: string }).pathname = "/users";
    win.dispatchEvent(new CustomEvent("lievit:navigated"));
    expect(a.hasAttribute("data-current")).toBe(false);
  });

  it("honors the .strict modifier on the directive", () => {
    document.body.innerHTML =
      '<div data-lievit-component="Nav" data-lievit-id="n" data-lievit-snapshot="s">' +
      '<a href="https://app.test/about/" l:current.exact.strict>About</a></div>';
    const rt = new LievitRuntime();
    installCurrent(rt, fakeWin("/about"));
    rt.start();

    const a = document.querySelector("a")!;
    // /about/ vs /about: a trailing-slash difference is NOT a match under .strict.
    expect(a.classList.contains("active")).toBe(false);
  });

  it("applies a custom class list from the directive value", () => {
    document.body.innerHTML =
      '<div data-lievit-component="Nav" data-lievit-id="n" data-lievit-snapshot="s">' +
      '<a href="https://app.test/posts" l:current="text-bold underline">Posts</a></div>';
    const rt = new LievitRuntime();
    installCurrent(rt, fakeWin("/posts"));
    rt.start();

    const a = document.querySelector("a")!;
    expect(a.classList.contains("text-bold")).toBe(true);
    expect(a.classList.contains("underline")).toBe(true);
  });

  it("re-evaluates on a lievit:navigated event", () => {
    const win = fakeWin("/posts");
    document.body.innerHTML =
      '<div data-lievit-component="Nav" data-lievit-id="n" data-lievit-snapshot="s">' +
      '<a href="https://app.test/users" l:current>Users</a></div>';
    const rt = new LievitRuntime();
    installCurrent(rt, win);
    rt.start();

    const a = document.querySelector("a")!;
    expect(a.classList.contains("active")).toBe(false);

    (win.location as { pathname: string }).pathname = "/users";
    win.dispatchEvent(new CustomEvent("lievit:navigated"));

    expect(a.classList.contains("active")).toBe(true);
  });
});
