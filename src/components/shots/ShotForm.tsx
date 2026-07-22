import { useState } from 'react';
import type { Shot, WorkflowStage, ShotType, ShotStatus } from '../../types';
import { workflowStages } from '../../data/workflowStages';

const shotTypes: { value: ShotType; label: string }[] = [
  { value: 'establishing', label: 'Establishing' },
  { value: 'wide', label: 'Wide' },
  { value: 'medium', label: 'Medium' },
  { value: 'close-up', label: 'Close-up' },
  { value: 'extreme-close-up', label: 'Extreme Close-up' },
  { value: 'over-shoulder', label: 'Over Shoulder' },
  { value: 'pov', label: 'POV' },
  { value: 'aerial', label: 'Aerial' },
  { value: 'tracking', label: 'Tracking' },
  { value: 'static', label: 'Static' },
];

const shotStatuses: { value: ShotStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'needs-revision', label: 'Needs Revision' },
];

interface ShotFormProps {
  shot?: Shot;
  projectId: string;
  onSubmit: (data: {
    name: string;
    stage: WorkflowStage;
    shotType: ShotType;
    duration: number;
    action: string;
    dialogue: string;
    visualDescription: string;
    cameraMovement: string;
    status: ShotStatus;
  }) => void;
  onCancel: () => void;
}

export function ShotForm({ shot, onSubmit, onCancel }: ShotFormProps) {
  const [name, setName] = useState(shot?.name ?? '');
  const [stage, setStage] = useState<WorkflowStage>(shot?.stage ?? 'script-development');
  const [shotType, setShotType] = useState<ShotType>(shot?.shotType ?? 'medium');
  const [duration, setDuration] = useState(shot?.duration ?? 3);
  const [action, setAction] = useState(shot?.action ?? '');
  const [dialogue, setDialogue] = useState(shot?.dialogue ?? '');
  const [visualDescription, setVisualDescription] = useState(shot?.visualDescription ?? '');
  const [cameraMovement, setCameraMovement] = useState(shot?.cameraMovement ?? '');
  const [status, setStatus] = useState<ShotStatus>(shot?.status ?? 'planned');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Shot name is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      name: name.trim(),
      stage,
      shotType,
      duration,
      action: action.trim(),
      dialogue: dialogue.trim(),
      visualDescription: visualDescription.trim(),
      cameraMovement: cameraMovement.trim(),
      status,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Shot Name *</label>
        <input
          type="text"
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Opening Hook, Product Reveal"
          autoFocus
        />
        {errors.name && <p className="form-error">{errors.name}</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
        <div className="form-group">
          <label className="form-label">Stage</label>
          <select
            className="form-select"
            value={stage}
            onChange={e => setStage(e.target.value as WorkflowStage)}
          >
            {workflowStages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Shot Type</label>
          <select
            className="form-select"
            value={shotType}
            onChange={e => setShotType(e.target.value as ShotType)}
          >
            {shotTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
        <div className="form-group">
          <label className="form-label">Duration (seconds)</label>
          <input
            type="number"
            className="form-input"
            value={duration}
            onChange={e => setDuration(parseInt(e.target.value) || 1)}
            min={1}
            max={30}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <select
            className="form-select"
            value={status}
            onChange={e => setStatus(e.target.value as ShotStatus)}
          >
            {shotStatuses.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Action</label>
        <textarea
          className="form-textarea"
          value={action}
          onChange={e => setAction(e.target.value)}
          placeholder="What happens in this shot? e.g., Character walks through rain, looks up at the sky..."
          rows={2}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Dialogue</label>
        <textarea
          className="form-textarea"
          value={dialogue}
          onChange={e => setDialogue(e.target.value)}
          placeholder="Any spoken lines in this shot..."
          rows={2}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Visual Description</label>
        <textarea
          className="form-textarea"
          value={visualDescription}
          onChange={e => setVisualDescription(e.target.value)}
          placeholder="Detailed visual description for image generation..."
          rows={3}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Camera Movement</label>
        <input
          type="text"
          className="form-input"
          value={cameraMovement}
          onChange={e => setCameraMovement(e.target.value)}
          placeholder="e.g., Slow push in, static, pan left..."
        />
      </div>

      <div className="flex justify-between gap-sm mt-lg">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {shot ? 'Save Changes' : 'Create Shot'}
        </button>
      </div>
    </form>
  );
}
