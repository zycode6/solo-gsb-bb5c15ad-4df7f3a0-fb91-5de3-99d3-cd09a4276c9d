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
  fromId: string;
  toId: string;
  createdAt: string;
}

export interface GraphState {
  evidence: Evidence[];
  edges: Edge[];
  levels: Record<string, number>;
  levelCount: number;
}

/** 一条冗余连线及其最短替代路径（传递约简分析结果） */
export interface RedundantEdge {
  edgeId: number;
  fromId: string;
  toId: string;
  /** 忽略该连线后，从 fromId 到 toId 的一条最短替代路径（节点 id 序列，含起终点） */
  path: string[];
}

/** 批量瘦身结果：最新全量状态 + 实际移除 / 被跳过的连线 id */
export interface PruneResult extends GraphState {
  pruned: number[];
  skipped: number[];
}

export interface EvidenceFormValues {
  title: string;
  description: string;
  source: string;
  occurredAt: string | null;
}
