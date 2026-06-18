/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.broadcast;

/**
 * The server→client live-push port (issue #304 / #45): pushes a {@link BroadcastEvent} to a
 * recipient's connected clients out-of-band of any wire call. It is the opt-in real-time channel the
 * wire protocol reserved (wire-protocol.md §6, ADR-0001's deferred WebSocket/SSE transport); the
 * default {@link SseBroadcastChannel} implements it over Server-Sent Events.
 *
 * <p>Delivery is <strong>per recipient</strong>: a push reaches only the named user's open
 * connections, never another user's, which is the per-user channel of #304's acceptance and the
 * privacy boundary. A recipient with no open connection silently receives nothing (best-effort live
 * push; the durable copy is the persisted {@code DatabaseNotification} the bell shows on its next
 * load). Implementations are thread-safe: {@link #push} is called from any thread, off the request.
 */
public interface BroadcastChannel {

    /**
     * Pushes an event to every one of {@code recipient}'s connected clients. A best-effort live
     * delivery: a recipient with no open connection is a no-op (the event is not queued). A dead
     * connection is pruned, never propagated as an error to the caller.
     *
     * @param recipient the recipient user id (the channel only ever delivers to this user)
     * @param event the event to push
     */
    void push(String recipient, BroadcastEvent event);

    /**
     * @param recipient the recipient user id
     * @return the number of that recipient's currently-open connections (0 when none; diagnostics)
     */
    int connectionCount(String recipient);
}
