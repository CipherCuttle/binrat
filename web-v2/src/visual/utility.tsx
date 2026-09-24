/** Generic verbs use Tabler only. Domain nouns use our original BINRAT glyphs. */
import {
  IconSearch, IconFilter, IconCopy, IconExternalLink, IconX, IconArrowLeft,
  IconChevronRight, IconMenu2, IconRefresh, IconShare3, IconInfoCircle,
  IconAlertTriangle,
} from "@tabler/icons-react";
import type { ComponentType, SVGProps } from "react";
export const utilities = {
  search: IconSearch,
  filter: IconFilter,
  copy: IconCopy,
  external: IconExternalLink,
  close: IconX,
  back: IconArrowLeft,
  next: IconChevronRight,
  menu: IconMenu2,
  refresh: IconRefresh,
  share: IconShare3,
  info: IconInfoCircle,
  warning: IconAlertTriangle,
} as const;
export type UtilityIconName = keyof typeof utilities;
export function UtilityIcon({ name, size = 22, title, ...props }: {
  name: UtilityIconName; size?: number; title?: string;
} & Omit<SVGProps<SVGSVGElement>, "name" | "width" | "height">) {
  const Component: ComponentType<any> = utilities[name];
  return <Component size={size} stroke={1.85} title={title}
    aria-hidden={title ? undefined : true} focusable="false" {...props} />;
}
