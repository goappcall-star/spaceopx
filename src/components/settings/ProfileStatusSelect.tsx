import { STATUS_EMOJI, STATUS_LABEL } from "@/components/app/StatusDot";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isUserStatus, PROFILE_STATUSES } from "@/lib/profile-status";
import type { UserStatus } from "@/types";

export function ProfileStatusSelect({
  value,
  onChange,
}: {
  value: UserStatus;
  onChange: (value: UserStatus) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        // Radix's hidden form select can emit "" while async profile data loads.
        // This is not a user status selection and must not clear the saved status.
        if (isUserStatus(next)) onChange(next);
      }}
    >
      <SelectTrigger id="status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROFILE_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {STATUS_EMOJI[status]} {STATUS_LABEL[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
