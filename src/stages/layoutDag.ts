export type DagNode = { id: string; dependsOn?: string[] };
export type DagEdge = { from: string; to: string };
export type Layout = {
  pos: Record<string, { layer: number; row: number }>;
  layers: number;
  rows: number;
};

// Layered by longest path from the start nodes; nodes in a layer keep list order.
export function layoutDag(nodes: DagNode[], edges: DagEdge[]): Layout {
  const ids = new Set(nodes.map((n) => n.id));
  const deps = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set()]));
  for (const n of nodes) for (const d of n.dependsOn ?? []) if (ids.has(d)) deps.get(n.id)!.add(d);
  for (const e of edges) if (ids.has(e.from) && ids.has(e.to)) deps.get(e.to)!.add(e.from);
  const layerOf = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    const known = layerOf.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // a cycle never reaches here from a valid plan; do not loop
    visiting.add(id);
    const v = Math.max(-1, ...[...deps.get(id)!].map(depth)) + 1;
    visiting.delete(id);
    layerOf.set(id, v);
    return v;
  };
  const counts: number[] = [];
  const pos: Layout['pos'] = {};
  for (const n of nodes) {
    const layer = depth(n.id);
    pos[n.id] = { layer, row: (counts[layer] = (counts[layer] ?? -1) + 1) };
  }
  return { pos, layers: counts.length, rows: Math.max(0, ...counts) };
}

export type NavKey = 'ArrowRight' | 'ArrowLeft' | 'ArrowDown' | 'ArrowUp';

/** The node an arrow key moves to, or null. Right/left change layer (nearest row), up/down change row. */
export function neighbor(layout: Layout, id: string, key: NavKey): string | null {
  const here = layout.pos[id];
  if (!here) return null;
  const others = Object.entries(layout.pos).filter(([k]) => k !== id);
  const pick = (c: [string, { layer: number; row: number }][]) => c[0]?.[0] ?? null;
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    const d = key === 'ArrowDown' ? 1 : -1;
    return pick(others.filter(([, p]) => p.layer === here.layer && p.row === here.row + d));
  }
  const d = key === 'ArrowRight' ? 1 : -1;
  return pick(
    others
      .filter(([, p]) => p.layer === here.layer + d)
      .sort((a, b) => Math.abs(a[1].row - here.row) - Math.abs(b[1].row - here.row)),
  );
}
