const QUEUE_KEY = "flagbreaker_offline_queue";

export type OfflineAction = {
  id: string;            // 唯一 ID
  type: "checkin";
  goal_id: string;
  note?: string;
  created_at: string;    // ISO string
};

/** 获取当前离线队列 */
export function getQueue(): OfflineAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 保存队列 */
function saveQueue(queue: OfflineAction[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // storage full, drop oldest
    if (queue.length > 1) saveQueue(queue.slice(1));
  }
}

/** 将一次打卡加入离线队列 */
export function enqueueCheckin(goalId: string): OfflineAction {
  const action: OfflineAction = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "checkin",
    goal_id: goalId,
    created_at: new Date().toISOString(),
  };
  const queue = getQueue();
  // 避免重复排队（同一目标短期内不应重复）
  const exists = queue.some((a) => a.goal_id === goalId && a.type === "checkin");
  if (!exists) {
    queue.push(action);
    saveQueue(queue);
  }
  return action;
}

/** 从队列中移除一条 */
export function dequeue(id: string) {
  const queue = getQueue().filter((a) => a.id !== id);
  saveQueue(queue);
}

/** 队列长度 */
export function queueLength(): number {
  return getQueue().length;
}

/** 重播整个离线队列（在线时调用），返回成功条数 */
export async function replayQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  let successCount = 0;

  for (const action of queue) {
    if (action.type === "checkin") {
      try {
        const resp = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal_id: action.goal_id }),
        });
        if (resp.ok) {
          dequeue(action.id);
          successCount++;
        } else {
          // 409 (already checked in) 也算成功，移除
          if (resp.status === 409) {
            dequeue(action.id);
            successCount++;
          }
          // 其他错误保留在队列中，下次重试
        }
      } catch {
        // Network still down, stop trying
        break;
      }
    }
  }

  return successCount;
}
