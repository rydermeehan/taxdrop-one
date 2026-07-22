import { useState, useEffect } from 'react';
import type { Brand } from './types';
import { PasswordGate } from './components/auth/PasswordGate';
import { BlogImageGenerator } from './components/blog/BlogImageGenerator';
import { ContentGenerator } from './components/content/ContentGenerator';
import { ConsistentCharacterGenerator } from './components/content/ConsistentCharacterGenerator';
import { SocialMediaGenerator } from './components/content/SocialMediaGenerator';
import { SocialInboxDashboard } from './components/engagement/SocialInboxDashboard';
import { GlossaryIdeaGenerator } from './components/content/GlossaryIdeaGenerator';
import { TrendMonitor } from './components/trends/TrendMonitor';
import { GSCDashboard } from './components/gsc/GSCDashboard';
import { NeurowriterDashboard } from './components/neurowriter/NeurowriterDashboard';
import { SEODashboard } from './components/seo/SEODashboard';
import { PromptLibrary } from './components/prompts/PromptLibrary';
import { UserGuide } from './components/content/UserGuide';
import { ApiSettings } from './components/settings/ApiSettings';
import { BrandContext } from './components/settings/BrandContext';

// Schemas
import { blogPostSchema } from './services/collections/blogPostSchema';
import { glossarySchema } from './services/collections/glossarySchema';
import { partnerSchema } from './services/collections/partnerSchema';
import { propertyTypeSchema } from './services/collections/propertyTypeSchema';
import { helpCenterSchema } from './services/collections/helpCenterSchema';
import { countySchema } from './services/collections/countySchema';

import {
  ImageIcon,
  FileTextIcon,
  SparklesIcon,
  SettingsIcon,
  SearchIcon,
  PenToolIcon,
  MessageIcon,
  UserIcon,
  MapPinIcon,
  BuildingIcon,
  HelpCircleIcon,
  HandshakeIcon,
  BookOpenIcon,
  InboxIcon,
  GuideIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
} from './components/common/Icons';

import type { TrendIdeaTransfer } from './types';
import * as brandService from './services/brandService';
import { handleOAuthCallback } from './services/gscService';

type View =
  | 'blog-images'
  | 'blog-posts'
  | 'glossary'
  | 'glossary-ideas'
  | 'partners'
  | 'property-types'
  | 'help-center'
  | 'counties'
  | 'social'
  | 'engagement'
  | 'trends'
  | 'characters'
  | 'prompts'
  | 'gsc'
  | 'neurowriter'
  | 'seo'
  | 'guide'
  | 'settings';

interface NavGroup {
  label: string;
  items: { id: View; label: string; icon: React.ReactNode }[];
}

