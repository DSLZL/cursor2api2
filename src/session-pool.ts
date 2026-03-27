/**
 * session-pool.ts - 虚拟 Session 会话池
 *
 * 职责：
 * 1. 维护 ready 池（预生成好的 session，请求来时直接取用）
 * 2. 维护 warming 状态（后台持续补充，保证 ready 池有足够储备）
 * 3. 追踪并发活跃 session 数量，提供可观测性
 * 4. 为未来多账号 cookie 绑定预留扩展点
 *
 * 设计说明：
 * - Session = { conversationId, createdAt }，conversationId 由 UUID 生成（覆盖 deriveConversationId）
 * - 实际 conversationId 仍由 converter.ts 的 deriveConversationId 确定性生成（会话隔离语义）
 * - pool 里的 session 作为「已就绪槽位」概念，未来可绑定 cookie/账号
 * - 当前实现：pool 为纯 UUID 预生成，zero-cost 预热
 */

import { v4 as uuidv4 } from 'uuid';
import { getConfig } from './config.js';

export interface PooledSession {
    id: string;          // session 唯一标识（uuidv4）
    createdAt: number;   // 创建时间戳（ms）
    // 预留：未来可加 cookie?: string; accountId?: string;
}

// ==================== 池状态 ====================

let readyQueue: PooledSession[] = [];
let activeCount = 0;      // 当前正在使用中的 session 数
let warmingCount = 0;     // 正在后台生成中的数量（占位计数）
let initialized = false;

function getPoolSizes(): { readySize: number; warmingSize: number } {
    const cfg = getConfig().sessionPool;
    return {
        readySize: cfg?.readySize ?? 10,
        warmingSize: cfg?.warmingSize ?? 5,
    };
}

// ==================== 内部补充逻辑 ====================

function createSession(): PooledSession {
    return { id: uuidv4(), createdAt: Date.now() };
}

/**
 * 后台异步补充 ready 池，直到达到目标大小
 */
function replenish(): void {
    const { readySize, warmingSize } = getPoolSizes();
    const deficit = readySize - readyQueue.length;
    const canWarm = warmingSize - warmingCount;
    const toGenerate = Math.min(deficit, canWarm);

    if (toGenerate <= 0) return;

    warmingCount += toGenerate;

    // Session 生成是纯 CPU（UUID），用 setImmediate 避免阻塞当前请求
    setImmediate(() => {
        for (let i = 0; i < toGenerate; i++) {
            readyQueue.push(createSession());
        }
        warmingCount = Math.max(0, warmingCount - toGenerate);
    });
}

// ==================== 公开 API ====================

/**
 * 初始化 session 池（在服务启动时调用）
 */
export function initSessionPool(cfg?: { readySize?: number; warmingSize?: number }): void {
    void cfg; // config 已在 getConfig() 中解析，此参数仅作调用侧类型提示用
    if (initialized) return;
    initialized = true;
    const { readySize } = getPoolSizes();
    // 同步预填充，确保服务就绪时 ready 池已满
    for (let i = 0; i < readySize; i++) {
        readyQueue.push(createSession());
    }
    console.log(`[SessionPool] 初始化完成: ready=${readyQueue.length}, warming=${warmingCount}`);
}

/**
 * 从 ready 池获取一个 session
 * 如果池空则即时创建（降级，不阻塞请求）
 */
export function acquireSession(): PooledSession {
    let session: PooledSession;
    if (readyQueue.length > 0) {
        session = readyQueue.shift()!;
    } else {
        // 降级：池空时即时创建，不阻塞
        console.warn('[SessionPool] ready 池已空，即时创建 session（考虑增大 SESSION_POOL_READY）');
        session = createSession();
    }
    activeCount++;
    // 取走后异步补充
    replenish();
    return session;
}

/**
 * 归还 session（释放活跃计数）
 * 当前实现不复用 session（保持新鲜），直接丢弃
 */
export function releaseSession(_session: PooledSession): void {
    activeCount = Math.max(0, activeCount - 1);
    // 不放回队列：每次请求用全新 session，防止会话状态污染
    // 未来如需复用（如绑定 cookie），在此处将 session 放回 readyQueue
}

/**
 * 获取当前池状态（用于日志/监控）
 */
export function getPoolStats(): { ready: number; active: number; warming: number } {
    return {
        ready: readyQueue.length,
        active: activeCount,
        warming: warmingCount,
    };
}
