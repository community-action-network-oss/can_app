import { useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CivicText } from '../components/civic';
import { useT } from '../i18n';
import { layoutDag, neighbor, type NavKey } from './layoutDag';
import { openStage, type StageMapData } from './StageList';

const W = 168;
const H = 84;
const GX = 48;
const GY = 24;

type Focusable = { focus?: () => void } | null;

export function StageMap({ map }: { map: StageMapData }) {
  const t = useT();
  const refs = useRef<Record<string, Focusable>>({});
  const lay = layoutDag(map.stages, map.edges);
  const at = (id: string) => ({ x: lay.pos[id].layer * (W + GX), y: lay.pos[id].row * (H + GY) });
  const width = Math.max(1, lay.layers) * (W + GX) - GX;
  const height = Math.max(1, lay.rows + 1) * (H + GY) - GY;
  const edges = map.edges.filter((e) => lay.pos[e.from] && lay.pos[e.to]);
  return (
    <ScrollView horizontal accessibilityLabel={t('stagemap.title')}>
      <View style={{ width, height }}>
        <Svg
          width={width}
          height={height}
          style={{ position: 'absolute' }}
          accessibilityElementsHidden
        >
          {edges.map((e) => {
            const a = at(e.from);
            const b = at(e.to);
            const [x1, y1, x2, y2] = [a.x + W, a.y + H / 2, b.x, b.y + H / 2];
            const mx = (x1 + x2) / 2;
            return (
              <Path
                key={`${e.from}-${e.to}`}
                d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2} M${x2 - 8} ${y2 - 5} L${x2} ${y2} L${x2 - 8} ${y2 + 5}`}
                stroke="#555"
                strokeWidth={2}
                fill="none"
              />
            );
          })}
        </Svg>
        {map.stages.map((s) => {
          const p = at(s.id);
          const openable = s.state === 'ready' || s.state === 'active' || s.state === 'resolving';
          return (
            <View
              key={s.id}
              style={{ position: 'absolute', start: p.x, top: p.y, width: W, height: H }}
            >
              <Pressable
                ref={(r) => {
                  refs.current[s.id] = r as Focusable;
                }}
                role="button"
                accessibilityLabel={`${s.label}, ${s.chip}${s.current ? `, ${t('stagemap.current')}` : ''}`}
                onPress={() => (openable ? openStage(map.problemId, s.id) : undefined)}
                // arrow keys move between nodes (web); Tab follows API (topological) order
                {...({
                  onKeyDown: (ev: {
                    nativeEvent?: { key?: string };
                    preventDefault?: () => void;
                  }) => {
                    const key = ev.nativeEvent?.key as NavKey;
                    const next = neighbor(lay, s.id, key);
                    if (next) {
                      ev.preventDefault?.();
                      refs.current[next]?.focus?.();
                    }
                  },
                } as object)}
                className={`flex-1 p-2 rounded-md bg-can-surface border-can-border ${s.current ? 'border-4' : 'border'}`}
              >
                <CivicText variant="bodyStrong">{s.label}</CivicText>
                <CivicText variant="label">{`(${s.chip})`}</CivicText>
                {s.current ? (
                  <CivicText variant="caption">{`* ${t('stagemap.current')}`}</CivicText>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
