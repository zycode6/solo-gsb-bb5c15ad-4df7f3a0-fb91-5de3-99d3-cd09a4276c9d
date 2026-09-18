import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cycleAfterAdding, findCycle, findPath, findRedundantEdges, topoLevels } from '../src/graph';

test('合法连线：不成环时返回 null', () => {
  const edges = [{ fromId: 'a', toId: 'b' }];
  assert.equal(cycleAfterAdding(edges, { fromId: 'b', toId: 'c' }), null);
});

test('成环连线：返回完整闭环节点序列', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
  ];
  // 新增 c → a 将构成 a → b → c → a
  assert.deepEqual(cycleAfterAdding(edges, { fromId: 'c', toId: 'a' }), ['c', 'a', 'b', 'c']);
});

test('自环立即被拒绝', () => {
  assert.deepEqual(cycleAfterAdding([], { fromId: 'a', toId: 'a' }), ['a', 'a']);
});

test('findPath：沿边方向找到路径', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
    { fromId: 'a', toId: 'c' },
  ];
  assert.deepEqual(findPath(edges, 'a', 'c'), ['a', 'c']);
  assert.equal(findPath(edges, 'c', 'a'), null);
});

test('topoLevels：按最长路径分层', () => {
  const levels = topoLevels(
    ['a', 'b', 'c', 'd'],
    [
      { fromId: 'a', toId: 'b' },
      { fromId: 'b', toId: 'c' },
      { fromId: 'a', toId: 'c' },
      { fromId: 'c', toId: 'd' },
    ],
  );
  assert.deepEqual(levels, { a: 0, b: 1, c: 2, d: 3 });
});

test('topoLevels：有环时返回 null', () => {
  const levels = topoLevels(
    ['a', 'b'],
    [
      { fromId: 'a', toId: 'b' },
      { fromId: 'b', toId: 'a' },
    ],
  );
  assert.equal(levels, null);
});

test('findCycle：在已有图中定位闭环', () => {
  const cycle = findCycle(
    ['a', 'b', 'c', 'd'],
    [
      { fromId: 'a', toId: 'b' },
      { fromId: 'b', toId: 'c' },
      { fromId: 'c', toId: 'a' },
      { fromId: 'c', toId: 'd' },
    ],
  );
  assert.ok(cycle);
  assert.equal(cycle![0], cycle![cycle!.length - 1]);
  assert.equal(cycle!.length, 4);
});

test('findCycle：无环返回 null', () => {
  const cycle = findCycle(
    ['a', 'b'],
    [{ fromId: 'a', toId: 'b' }],
  );
  assert.equal(cycle, null);
});

/* ---------- 约束瘦身（传递约简） ---------- */

test('findRedundantEdges：识别冗余边并给出最短替代路径', () => {
  // 菱形图：a → b → d，a → c → d，以及直接边 a → d（冗余）
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'd' },
    { fromId: 'a', toId: 'c' },
    { fromId: 'c', toId: 'd' },
    { fromId: 'a', toId: 'd' },
  ];
  const redundant = findRedundantEdges(edges);
  assert.equal(redundant.length, 1);
  assert.deepEqual(redundant[0].edge, { fromId: 'a', toId: 'd' });
  assert.equal(redundant[0].alternativePath[0], 'a');
  assert.equal(redundant[0].alternativePath.at(-1), 'd');
  assert.equal(redundant[0].alternativePath.length, 3);
});

test('findRedundantEdges：链式图无冗余边', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
    { fromId: 'c', toId: 'd' },
  ];
  assert.deepEqual(findRedundantEdges(edges), []);
});

test('findRedundantEdges：返回边数最少的替代路径', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
    { fromId: 'c', toId: 'd' },
    { fromId: 'a', toId: 'x' },
    { fromId: 'x', toId: 'd' },
    { fromId: 'a', toId: 'd' },
  ];
  const [r] = findRedundantEdges(edges);
  assert.deepEqual(r.alternativePath, ['a', 'x', 'd']);
});

test('findRedundantEdges：多条冗余边一并识别（含分层链）', () => {
  // 完全传递图 K3：a→b、b→c、a→c
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
    { fromId: 'a', toId: 'c' },
  ];
  const keys = findRedundantEdges(edges).map((r) => `${r.edge.fromId}->${r.edge.toId}`);
  assert.deepEqual(keys, ['a->c']);

  // 再加一条 c→d、a→d、b→d，则 a→d、b→d 均冗余
  const edges2 = [...edges, { fromId: 'c', toId: 'd' }, { fromId: 'a', toId: 'd' }, { fromId: 'b', toId: 'd' }];
  const keys2 = findRedundantEdges(edges2).map((r) => `${r.edge.fromId}->${r.edge.toId}`).sort();
  assert.deepEqual(keys2, ['a->c', 'a->d', 'b->d']);
});

test('传递约简：批量删除全部冗余边后所有可达关系与拓扑层级不变', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
    { fromId: 'c', toId: 'd' },
    { fromId: 'a', toId: 'c' },
    { fromId: 'b', toId: 'd' },
    { fromId: 'a', toId: 'd' },
    { fromId: 'x', toId: 'a' },
  ];
  const ids = ['x', 'a', 'b', 'c', 'd'];

  const key = (p: string[]) => p.join('->');
  const reachable = (es: typeof edges) => {
    const pairs = new Set<string>();
    for (const s of ids) {
      for (const g of ids) if (s !== g && findPath(es, s, g)) pairs.add(key([s, g]));
    }
    return pairs;
  };

  const before = reachable(edges);
  const reduced = edges.filter((e) => !findRedundantEdges(edges).some((r) => r.edge === e));
  // 约简结果是传递约简：再次扫描已无冗余
  assert.deepEqual(findRedundantEdges(reduced), []);
  // 可达关系逐一保持
  assert.deepEqual(reachable(reduced), before);
  // 最长路径分层完全一致
  assert.deepEqual(topoLevels(ids, reduced), topoLevels(ids, edges));
});
