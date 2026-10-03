import {
  Box,
  CheckboxField,
  ChoiceField,
  CivicButton,
  CivicHeading,
  CivicText,
  TextField,
} from '../../components/civic';
import type { Schema, Value } from '../../forms/schema/model';
import { useT } from '../../i18n';
import { CriteriaEditor } from '../criteria';
import { CRITERIA_KEY, labelOf, type PlanNode } from './model';

type Props = {
  node: PlanNode;
  all: PlanNode[];
  schema?: Schema;
  messages: Record<string, unknown>;
  onChange: (patch: Partial<PlanNode>) => void;
  onRemove: () => void;
  onSaveCriteria: (items: Value[]) => unknown;
  busy?: boolean;
};

/* One stage, editable. depends_on is plain checkboxes of the other stages (keyboard operable).
 +------------------------------------+
 | Stage name [ Developing solutions ]|
 | Starts after                       |
 |   [x] Facts   [ ] Funding          |
 | How the choice is made  (o) ( ) .. |
 | [x] Starts on its own when ...     |
 | Acceptance criteria (CriteriaEditor)|
 | [Remove this stage]                |
 +------------------------------------+ */
export function StagePanel({
  node,
  all,
  schema,
  messages,
  onChange,
  onRemove,
  onSaveCriteria,
  busy,
}: Props) {
  const t = useT();
  const others = all.filter((n) => n.name !== node.name);
  const deps = node.depends_on ?? [];
  const flip = (name: string) =>
    onChange({
      depends_on: deps.includes(name) ? deps.filter((d) => d !== name) : [...deps, name],
    });
  const flag = (k: 'required' | 'needs_choice' | 'auto_start') => node[k] ?? true;
  return (
    <Box className="gap-3" testID={`plan-panel-${node.name}`}>
      <TextField
        label={t('plan.stage.name')}
        value={node.label ?? ''}
        onChangeText={(label) => onChange({ label })}
      />
      <TextField
        label={t('plan.stage.goal')}
        multiline
        value={node.goal}
        onChangeText={(goal) => onChange({ goal })}
      />
      <Box role="group" accessibilityLabel={t('plan.stage.dependsOn')} className="gap-1">
        <CivicText variant="bodyStrong">{t('plan.stage.dependsOn')}</CivicText>
        {others.length
          ? others.map((o) => (
              <CheckboxField
                key={o.name}
                label={labelOf(o)}
                checked={deps.includes(o.name)}
                onToggle={() => flip(o.name)}
              />
            ))
          : null}
        {deps.length === 0 ? <CivicText>{t('plan.stage.dependsNone')}</CivicText> : null}
      </Box>
      <ChoiceField
        label={t('plan.stage.method')}
        value={node.decision_method ?? 'poster_after_input'}
        onChange={(decision_method) => onChange({ decision_method })}
        options={[
          { value: 'poster_after_input', label: t('plan.method.poster') },
          { value: 'community_vote', label: t('plan.method.community') },
          { value: 'steward', label: t('plan.method.steward') },
          { value: 'other_named', label: t('plan.method.other') },
        ]}
      />
      <CheckboxField
        label={t('plan.stage.required')}
        checked={flag('required')}
        onToggle={() => onChange({ required: !flag('required') })}
      />
      <CheckboxField
        label={t('plan.stage.needsChoice')}
        checked={flag('needs_choice')}
        onToggle={() => onChange({ needs_choice: !flag('needs_choice') })}
      />
      <CheckboxField
        label={t('plan.stage.autoStart')}
        checked={flag('auto_start')}
        onToggle={() => onChange({ auto_start: !flag('auto_start') })}
      />
      <CivicHeading level={3}>{t('plan.stage.criteria')}</CivicHeading>
      {schema ? (
        <CriteriaEditor
          key={node.name}
          owner={node.name}
          fieldKey={CRITERIA_KEY}
          schema={schema}
          messages={messages}
          items={node.acceptance_criteria as Value[]}
          busy={busy}
          onSave={onSaveCriteria}
        />
      ) : null}
      <CivicButton
        variant="secondary"
        label={t('plan.stage.remove')}
        accessibilityLabel={`${t('plan.stage.remove')}: ${labelOf(node)}`}
        onPress={onRemove}
      />
    </Box>
  );
}
