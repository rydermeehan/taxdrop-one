import { useState } from 'react';
import type { Project, Brand } from '../../types';
import { ProjectCard } from './ProjectCard';
import { ProjectForm } from './ProjectForm';
import { Modal } from '../common/Modal';
import { PlusIcon, FolderIcon } from '../common/Icons';

interface ProjectListProps {
  projects: Project[];
  brands: Brand[];
  shotCounts: Record<string, number>;
  onCreateProject: (data: { name: string; description: string; brandId: string | null; targetDuration: number }) => void;
  onSelectProject: (project: Project) => void;
}

export function ProjectList({ projects, brands, shotCounts, onCreateProject, onSelectProject }: ProjectListProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreate = (data: { name: string; description: string; brandId: string | null; targetDuration: number }) => {
    onCreateProject(data);
    setShowCreateModal(false);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-lg">
        <h2>Projects</h2>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <PlusIcon />
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FolderIcon />
            <h3>No projects yet</h3>
            <p>Create your first video project to get started with AI-powered production.</p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <PlusIcon />
              Create First Project
            </button>
          </div>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              shotCount={shotCounts[project.id] ?? 0}
              onClick={() => onSelectProject(project)}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Project"
      >
        <ProjectForm
          brands={brands}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </>
  );
}
