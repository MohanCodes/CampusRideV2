import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons";
import { campusShortName } from "@/lib/campuses";
import type { Person } from "@/lib/data/types";
import { FEATURES } from "@/lib/features";

// Photo, first name, college, and the verified badge: how you tell who you're meeting.
// Only ever a first name. Last names and emails are never shown to other students.
// `linked` makes the name open the person's profile. Leave it off inside cards that are already one big link.
export function UserRow({ person, size = 36, trailing, linked = false }: { person: Person; size?: number; trailing?: ReactNode; linked?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={person.firstName} url={person.avatarUrl} size={size} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold leading-tight">
          {linked && FEATURES.userProfile ? <Link href={`/user/${person.id}`} className="hover:underline">{person.firstName}</Link> : person.firstName}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>{campusShortName(person.campusId)}</span>
          <span className="inline-flex items-center gap-1 font-bold text-green">
            <Icon name="check" size={12} />
            Verified
          </span>
        </p>
      </div>
      {trailing}
    </div>
  );
}