function AppContent() {
  const [view, setView] = useState<View>('blog-images');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [pendingIdea, setPendingIdea] = useState<TrendIdeaTransfer | undefined>();
  const [ideaQueue, setIdeaQueue] = useState<TrendIdeaTransfer[]>([]);
  const [glossaryConcept, setGlossaryConcept] = useState<string | undefined>();

  useEffect(() => {
    setBrands(brandService.getBrands());

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      setOauthStatus('processing');
      handleOAuthCallback(code).then(success => {
        setOauthStatus(success ? 'success' : 'error');
        window.history.replaceState({}, '', window.location.pathname);
        if (success) {
          setView('settings');
        }
      });
    }
  }, []);

  const navGroups: NavGroup[] = [
    {
      label: 'Content',
      items: [
        { id: 'blog-images', label: 'Image Studio', icon: <ImageIcon /> },
        { id: 'blog-posts', label: 'Blog Posts', icon: <FileTextIcon /> },
        { id: 'glossary', label: 'Glossary', icon: <BookOpenIcon /> },
        { id: 'glossary-ideas', label: 'Glossary Ideas', icon: <SparklesIcon /> },
        { id: 'partners', label: 'Partners', icon: <HandshakeIcon /> },
        { id: 'property-types', label: 'Property Types', icon: <BuildingIcon /> },
        { id: 'help-center', label: 'Help Center', icon: <HelpCircleIcon /> },
        { id: 'counties', label: 'Counties', icon: <MapPinIcon /> },
        { id: 'social', label: 'Social Media', icon: <SparklesIcon /> },
        { id: 'engagement', label: 'Engagement', icon: <InboxIcon /> },
        { id: 'trends', label: 'Trend Monitor', icon: <TrendingUpIcon /> },
      ],
    },
    {
      label: 'Tools',
      items: [
        { id: 'characters', label: 'Character Gen', icon: <UserIcon /> },
        { id: 'prompts', label: 'Prompt Library', icon: <MessageIcon /> },
        { id: 'gsc', label: 'Search Console', icon: <SearchIcon /> },
        { id: 'neurowriter', label: 'Neurowriter', icon: <PenToolIcon /> },
        { id: 'seo', label: 'SEO Analyzer', icon: <ShieldCheckIcon /> },
        { id: 'guide', label: 'Guide', icon: <GuideIcon /> },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
      ],
    },
  ];

  const currentLabel = navGroups
    .flatMap(g => g.items)
    .find(n => n.id === view)?.label || '';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px',
        background: 'var(--td-charcoal)',
        color: 'white',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: '0 24px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          marginBottom: '16px',
        }}>
          <h1 style={{
            fontSize: '20px',
            fontWeight: '700',
            fontFamily: '"Space Grotesk", sans-serif',
            margin: 0,
          }}>
            TaxDrop Content Studio
          </h1>
          <p style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            margin: '4px 0 0',
          }}>
            Content Generation Hub
          </p>
        </div>

        {/* Grouped Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {navGroups.map(group => (
            <div key={group.label} style={{ marginBottom: '8px' }}>
              <div style={{
                padding: '8px 24px 6px',
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.35)',
              }}>
                {group.label}
              </div>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 24px',
                    border: 'none',
                    background: view === item.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: view === item.id ? 'white' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (view !== item.id) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (view !== item.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{ width: '20px', height: '20px' }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.4)',
        }}>
          TaxDrop Internal Tool
        </div>
      </aside>

      {/* Main Content */}
      <main style={{
        flex: 1,
        background: '#F9FAFB',
        overflow: 'auto',
      }}>
        {/* Header */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid #E5E7EB',
          padding: '16px 32px',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--td-charcoal)',
          }}>
            {currentLabel}
          </h2>
        </header>

        {/* OAuth Status */}
        {oauthStatus === 'processing' && (
          <div style={{ padding: '16px 32px', background: '#FEF3C7', borderBottom: '1px solid #FCD34D' }}>
            Connecting to Google Search Console...
          </div>
        )}
        {oauthStatus === 'success' && (
          <div style={{ padding: '16px 32px', background: 'var(--td-mint)', borderBottom: '1px solid var(--td-emerald-light)' }}>
            Successfully connected to Google Search Console! Select your site below.
          </div>
        )}
        {oauthStatus === 'error' && (
          <div style={{ padding: '16px 32px', background: '#FEE2E2', borderBottom: '1px solid #EF4444' }}>
            Failed to connect to Google Search Console. Please try again.
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '32px' }}>
          {view === 'blog-images' && (
            <BlogImageGenerator
              brands={brands}
              onNavigate={(v) => setView(v as View)}
            />
          )}

          {view === 'blog-posts' && (
            <ContentGenerator schema={blogPostSchema} />
          )}

          {view === 'glossary' && (
            <ContentGenerator
              key={glossaryConcept}
              schema={glossarySchema}
              initialConcept={glossaryConcept}
            />
          )}

          {view === 'glossary-ideas' && (
            <GlossaryIdeaGenerator
              onGenerateTerm={(term) => {
                setGlossaryConcept(term);
                setView('glossary');
              }}
            />
          )}

          {view === 'partners' && (
            <ContentGenerator schema={partnerSchema} />
          )}

          {view === 'property-types' && (
            <ContentGenerator schema={propertyTypeSchema} />
          )}

          {view === 'help-center' && (
            <ContentGenerator schema={helpCenterSchema} />
          )}

          {view === 'counties' && (
            <ContentGenerator schema={countySchema} />
          )}

          {view === 'social' && (
            <SocialMediaGenerator
              brands={brands}
              initialIdea={pendingIdea}
              queueRemaining={ideaQueue.length}
              onIdeaConsumed={() => {
                if (ideaQueue.length > 0) {
                  setPendingIdea(ideaQueue[0]);
                  setIdeaQueue(q => q.slice(1));
                } else {
                  setPendingIdea(undefined);
                }
              }}
            />
          )}

          {view === 'engagement' && (
            <SocialInboxDashboard />
          )}

          {view === 'trends' && (
            <TrendMonitor
              onCreatePost={(idea) => {
                setPendingIdea(idea);
                setIdeaQueue([]);
                setView('social');
              }}
              onQueueAll={(ideas) => {
                setPendingIdea(ideas[0]);
                setIdeaQueue(ideas.slice(1));
                setView('social');
              }}
            />
          )}

          {view === 'characters' && (
            <ConsistentCharacterGenerator />
          )}

          {view === 'prompts' && (
            <PromptLibrary />
          )}

          {view === 'gsc' && (
            <GSCDashboard />
          )}

          {view === 'neurowriter' && (
            <NeurowriterDashboard />
          )}

          {view === 'seo' && (
            <SEODashboard />
          )}

          {view === 'guide' && (
            <UserGuide />
          )}

          {view === 'settings' && (
            <div>
              <BrandContext />

              <div className="mt-lg">
                <ApiSettings />
              </div>

              <div className="card mt-lg">
                <div className="card-body">
                  <h4 className="mb-md">About TaxDrop Content Studio</h4>
                  <p className="text-gray">
                    Internal content generation hub for the TaxDrop team.
                    Generate blog posts, glossary pages, partner pages, property type pages,
                    help center articles, county pages, social media content, and images — all
                    on-brand and ready to publish directly to Webflow CMS.
                  </p>
                  <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: 'var(--td-mint)',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}>
                    <strong>Integrations:</strong> Webflow CMS, OpenRouter AI, Google Search Console, NeuronWriter
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <PasswordGate password="sup">
      <AppContent />
    </PasswordGate>
  );
}
