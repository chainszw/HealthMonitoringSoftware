import type { MissionProfileId } from '../../lib/types';
import { AuroraBackdrop } from './AuroraBackdrop';
import { GridBackdrop } from './GridBackdrop';
import { SpaceBackdrop } from './SpaceBackdrop';
import type { BackdropVariant } from './variants';

/** The animated background behind the app shell. Keyed so switching remounts cleanly. */
export function Backdrop({
  variant,
  mission,
}: {
  variant: BackdropVariant;
  mission: MissionProfileId;
}) {
  if (variant === 'grid') return <GridBackdrop key="grid" />;
  if (variant === 'aurora') return <AuroraBackdrop key="aurora" mission={mission} />;
  return <SpaceBackdrop key="sky" mission={mission} />;
}
