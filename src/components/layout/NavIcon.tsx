import {
  BookOpen,
  CakeSlice,
  CalendarDays,
  ChartNoAxesCombined,
  House,
  Link2,
  Megaphone,
  Search,
  Settings2,
  Sparkles,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/modules/navigation/nav";

const ICONS: Record<NavIconName, LucideIcon> = {
  house: House,
  megaphone: Megaphone,
  sparkles: Sparkles,
  "cake-slice": CakeSlice,
  "user-round": UserRound,
  "users-round": UsersRound,
  "calendar-days": CalendarDays,
  "book-open": BookOpen,
  "link-2": Link2,
  search: Search,
  chart: ChartNoAxesCombined,
  settings: Settings2,
};

export function NavIcon({ name, className = "h-[18px] w-[18px]" }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" />;
}
