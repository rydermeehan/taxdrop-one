import { useState } from 'react';
import type { Project, Brand } from '../../types';

interface ProjectFormProps {
  project?: Project;
  brands: Brand[];
  onSubmit: (data: { name: string; description: string; brandId: string | null; targetDuration: number }) => void;
  onCancel: () => void;
}

export function ProjectForm({ project, brands, onSubmit, onCancel }: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [brandId, setBrandId] = useState<string | null>(project?.brandId ?? null);
  const [targetDuration, setTargetDuration] = useState(project?.targetDuration ?? 30);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Project name is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({ name: name.trim(), description: description.trim(), brandId, targetDuration });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Project Name *</label>
        <input
          type="text"
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Summer Campaign Ad"
          autoFocus
        />
        {errors.name && <p className="form-error">{errors.name}</p>}
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-textarea"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Brief description of the project..."
          rows={3}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Brand Style</label>
        <select
          className="form-select"
          value={brandId ?? ''}
          onChange={e => setBrandId(e.target.value || null)}
        >
          <option value="">No brand selected</option>
          {brands.map(brand => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </select>
        <p className="form-hint">Select a brand to apply consistent character and style references</p>
      </div>

      <div className="form-group">
        <label className="form-label">Target Duration (seconds)</label>
        <input
          type="number"
          className="form-input"
          value={targetDuration}
          onChange={e => setTargetDuration(parseInt(e.target.value) || 30)}
          min={5}
          max={300}
        />
      </div>

      <div className="flex justify-between gap-sm mt-lg">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {project ? 'Save Changes' : 'Create Project'}
        </button>
      </div>
    </form>
  );
}
