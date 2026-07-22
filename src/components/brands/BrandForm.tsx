import { useState } from 'react';
import type { Brand } from '../../types';

interface BrandFormProps {
  brand?: Brand;
  onSubmit: (data: { name: string; description: string }) => void;
  onCancel: () => void;
}

export function BrandForm({ brand, onSubmit, onCancel }: BrandFormProps) {
  const [name, setName] = useState(brand?.name ?? '');
  const [description, setDescription] = useState(brand?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Brand name is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({ name: name.trim(), description: description.trim() });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Brand Name *</label>
        <input
          type="text"
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., TechCorp Brand"
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
          placeholder="Describe the brand's visual identity and style..."
          rows={3}
        />
      </div>

      <div className="flex justify-between gap-sm mt-lg">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {brand ? 'Save Changes' : 'Create Brand'}
        </button>
      </div>
    </form>
  );
}
