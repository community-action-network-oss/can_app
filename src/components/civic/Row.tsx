import type { ReactNode } from 'react';

import { Box } from '../ui/box';

/** Wrapping horizontal group, used for chips and button pairs. */
export function Row({ children }: { children: ReactNode }) {
  return <Box className="flex-row flex-wrap gap-2">{children}</Box>;
}
