import type { Project } from '../../types';
import { VideoIcon, ClockIcon, ImageIcon } from '../common/Icons';
import { ProjectStatusBadge } from '../common/Badge';

interface ProjectCardProps {
  project: Project;
  shotCount: number;
  onClick: () => void;
}

export function ProjectCard({ project, shotCount, onClick }: ProjectCardProps) {
  return (
    <div className="project-card" onClick={onClick}>
      <div className="project-card-thumbnail">
        {project.thumbnail ? (
          <img src={project.thumbnail} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <VideoIcon />
        )}
      </div>
      <div className="project-card-body">
        <h3 className="project-card-title">{project.name}</h3>
        <p className="project-card-desc">{project.description || 'No description'}</p>
        <div className="project-card-footer">
          <div className="project-card-stats">
            <span className="flex items-center gap-xs">
              <ImageIcon style={{ width: 14, height: 14 }} />
              {shotCount} shots
            </span>
            <span className="flex items-center gap-xs">
              <ClockIcon style={{ width: 14, height: 14 }} />
              {project.targetDuration}s
            </span>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>
    </div>
  );
}
