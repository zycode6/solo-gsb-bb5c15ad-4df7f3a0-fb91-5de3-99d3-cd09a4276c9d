export interface Evidence {
  id: string;
  title: string;
  description: string;
  source: string;
  occurredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Edge {
  id: number;
  /** 前置证据：必须更早发生 */
  fromId: string;
  /** 后续证据：必须更晚发生 */
  toId: string;
  createdAt: string;
}

export interface GraphState {
  evidence: Evidence[];
  edges: Edge[];
  /** 每张卡片所在的拓扑层级（0 起），由「必须早于」约束推导 */
  levels: Record<string, number>;
  levelCount: number;
}

/** 一条冗余直接边及其最短替代路径（约束瘦身） */
export interface Redundancy {
  /** 冗余连线 id */
  edgeId: number;
  fromId: string;
  toId: string;
  /** 忽略该连线后 fromId → toId 的一条最短替代路径（含两端，长度 ≥ 2） */
  alternativePath: string[];
}

export interface SlimReport {
  redundant: Redundancy[];
  count: number;
}

/** POST /api/slim/apply 的响应：最新全量状态 + 本次实际移除条数 */
export interface SlimResult extends GraphState {
  removed: number;
}
