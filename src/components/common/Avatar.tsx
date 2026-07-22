import type { TeamMember } from '../../types';
import { getMemberInitials } from '../../services/teamService';

interface AvatarProps {
  member?: TeamMember;
  initials?: string;
  color?: string;
  size?: 'sm' | 'default' | 'lg' | 'xl';
  src?: string;
}

export function Avatar({ member, initials, color, size = 'default', src }: AvatarProps) {
  const displayInitials = member ? getMemberInitials(member) : initials ?? '?';
  const bgColor = member?.color ?? color ?? '#5C666F';

  const sizeClass = size === 'sm' ? 'avatar-sm' :
                    size === 'lg' ? 'avatar-lg' :
                    size === 'xl' ? 'avatar-xl' : '';

  if (src || member?.avatar) {
    return (
      <div
        className={`avatar ${sizeClass}`}
        style={{ backgroundImage: `url(${src ?? member?.avatar})`, backgroundSize: 'cover' }}
      />
    );
  }

  return (
    <div
      className={`avatar ${sizeClass}`}
      style={{ backgroundColor: bgColor }}
    >
      {displayInitials}
    </div>
  );
}

interface AvatarGroupProps {
  members: TeamMember[];
  max?: number;
  size?: 'sm' | 'default' | 'lg';
}

export function AvatarGroup({ members, max = 4, size = 'default' }: AvatarGroupProps) {
  const visible = members.slice(0, max);
  const remaining = members.length - max;

  return (
    <div className="avatar-group">
      {visible.map(member => (
        <Avatar key={member.id} member={member} size={size} />
      ))}
      {remaining > 0 && (
        <Avatar initials={`+${remaining}`} color="#9CA3AF" size={size} />
      )}
    </div>
  );
}
