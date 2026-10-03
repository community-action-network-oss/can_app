import type { components } from '../../api/schema';
import type { Ctx } from './FieldNode';

type Stage = components['schemas']['StageDto'];

/** Pickers for the stage reference and criterion reference widgets, from one stage. The stage is preselected. */
export const stageChoices = (s: Stage | undefined): Ctx['choices'] =>
  s
    ? {
        stage_ref: { options: [{ value: s.name, label: s.label }], preset: s.name },
        criterion_ref: {
          options: s.criteria.map((c) => ({
            value: String(c.ref),
            label: `${c.ref}. ${c.statement}`,
          })),
        },
      }
    : {};
