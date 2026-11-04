import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons";
import { campusShortName } from "@/lib/campuses";
import type { Person } from "@/lib/data/types";
import { FEATURES } from "@/lib/features";

// Photo, first name, college, and the verified check beside the name: how you tell who you're meeting.
// Only ever a first name. Last names and emails are never shown to other students.
// `linked` makes the name open the person's profile. Leave it off inside cards that are already one big link.
export function UserRow({ person, size = 36, trailing, linked = false }: { person: Person; size?: number; trailing?: ReactNode; linked?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={person.firstName} url={person.avatarUrl} size={size} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 font-bold leading-tight">
          <span className="truncate">
            {linked && FEATURES.userProfile ? <Link href={`/user/${person.id}`} className="hover:underline">{person.firstName}</Link> : person.firstName}
          </span>
          <span role="img" aria-label="Verified" className="inline-flex shrink-0 text-green">
            <Icon name="check" size={14} />
          </span>
        </p>
        <p className="text-xs text-muted">{campusShortName(person.campusId)}</p>
      </div>
      {trailing}
    </div>
  );
}
