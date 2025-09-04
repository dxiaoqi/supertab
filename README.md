# Tab Cybertext

一个基于 Next.js + Vercel AI SDK 的“Tab 接受补全”原型，支持本地赛博启发式预测、用户偏好反馈学习与远端精排补全。

## 运行

1) 环境变量（可选使用接口体覆盖）

```bash
cp .env.local .env.local.example
# 编辑 .env.local：
# OPENAI_API_KEY=...
# OPENAI_BASE_URL=https://your-proxy.example.com/v1   # 可选
```

2) 启动开发服务器

```bash
npm run dev
# http://localhost:3000
```

## 产品设计（已实现）

- 固定尺寸、无边框、可滚动的输入区域，提供“幽灵”补全（灰色文字）。
- 仅当来自 AI 接口的补全出现时，显示右侧灰色 TAB 小标签并左右轻微摆动，提示“按 Tab 接受”。
- 按下 Tab 后将建议合入输入框，并隐藏 TAB 标签。
- 支持本地即时补全与请求频控：防抖 + 节流 + Abort 取消 + 内存缓存。

## 技术方案

### 前端（App Router）

- 页面：`app/page.tsx`
  - 输入框使用 `textarea` 固定宽高（宽 680、高 180），覆盖层显示“幽灵”补全。
  - TAB 小标签动画样式：`app/globals.css` 中的 `.tab-chip` 与 `@keyframes wiggle`。
  - 仅在服务端补全返回时显示 TAB 标签；本地/偏好补全不显示。
  - Tab 接受：将建议拼接到输入内容，并记录一次“接受”反馈。

- 赛博启发式补全：`lib/cybertext.ts`
  - 括号/引号自动闭合、Markdown 代码围栏补全、列表连续编号等规则。
  - 返回 `suggestion` 与 `confidence`，用于置信度门控。

- 用户偏好反馈学习：`lib/user-prefs.ts`
  - 本地 localStorage 维护“前缀 → 建议 → 权重”的小型模型，带时间衰减（半衰期 21 天）与 LRU 上限。
  - Tab 接受时 `recordAccept(prefix, suggestion)` 强化；（可扩展）与幽灵不匹配的输入可做隐式 `recordReject`。
  - 通过 `getPreferenceSuggestion(prefix)` 与赛博补全融合，提升贴合度。

- 请求频控策略
  - 本地优先：高置信度（≥0.88）时不发请求。
  - 低置信度才回落服务端，并做防抖（200ms）+ 节流（300ms）+ Abort 取消 + 结果缓存。

### 后端（Edge Runtime）

- 对话流：`app/api/chat/route.ts`
  - 使用 `ai` 的 `streamText` 与 `@ai-sdk/openai` 的 `createOpenAI`。
  - 接受 `apiKey`、`baseUrl` 请求体覆盖，或走 `.env.local`。
  - 兼容 `useChat` 的格式：用 `convertToModelMessages` 将 UIMessage 转为 ModelMessage。

- 补全接口：`app/api/complete/route.ts`
  - 使用 `generateText` 生成短续写，面向“下一次输入预测”。
  - 对返回文本做清洗：去引号/代码块围栏，移除与当前输入的重叠。
  - 同样支持 `apiKey`、`baseUrl` 覆盖。

## 可扩展方向

- 更丰富的本地启发式（URL、代码片段、函数签名、中文标点等）。
- 小型本地模型（WASM/ONNX）增强语义预测，继续保持置信度门控以省请求。
- 多候选（beam/top-k）与方向键切换，减少抖动并提升接受率。
- 隐式拒绝的可靠触发规则与阈值，避免误伤。

## 技术栈

- Next.js 15（App Router）
- Vercel AI SDK：`ai`、`@ai-sdk/openai`、`@ai-sdk/react`
- TypeScript

#