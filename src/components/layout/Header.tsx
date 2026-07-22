import { ChevronRightIcon, DownloadIcon, UploadIcon } from '../common/Icons';

interface HeaderProps {
  title: string;
  breadcrumbs?: string[];
  onExport?: () => void;
  onImport?: () => void;
}

export function Header({ title, breadcrumbs = [], onExport, onImport }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="breadcrumbs">
          {breadcrumbs.map((crumb, i) => (
            <span key={i}>
              {crumb}
              {i < breadcrumbs.length - 1 && <ChevronRightIcon style={{ width: 14, height: 14 }} />}
            </span>
          ))}
          {breadcrumbs.length > 0 && <ChevronRightIcon style={{ width: 14, height: 14 }} />}
          <span>{title}</span>
        </div>
      </div>
      <div className="header-right">
        {onImport && (
          <button className="btn btn-ghost" onClick={onImport}>
            <UploadIcon />
            Import
          </button>
        )}
        {onExport && (
          <button className="btn btn-secondary" onClick={onExport}>
            <DownloadIcon />
            Export
          </button>
        )}
      </div>
    </header>
  );
}
