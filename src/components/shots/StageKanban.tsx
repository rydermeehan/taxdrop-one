import { useState } from 'react';
import type { Shot, WorkflowStage } from '../../types';
import { workflowStages } from '../../data/workflowStages';
import { ShotCard } from './ShotCard';
import { ShotForm } from './ShotForm';
import { Modal } from '../common/Modal';
import { PlusIcon } from '../common/Icons';

interface StageKanbanProps {
  shots: Shot[];
  projectId: string;
  commentCounts: Record<string, number>;
  onCreateShot: (data: Parameters<typeof ShotForm>[0]['onSubmit'] extends (data: infer D) => void ? D : never) => void;
  onUpdateShot: (id: string, data: Parameters<typeof ShotForm>[0]['onSubmit'] extends (data: infer D) => void ? D : never) => void;
  onMoveShot: (shotId: string, toStage: WorkflowStage) => void;
  onSelectShot: (shot: Shot) => void;
}

export function StageKanban({
  shots,
  projectId,
  commentCounts,
  onCreateShot,
  onUpdateShot: _onUpdateShot,
  onMoveShot,
  onSelectShot,
}: StageKanbanProps) {
  void _onUpdateShot; // Reserved for future use
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStage, setCreateStage] = useState<WorkflowStage>('script-development');
  const [draggedShot, setDraggedShot] = useState<Shot | null>(null);

  const getShotsByStage = (stageId: WorkflowStage) =>
    shots.filter(s => s.stage === stageId).sort((a, b) => a.order - b.order);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: WorkflowStage) => {
    e.preventDefault();
    if (draggedShot && draggedShot.stage !== stageId) {
      onMoveShot(draggedShot.id, stageId);
    }
    setDraggedShot(null);
  };

  const handleAddToStage = (stageId: WorkflowStage) => {
    setCreateStage(stageId);
    setShowCreateModal(true);
  };

  return (
    <>
      <div className="kanban">
        {workflowStages.map(stage => {
          const stageShots = getShotsByStage(stage.id);
          return (
            <div
              key={stage.id}
              className="kanban-column"
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, stage.id)}
            >
              <div className="kanban-header" style={{ borderColor: stage.color }}>
                <div className="kanban-title" style={{ color: stage.color }}>
                  {stage.shortName}
                  <span className="kanban-count">{stageShots.length}</span>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleAddToStage(stage.id)}
                  title="Add shot to this stage"
                >
                  <PlusIcon />
                </button>
              </div>
              <div className="kanban-cards">
                {stageShots.map(shot => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    commentCount={commentCounts[shot.id] ?? 0}
                    onClick={() => onSelectShot(shot)}
                    onDragStart={() => setDraggedShot(shot)}
                    onDragEnd={() => setDraggedShot(null)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Shot"
        size="lg"
      >
        <ShotForm
          projectId={projectId}
          shot={{ stage: createStage } as Shot}
          onSubmit={data => {
            onCreateShot({ ...data, stage: createStage });
            setShowCreateModal(false);
          }}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </>
  );
}
