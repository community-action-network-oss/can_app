import type { components } from '../../api/schema';
import { layoutDag } from '../../stages/layoutDag';
import type { StageMapData } from '../../stages/StageList';
import type { useT } from '../../i18n';
import { resolve, type Schema } from '../../forms/schema/model';

/** A stage node as the content stores it (snake_case). Nothing here names a core problem field. */
export type PlanNode = {
  name: string;
  label?: string;
  goal: string;
  acceptance_criteria: Record<string, unknown>[];
  decision_method?: string;
  depends_on?: string[];
  required?: boolean;
  needs_choice?: boolean;
  auto_start?: boolean;
};
export type Template = components['schemas']['StageTemplateDto'];
export type PlanCheck = components['schemas']['PlanCheckDto'];

export const CRITERIA_KEY = 'acceptance_criteria';
export const labelOf = (n: PlanNode) => n.label ?? n.name;
export const namesOf = (nodes: PlanNode[], ids: string[]) =>
  ids.map((i) => nodes.find((n) => n.name === i)?.label ?? i).join(', ');

export const fromTemplate = (tpl: Template): PlanNode[] =>
  tpl.stages.map((s) => ({
    name: s.name,
    label: s.label,
    goal: s.goal,
    acceptance_criteria: s.criteria.map((c) => ({ statement: c.statement, measure: c.measure })),
    decision_method: s.decisionMethod,
    depends_on: s.dependsOn,
    required: s.required,
    needs_choice: s.needsChoice,
    auto_start: true, // D-84: on by default
  }));

export function newStage(nodes: PlanNode[], label: string): PlanNode {
  let n = nodes.length + 1;
  while (nodes.some((x) => x.name === `stage_${n}`)) n++;
  return {
    name: `stage_${n}`,
    label,
    goal: '',
    acceptance_criteria: [],
    decision_method: 'poster_after_input',
    depends_on: [],
    required: true,
    needs_choice: true,
    auto_start: true,
  };
}

export const removeStage = (nodes: PlanNode[], name: string): PlanNode[] =>
  nodes
    .filter((n) => n.name !== name)
    .map((n) => ({ ...n, depends_on: (n.depends_on ?? []).filter((d) => d !== name) }));

export function moveStage(nodes: PlanNode[], i: number, d: -1 | 1): PlanNode[] {
  const j = i + d;
  if (j < 0 || j >= nodes.length) return nodes;
  const out = [...nodes];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Stand-in for the public stage map so the shared StageMap can draw a plan that is not published yet. */
export function toMap(
  nodes: PlanNode[],
  problemId: string,
  chip: (n: number, total: number) => string,
): StageMapData {
  return {
    problemId,
    activeStages: 0,
    finalCriteria: [],
    label: null,
    planVersion: 0,
    problemState: 'draft',
    edges: nodes.flatMap((n) => (n.depends_on ?? []).map((from) => ({ from, to: n.name }))),
    stages: nodes.map((n, i) => ({
      id: n.name,
      name: n.name,
      label: labelOf(n),
      goal: n.goal,
      ordinal: i + 1,
      chip: chip(i + 1, nodes.length),
      state: 'planned',
      current: false,
      dependsOn: n.depends_on ?? [],
      decisionMethod: n.decision_method ?? 'poster_after_input',
      needsChoice: n.needs_choice ?? true,
      required: n.required ?? true,
      criteriaTotal: n.acceptance_criteria.length,
      criteriaWithEvidence: 0,
      allowedStageTransitions: [],
    })),
  } as StageMapData;
}

/** Groups of stages that sit in the same layer, so they can run at the same time. */
export function parallelGroups(nodes: PlanNode[]): string[][] {
  const lay = layoutDag(
    nodes.map((n) => ({ id: n.name, dependsOn: n.depends_on })),
    [],
  );
  const by: Record<number, string[]> = {};
  for (const n of nodes) (by[lay.pos[n.name].layer] ??= []).push(n.name);
  return Object.values(by).filter((g) => g.length > 1);
}

/** A form schema holding only the criteria list of one stage, cut from the stage node definition. */
export function criteriaSchema(root: Schema, planKey: string): Schema | undefined {
  const item = resolve(root, root.properties?.[planKey]?.items ?? {});
  const list = item.properties?.[CRITERIA_KEY];
  return list
    ? { ...root, type: 'object', required: [CRITERIA_KEY], properties: { [CRITERIA_KEY]: list } }
    : undefined;
}

type Issue = { code?: string; path?: string[]; stageId?: string };
/** Plain-language lines for what the server found, grouped so each message names every stage once. */
export function issueLines(
  check: PlanCheck,
  nodes: PlanNode[],
  t: ReturnType<typeof useT>,
): string[] {
  const issues = check.issues as Issue[];
  const ids = (codes: string[]) =>
    issues.filter((i) => codes.includes(i.code ?? '') && i.stageId).map((i) => i.stageId!);
  const lines: string[] = [];
  for (const i of issues)
    if (i.code === 'cycle')
      lines.push(t('plan.graph.cycle', { names: namesOf(nodes, i.path ?? []) }));
  const noEnd = ids(['unreachable_from_final', 'dead_end_required']);
  if (noEnd.length) lines.push(t('plan.graph.noEnd', { names: namesOf(nodes, noEnd) }));
  const noCrit = ids(['no_criteria']);
  if (noCrit.length) lines.push(t('plan.issue.noCriteria', { names: namesOf(nodes, noCrit) }));
  if (issues.some((i) => i.code === 'no_final_criteria')) lines.push(t('plan.issue.noFinal'));
  const known = ['cycle', 'unreachable_from_final', 'dead_end_required', 'no_criteria'];
  if (issues.some((i) => !known.includes(i.code ?? '') && i.code !== 'no_final_criteria'))
    lines.push(t('plan.issue.other'));
  return lines;
}
