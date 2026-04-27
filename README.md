# react-activity-keepalive-kit

English | [简体中文](./README.zh-CN.md)

> Component-level KeepAlive built on React 19.2 `<Activity>` — bringing Vue `<keep-alive>`-style page/component caching to React.

A **single file ≈ 130 lines**, zero third-party dependencies, no magic — fully aligned with React 19's native Activity lifecycle semantics.

---

## Features

- ✅ **Real state preservation**: form inputs, scroll positions, and request results are kept intact after switching routes/tabs.
- ✅ **Native Activity lifecycle**: Effects are cleaned up automatically when hidden and re-established when shown — low resource footprint, no dangling DOM side effects.
- ✅ **LRU / PRE eviction strategies**: respects a `max` limit and automatically evicts the least recently used or earliest cached node.
- ✅ **Imperative Ref API**: `removeCache` / `cleanAllCache` / `cleanOtherCache` / `getCaches` — covers tab close, logout and other scenarios.
- ✅ **Zero dependencies**: only requires `react >= 19.2`, no heavy libraries like `react-activation` or `react-router-cache-route`.
- ✅ **TypeScript**: full type exports, works under `strict` mode.

---

## Why you need it

React does not ship an out-of-the-box keep-alive, and the common alternatives all have trade-offs:

| Approach                         | Problem                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| Manual `display: none`           | You must maintain multiple DOM trees, sibling layout is polluted, Effects don't pause |
| `createPortal` + detached DOM    | IntersectionObserver/ResizeObserver break, timers/subscriptions can't be cleaned up |
| `react-activation`               | Relies on internal Fiber APIs, easily breaks on React upgrades                      |
| `react-router-cache-route`       | Tightly coupled to the router, poor support on v6+                                  |

`<Activity>` is the officially blessed answer in React 19.2. This component only adds **LRU management** and a **Ref API** on top of it.

---

## Installation

```bash
npm install react-activity-keepalive-kit
# or
yarn add react-activity-keepalive-kit
# or
pnpm add react-activity-keepalive-kit
```

### Requirements

- **React >= 19.2.0** (the minimum version where Activity is officially exported)
- **TypeScript >= 4.9** (optional)

---

## Quick Start

### Minimal usage

```tsx
import KeepAlive from "react-activity-keepalive-kit"
import { useState } from "react"

function App() {
  const [tab, setTab] = useState<"home" | "profile">("home")

  return (
    <>
      <button onClick={() => setTab("home")}>Home</button>
      <button onClick={() => setTab("profile")}>Profile</button>

      <KeepAlive activeName={tab} max={5}>
        {tab === "home" ? <HomePage /> : <ProfilePage />}
      </KeepAlive>
    </>
  )
}
```

When switching tabs, the internal state of `HomePage` / `ProfilePage` is preserved automatically; switching back the second time does not re-request data or lose form input.

### With React Router v6

```tsx
import { useLocation, useOutlet } from "react-router-dom"
import KeepAlive from "react-activity-keepalive-kit"

function CachedLayout() {
  const outlet = useOutlet()
  const location = useLocation()

  return (
    <KeepAlive activeName={location.pathname} max={10} strategy="LRU">
      {outlet}
    </KeepAlive>
  )
}
```

### Imperative control: close a specific cache

```tsx
import KeepAlive, { useKeepaliveRef } from "react-activity-keepalive-kit"

function Tabs() {
  const aliveRef = useKeepaliveRef()

  const closeTab = async (name: string) => {
    await aliveRef.current?.removeCache(name)
  }

  const logout = () => {
    aliveRef.current?.cleanAllCache()
  }

  return (
    <KeepAlive aliveRef={aliveRef} activeName={activeName}>
      {children}
    </KeepAlive>
  )
}
```

---

## API

### `<KeepAlive>` Props

| Prop         | Type                              | Default | Description                                                                                   |
| ------------ | --------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `children`   | `ReactNode`                       | —       | The content to cache/display. Typically a router outlet or a conditionally-rendered component. |
| `activeName` | `string`                          | —       | Unique identifier for the currently active tab (usually `location.pathname`). Required.       |
| `max`        | `number`                          | `10`    | Maximum number of tabs to cache. Excess entries are evicted per `strategy`.                   |
| `strategy`   | `'LRU' \| 'PRE'`                  | `'LRU'` | Eviction strategy. `LRU` = least recently used; `PRE` = first-in first-out.                   |
| `aliveRef`   | `RefObject<KeepAliveRef \| null>` | —       | For imperative cache control. See `KeepAliveRef` below.                                       |

