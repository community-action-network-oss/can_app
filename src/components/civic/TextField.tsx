import { Input, InputField } from '../ui/input';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  accessibilityLabel: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
};

export function TextField({ multiline, ...rest }: Props) {
  return (
    <Input className="min-h-11 border-can-control-border">
      <InputField {...rest} multiline={multiline} autoCapitalize="none" autoCorrect={false} />
    </Input>
  );
}
