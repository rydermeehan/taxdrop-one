import type { Brand } from '../../types';
import { PaletteIcon, UserIcon } from '../common/Icons';

interface BrandCardProps {
  brand: Brand;
  characterCount: number;
  onClick: () => void;
}

export function BrandCard({ brand, characterCount, onClick }: BrandCardProps) {
  return (
    <div className="project-card" onClick={onClick}>
      <div
        className="project-card-thumbnail"
        style={{
          background: brand.colorPalettes.length > 0
            ? `linear-gradient(135deg, ${brand.colorPalettes[0].primary}, ${brand.colorPalettes[0].secondary})`
            : undefined,
        }}
      >
        <PaletteIcon />
      </div>
      <div className="project-card-body">
        <h3 className="project-card-title">{brand.name}</h3>
        <p className="project-card-desc">{brand.description || 'No description'}</p>
        <div className="project-card-footer">
          <div className="project-card-stats">
            <span className="flex items-center gap-xs">
              <UserIcon style={{ width: 14, height: 14 }} />
              {characterCount} character{characterCount !== 1 ? 's' : ''}
            </span>
            <span>
              {brand.styleGuides.length} style guide{brand.styleGuides.length !== 1 ? 's' : ''}
            </span>
          </div>
          {brand.colorPalettes.length > 0 && (
            <div className="flex gap-xs">
              {brand.colorPalettes[0].additionalColors.slice(0, 3).concat([
                brand.colorPalettes[0].primary,
                brand.colorPalettes[0].secondary,
                brand.colorPalettes[0].accent,
              ]).slice(0, 5).map((color, i) => (
                <div
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: color,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
