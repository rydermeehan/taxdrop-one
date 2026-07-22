import type { Shot } from '../../types';
import { ShotStatusBadge } from '../common/Badge';
import { ClockIcon, MessageIcon } from '../common/Icons';

interface ShotCardProps {
  shot: Shot;
  commentCount?: number;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function ShotCard({ shot, commentCount = 0, onClick, onDragStart, onDragEnd }: ShotCardProps) {
  return (
    <div
      className="shot-card"
      onClick={onClick}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="shot-card-header">
        <div>
          <div className="shot-card-title">{shot.name}</div>
          <div className="shot-card-type">{shot.shotType.replace('-', ' ')}</div>
        </div>
        <ShotStatusBadge status={shot.status} />
      </div>
      {shot.action && (
        <p className="text-sm text-gray" style={{ marginBottom: 'var(--spacing-sm)', lineHeight: 1.4 }}>
          {shot.action.length > 80 ? `${shot.action.substring(0, 80)}...` : shot.action}
        </p>
      )}
      <div className="shot-card-meta">
        <span className="flex items-center gap-xs">
          <ClockIcon style={{ width: 12, height: 12 }} />
          {shot.duration}s
        </span>
        {commentCount > 0 && (
          <span className="flex items-center gap-xs">
            <MessageIcon style={{ width: 12, height: 12 }} />
            {commentCount}
          </span>
        )}
        {shot.imageRefs.length > 0 && (
          <span>{shot.imageRefs.length} image{shot.imageRefs.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
}
