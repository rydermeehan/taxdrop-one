import type { ShotStatus, ProjectStatus, TeamRole } from '../../types';

type BadgeColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink' | 'orange' | 'teal';

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
}

export function Badge({ children, color = 'gray' }: BadgeProps) {
  return (
    <span className={`badge badge-${color}`}>
      {children}
    </span>
  );
}

export function ShotStatusBadge({ status }: { status: ShotStatus }) {
  const config: Record<ShotStatus, { color: BadgeColor; label: string }> = {
    planned: { color: 'gray', label: 'Planned' },
    'in-progress': { color: 'blue', label: 'In Progress' },
    review: { color: 'yellow', label: 'Review' },
    approved: { color: 'green', label: 'Approved' },
    'needs-revision': { color: 'red', label: 'Needs Revision' },
  };

  const { color, label } = config[status];
  return <Badge color={color}>{label}</Badge>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const config: Record<ProjectStatus, { color: BadgeColor; label: string }> = {
    draft: { color: 'gray', label: 'Draft' },
    'in-progress': { color: 'blue', label: 'In Progress' },
    review: { color: 'yellow', label: 'Review' },
    completed: { color: 'green', label: 'Completed' },
    archived: { color: 'gray', label: 'Archived' },
  };

  const { color, label } = config[status];
  return <Badge color={color}>{label}</Badge>;
}

export function RoleBadge({ role }: { role: TeamRole }) {
  const config: Record<TeamRole, { color: BadgeColor; label: string }> = {
    writer: { color: 'purple', label: 'Writer' },
    director: { color: 'pink', label: 'Director' },
    cinematographer: { color: 'orange', label: 'Cinematographer' },
    animator: { color: 'blue', label: 'Animator' },
    editor: { color: 'green', label: 'Editor' },
  };

  const { color, label } = config[role];
  return <Badge color={color}>{label}</Badge>;
}
