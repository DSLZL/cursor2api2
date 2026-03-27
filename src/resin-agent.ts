/**
 * resin-agent.ts - Resin 粘性代理接入模块
 *
 * 接入方式：反向代理（Resin 推荐方式）
 *
 * URL 格式：
 *   <resin_url>/<Platform>/https/cursor.com/api/chat
 *   例：http://127.0.0.1:2260/my-token/Cursor2API/https/cursor.com/api/chat
 *
 * 业务身份（Account）通过请求头 X-Resin-Account 传递，
 * 使用 conversationId（确定性哈希）作为账号标识，保证同一逻辑会话始终路由到同一出口 IP。
 */

import type { AppConfig } from './types.js';

type ResinConfig = NonNullable<AppConfig['resin']>;

// ==================== 核心函数 ====================

/**
 * 将原始目标 URL 改写为 Resin 反向代理 URL
 *
 * 输入：https://cursor.com/api/chat
 * 输出：http://127.0.0.1:2260/my-token/Cursor2API/https/cursor.com/api/chat
 */
export function buildResinTargetUrl(originalUrl: string, platformName: string, resinBaseUrl: string): string {
    // 解析原始 URL
    const parsed = new URL(originalUrl);
    const protocol = parsed.protocol.replace(':', ''); // 'https'
    const host = parsed.host;                           // 'cursor.com'
    const pathname = parsed.pathname;                   // '/api/chat'
    const search = parsed.search;                       // '' 或 '?xxx'

    // 去掉 resinBaseUrl 末尾的斜杠
    const base = resinBaseUrl.replace(/\/$/, '');

    // 拼接：<base>/<Platform>/<protocol>/<host><pathname><search>
    return `${base}/${encodeURIComponent(platformName)}/${protocol}/${host}${pathname}${search}`;
}

/**
 * 返回使用 Resin 反向代理时的 fetch 额外选项
 * 反向代理模式下直接 fetch 到 Resin 服务器，无需额外 dispatcher。
 * （X-Resin-Account header 在 cursor-client.ts 注入）
 */
export function getResinFetchOptions(_cfg: ResinConfig): Record<string, unknown> {
    // 反向代理：直连 Resin 即可，不需要 ProxyAgent
    // 若未来需要通过上游代理访问 Resin，可在此处加 dispatcher
    return {};
}

/**
 * 日志友好的 Resin 状态描述
 */
export function describeResinConfig(cfg: ResinConfig): string {
    if (!cfg.enabled) return 'disabled';
    try {
        const parsed = new URL(cfg.url);
        return `enabled (${parsed.host}, platform=${cfg.platformName})`;
    } catch {
        return `enabled (url=${cfg.url}, platform=${cfg.platformName})`;
    }
}
