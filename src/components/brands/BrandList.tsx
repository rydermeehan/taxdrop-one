import { useState } from 'react';
import type { Brand } from '../../types';
import { BrandCard } from './BrandCard';
import { BrandForm } from './BrandForm';
import { Modal } from '../common/Modal';
import { PlusIcon, PaletteIcon } from '../common/Icons';

interface BrandListProps {
  brands: Brand[];
  characterCounts: Record<string, number>;
  onCreateBrand: (data: { name: string; description: string }) => void;
  onSelectBrand: (brand: Brand) => void;
}

export function BrandList({ brands, characterCounts, onCreateBrand, onSelectBrand }: BrandListProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreate = (data: { name: string; description: string }) => {
    onCreateBrand(data);
    setShowCreateModal(false);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-lg">
        <h2>Brand Library</h2>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <PlusIcon />
          New Brand
        </button>
      </div>

      {brands.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <PaletteIcon />
            <h3>No brands yet</h3>
            <p>Create a brand to store characters, color palettes, and style guides for consistent video production.</p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <PlusIcon />
              Create First Brand
            </button>
          </div>
        </div>
      ) : (
        <div className="project-grid">
          {brands.map(brand => (
            <BrandCard
              key={brand.id}
              brand={brand}
              characterCount={characterCounts[brand.id] ?? 0}
              onClick={() => onSelectBrand(brand)}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Brand"
      >
        <BrandForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </>
  );
}