### `KeepAliveRef` methods

```ts
type KeepAliveRef = {
  /** Get all cached nodes (name, ele, lastActiveTime) */
  getCaches: () => CacheNode[]

  /** Remove the cache with the given name; the component is actually unmounted */
  removeCache: (name: string) => Promise<void>

  /** Alias of removeCache, kept for semantic clarity (or legacy API compatibility) */
  destroy: (name: string) => Promise<void>

  /** Clear all caches (common on logout) */
  cleanAllCache: () => void

  /** Keep only the current activeName; unmount everything else */
  cleanOtherCache: () => void
}
```

### `useKeepaliveRef()`

Shortcut hook for creating a `KeepAliveRef`. Equivalent to `useRef<KeepAliveRef | null>(null)` with a more precise type.

```tsx
const aliveRef = useKeepaliveRef()
```

---

## Lifecycle behavior

KeepAlive maps directly to React `<Activity>`'s official semantics:

| State              | DOM             | React state | Effects                              |
| ------------------ | --------------- | ----------- | ------------------------------------ |
| Initial mount      | Rendered        | Created     | `useEffect` runs normally            |
| Switch away (hidden)  | `display: none` | **Preserved** | **cleanup fires (unmount)**         |
| Switch back (visible) | Visible again   | **Restored**  | Effects **re-established**          |
| `removeCache`      | Actually removed | Destroyed  | cleanup fires                         |

### Comparison with Vue `<keep-alive>`

| Dimension                 | Vue `<keep-alive>`   | React `<Activity>` + this component |
| ------------------------- | -------------------- | ----------------------------------- |
| State preservation        | ✅                   | ✅                                  |
| Effect behavior on hide   | `deactivated` paused | **auto cleanup**                    |
| Effect behavior on show   | `activated` resumed  | **re-runs**                         |
| Cache limit               | `max` prop           | `max` prop                          |
| Eviction strategy         | LRU                  | LRU / PRE selectable                |

> 💡 **Note**: if your page **needs to keep polling in the background** while hidden (e.g. a WebSocket heartbeat), move that logic to a global store or an independently-running layer — do not put it inside a cached component, because Activity will clean it up on hide. This is the most important behavioral difference from a `display: none` approach.

---

## Differences from using `<Activity>` directly

React's native `<Activity>` only solves caching semantics for a single component. It **does not** handle:

1. **Dynamically adding cache nodes**: on route changes you need to dynamically append new pages to the cache list — this component does it for you.
2. **LRU eviction**: once `max` is reached you need to drop the least used node — built in here.
3. **External imperative control**: closing a specific tab or clearing on logout — done through `aliveRef`.

In other words: `<KeepAlive>` = a multi-instance manager for `<Activity>`.

---

## FAQ

### Q: Can projects on React versions earlier than 19.2 use this?

No. Activity was only exported as a stable API in React 19.2.0. The `unstable_Activity` in 19.0 / 19.1 has inconsistent behavior and is not supported by this component.

### Q: Why does `useEffect` run again after switching back to a page?

That is Activity's design. If you want certain side effects to run **only on first entry** (e.g. initial data fetching), consider:

- Putting the data in SWR / React Query and leveraging their cache semantics;
- Or using a `useRef`-based mount guard.

### Q: Do animations / videos keep running while the page is hidden?

Videos: `<video>` behavior under `display: none` varies by browser and usually does not auto-pause. To save power, explicitly call `video.pause()` in the component's Effect cleanup — Activity will trigger cleanup for you.

CSS animations: preserved but invisible, with no additional GPU cost.

### Q: Is SSR supported?

In theory yes (Activity itself is SSR-compatible), but typical keep-alive scenarios (tab management) are purely client-side, so SSR has not been specifically tested. PRs welcome.

### Q: How is this different from `react-activation`?

- `react-activation` works by patching Fiber internals — high maintenance cost, fragile across React upgrades;
- This component is built on official Activity, staying as stable as React itself.

---

## License

MIT
