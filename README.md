# react-activity-keepalive-kit

> 基于 React 19.2 `<Activity>` 的组件级 KeepAlive —— 为 React 带来 Vue `<keep-alive>` 风格的页面/组件缓存能力。

只有 **一个文件 ≈ 130 行**,无第三方依赖,零魔法,完全契合 React 19 的 Activity 生命周期语义。

---

## 特性

- ✅ **真正的状态保留**:切换路由/标签页后,表单输入、滚动位置、请求结果均保留。
- ✅ **Activity 原生生命周期**:隐藏时 Effect 自动 cleanup,显示时重新建立——资源占用低,无游离 DOM 副作用。
- ✅ **LRU / PRE 淘汰策略**:支持上限 `max`,自动淘汰最久未使用或最早进入缓存的节点。
- ✅ **命令式 Ref API**:`removeCache` / `cleanAllCache` / `cleanOtherCache` / `getCaches`,满足 Tabbar 关闭、退出登录等场景。
- ✅ **零依赖**:仅依赖 `react >= 19.2`,无 `react-activation` / `react-router-cache-route` 之类重型库。
- ✅ **TypeScript**:全量类型导出,`strict` 模式可用。

---

## 为什么需要它

React 本身没有开箱即用的 keep-alive,常见方案各有代价:

| 方案                       | 问题                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `display: none` 手动隐藏   | 需自行维护多份 DOM,兄弟组件布局污染,Effect 不暂停                |
| `createPortal` + 游离 DOM  | IntersectionObserver/ResizeObserver 失效,定时器/订阅无法 cleanup |
| `react-activation`         | 依赖 Fiber 内部 API,React 升级易坏                               |
| `react-router-cache-route` | 与 router 强耦合,v6+ 支持差                                      |

`<Activity>` 是 React 19.2 官方钦定的答案,本组件只在其之上加了 **LRU 管理** 与 **Ref API**。

---

## 安装

```bash
npm install react-activity-keepalive-kit
# 或
yarn add react-activity-keepalive-kit
# 或
pnpm add react-activity-keepalive-kit
```

### 要求

- **React >= 19.2.0**(Activity 正式导出的最低版本)
- **TypeScript >= 4.9**(可选)

---

## 快速开始

### 最简用法

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

切换 tab 时,`HomePage` / `ProfilePage` 的内部 state 会自动保留;第二次切回时不会重新请求、不会丢失表单。

### 配合 React Router v6

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

### 命令式控制:关闭某个缓存

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

| 属性         | 类型                              | 默认值  | 说明                                                                 |
| ------------ | --------------------------------- | ------- | -------------------------------------------------------------------- |
| `children`   | `ReactNode`                       | —       | 当前要缓存/显示的内容。通常是 router outlet 或条件渲染后的业务组件。 |
| `activeName` | `string`                          | —       | 当前激活页签的唯一标识(通常是 `location.pathname`)。必填。           |
| `max`        | `number`                          | `10`    | 最多缓存多少个页签,超出按 `strategy` 淘汰。                          |
| `strategy`   | `'LRU' \| 'PRE'`                  | `'LRU'` | 淘汰策略。`LRU` = 最近最少使用;`PRE` = 先进先出。                    |
| `aliveRef`   | `RefObject<KeepAliveRef \| null>` | —       | 用于命令式控制缓存,见下方 `KeepAliveRef`。                           |

### `KeepAliveRef` 方法

```ts
type KeepAliveRef = {
  /** 获取所有缓存节点(name、ele、lastActiveTime) */
  getCaches: () => CacheNode[]

  /** 删除指定 name 的缓存,组件会真正卸载 */
  removeCache: (name: string) => Promise<void>

  /** 等同于 removeCache,保留是为了语义清晰(或与旧版 API 兼容) */
  destroy: (name: string) => Promise<void>

  /** 清空全部缓存(登出场景常用) */
  cleanAllCache: () => void

  /** 只保留当前 activeName,其它全部卸载 */
  cleanOtherCache: () => void
}
```

### `useKeepaliveRef()`

快捷创建 `KeepAliveRef` 的 hook,等价于 `useRef<KeepAliveRef | null>(null)`,但类型更精确。

```tsx
const aliveRef = useKeepaliveRef()
```

---

## 生命周期行为

KeepAlive 直接映射 React `<Activity>` 的官方语义:

| 状态          | DOM             | React state | Effects                     |
| ------------- | --------------- | ----------- | --------------------------- |
| 初次 mount    | 正常渲染        | 新建        | `useEffect` 正常执行        |
| 切走(hidden)  | `display: none` | **保留**    | **cleanup 被触发(unmount)** |
| 切回(visible) | 恢复显示        | **恢复**    | Effect **重新建立**         |
| `removeCache` | 真正移除        | 销毁        | cleanup 被触发              |

### 与 Vue `<keep-alive>` 对比

| 维度               | Vue `<keep-alive>` | React `<Activity>` + 本组件 |
| ------------------ | ------------------ | --------------------------- |
| state 保留         | ✅                 | ✅                          |
| 隐藏时 Effect 行为 | `deactivated` 暂停 | **自动 cleanup**            |
| 显示时 Effect 行为 | `activated` 恢复   | **重新执行**                |
| 缓存上限           | `max` prop         | `max` prop                  |
| 淘汰策略           | LRU                | LRU / PRE 可选              |

> 💡 **注意**:如果你的页面隐藏时**需要继续后台轮询**(例如 WebSocket 心跳),请将这部分逻辑迁移到全局 store 或独立的持续运行层,不要放在被缓存的组件内部——Activity 会在隐藏时 cleanup。这是与 `display: none` 方案最关键的行为差异。

---

## 与直接使用 `<Activity>` 的区别

React 原生 `<Activity>` 只解决单个组件的缓存语义,**不解决**:

1. **动态新增缓存节点**:路由切换时需要动态往缓存列表里加新页面,本组件自动完成。
2. **LRU 淘汰**:达到 `max` 后需要丢弃最少使用的节点,本组件内置。
3. **外部命令式控制**:关闭某个 tab、退出登录时清空——通过 `aliveRef` 完成。

也就是说:`<KeepAlive>` = `<Activity>` 的多实例管理器。

---

## FAQ

### Q: 升级到 React 19.2 之前的项目能用吗?

不能。Activity 在 React 19.2.0 才作为稳定 API 导出。19.0 / 19.1 的 `unstable_Activity` 行为不一致,不受本组件支持。

### Q: 为什么切回页面后 `useEffect` 又执行了一遍?

这是 Activity 的设计。如果你希望**只在首次进入时**执行某些副作用(例如请求初始化数据),建议:

- 把数据放进 SWR/React Query,利用它们的缓存语义;
- 或者用 `useRef` 手动做一个 mount guard。

### Q: 隐藏的页面里的动画/视频会停止吗?

视频:`<video>` 元素在 `display: none` 时行为因浏览器而异,通常不会自动暂停。如需节能,请在组件的 Effect cleanup 里显式 `video.pause()`——Activity 会自动帮你触发 cleanup。

CSS 动画:保留但不可见,不消耗额外 GPU 资源。

### Q: SSR 支持吗?

理论支持(Activity 本身 SSR 可用),但典型 keep-alive 场景(标签页管理)是纯客户端需求,未针对 SSR 专门测试。欢迎 PR。

### Q: 和 `react-activation` 有什么区别?

- `react-activation` 通过 patch Fiber 实现,维护成本高,React 升级风险大;
- 本组件基于官方 Activity,随 React 自身稳定性而稳定。

---

## License

MIT
