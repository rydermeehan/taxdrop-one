import { PlayIcon, HomeIcon, FolderIcon, PaletteIcon, SparklesIcon, UsersIcon, SettingsIcon, FileTextIcon } from '../common/Icons';

type View = 'dashboard' | 'projects' | 'brands' | 'prompts' | 'blog' | 'team' | 'settings';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <HomeIcon /> },
    { id: 'projects', label: 'Projects', icon: <FolderIcon /> },
    { id: 'brands', label: 'Brand Library', icon: <PaletteIcon /> },
    { id: 'prompts', label: 'Prompt Generator', icon: <SparklesIcon /> },
    { id: 'blog', label: 'Blog Images', icon: <FileTextIcon /> },
    { id: 'team', label: 'Team', icon: <UsersIcon /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1 style={{ color: '#FFFFFF' }}>
          <PlayIcon style={{ width: 24, height: 24 }} />
          Video Studio
        </h1>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <SettingsIcon />
          Settings
        </button>
      </div>
    </aside>
  );
}
