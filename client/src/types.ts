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

/** 一条冗余直接边及其最短替代路径（约束瘦身） */
export interface Redundancy {
  edgeId: number;
  fromId: string;
  toId: string;
  alternativePath: string[];
}

export interface SlimReport {
  redundant: Redundancy[];
  count: number;
}

export interface SlimResult extends GraphState {
  removed: number;
}

export interface EvidenceFormValues {
  title: string;
  description: string;
  source: string;
  occurredAt: string | null;
}
