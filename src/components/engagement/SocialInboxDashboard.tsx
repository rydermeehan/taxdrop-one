import { useState, useEffect, useMemo } from 'react';
import {
  getAllItems,
  getStats,
  filterItems,
  updateItemStatus,
  deleteItem,
  clearAllItems,
  importFromJSON,
  loadDemoData,
  type InboxItem,
  type InboxFilters,
  type InboxCategory,
  type InboxPlatform,
  type InboxStatus,
  type InboxUrgency,
} from '../../services/socialInboxService';
import {
  CopyIcon,
  CheckIcon,
  TrashIcon,
  SearchIcon,
  RefreshIcon,
} from '../common/Icons';

// --- Constants ---

const CATEGORY_CONFIG: Record<InboxCategory, { label: string; color: string; bg: string }> = {
  LEAD: { label: 'Lead', color: '#0B8F52', bg: '#DFFFEA' },
  QUESTION: { label: 'Question', color: '#1D4ED8', bg: '#DBEAFE' },
  POSITIVE: { label: 'Positive', color: '#7C3AED', bg: '#EDE9FE' },
  NEGATIVE: { label: 'Negative', color: '#DC2626', bg: '#FEE2E2' },
  SPAM: { label: 'Spam', color: '#6B7280', bg: '#F3F4F6' },
  CONVERSATIONAL: { label: 'Chat', color: '#92400E', bg: '#FEF3C7' },
};

const PLATFORM_CONFIG: Record<InboxPlatform, { label: string; color: string }> = {
  facebook: { label: 'Facebook', color: '#1877F2' },
  instagram: { label: 'Instagram', color: '#E4405F' },
  twitter: { label: 'X/Twitter', color: '#1DA1F2' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
};

const STATUS_CONFIG: Record<InboxStatus, { label: string; color: string }> = {
  pending_review: { label: 'Pending', color: '#F59E0B' },
  replied: { label: 'Replied', color: '#10B981' },
  ignored: { label: 'Ignored', color: '#9CA3AF' },
  escalated: { label: 'Escalated', color: '#EF4444' },
};

const URGENCY_CONFIG: Record<InboxUrgency, { label: string; color: string }> = {
  high: { label: 'High', color: '#DC2626' },
  medium: { label: 'Medium', color: '#F59E0B' },
  low: { label: 'Low', color: '#9CA3AF' },
};

// --- Component ---

export function SocialInboxDashboard() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [filters, setFilters] = useState<InboxFilters>({
    platform: 'all',
    category: 'all',
    status: 'all',
    urgency: 'all',
    search: '',
  });
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ added: number; errors: string[] } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const reload = () => setItems(getAllItems());

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => filterItems(items, filters), [items, filters]);
  const stats = useMemo(() => getStats(items), [items]);

  const handleStatusChange = (id: string, status: InboxStatus) => {
    updateItemStatus(id, status, status === 'replied' ? { repliedAt: new Date().toISOString() } : {});
    reload();
    if (selectedItem?.id === id) {
      setSelectedItem(prev => prev ? { ...prev, status } : null);
    }
  };

  const handleDelete = (id: string) => {
    deleteItem(id);
    if (selectedItem?.id === id) setSelectedItem(null);
    reload();
  };

  const handleCopyReply = (item: InboxItem) => {
    navigator.clipboard.writeText(item.draftReply);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImport = () => {
    const result = importFromJSON(importText);
    setImportResult(result);
    if (result.added > 0) {
      reload();
      setTimeout(() => {
        setShowImport(false);
        setImportText('');
        setImportResult(null);
      }, 2000);
    }
  };

  const handleLoadDemo = () => {
    const added = loadDemoData();
    reload();
    if (added > 0) {
      setImportResult({ added, errors: [] });
      setTimeout(() => setImportResult(null), 2000);
    }
  };

  const handleClearAll = () => {
    if (confirm('Delete all inbox items? This cannot be undone.')) {
      clearAllItems();
      setSelectedItem(null);
      reload();
    }
  };

  const timeAgo = (ts: string): string => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div>
      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Total" value={stats.total} color="#1A1A1A" />
        <StatCard label="Leads" value={stats.leads} color="#0B8F52" highlight />
        <StatCard label="Questions" value={stats.questions} color="#1D4ED8" />
        <StatCard label="Pending" value={stats.pendingReview} color="#F59E0B" />
        <StatCard label="Replied" value={stats.replied} color="#10B981" />
        <StatCard label="Avg Score" value={stats.avgLeadScore} color="#7C3AED" suffix="/10" />
      </div>

      {/* Platform Breakdown */}
      {stats.total > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {(Object.entries(stats.platformBreakdown) as [InboxPlatform, number][])
            .filter(([, count]) => count > 0)
            .map(([platform, count]) => (
              <button
                key={platform}
                onClick={() => setFilters(f => ({ ...f, platform: f.platform === platform ? 'all' : platform }))}
                style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  border: `1.5px solid ${PLATFORM_CONFIG[platform].color}`,
                  background: filters.platform === platform ? PLATFORM_CONFIG[platform].color : 'white',
                  color: filters.platform === platform ? 'white' : PLATFORM_CONFIG[platform].color,
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {PLATFORM_CONFIG[platform].label} ({count})
              </button>
            ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '200px' }}>
          <SearchIcon style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9CA3AF' }} />
          <input
            type="text"
            placeholder="Search messages, authors, counties..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            style={{
              width: '100%',
              padding: '8px 10px 8px 34px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value as InboxCategory | 'all' }))}
          style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', background: 'white' }}
        >
          <option value="all">All Categories</option>
          <option value="LEAD">Leads</option>
          <option value="QUESTION">Questions</option>
          <option value="POSITIVE">Positive</option>
          <option value="NEGATIVE">Negative</option>
          <option value="SPAM">Spam</option>
          <option value="CONVERSATIONAL">Chat</option>
        </select>

        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value as InboxStatus | 'all' }))}
          style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', background: 'white' }}
        >
          <option value="all">All Status</option>
          <option value="pending_review">Pending</option>
          <option value="replied">Replied</option>
          <option value="ignored">Ignored</option>
          <option value="escalated">Escalated</option>
        </select>

        <select
          value={filters.urgency}
          onChange={e => setFilters(f => ({ ...f, urgency: e.target.value as InboxUrgency | 'all' }))}
          style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', background: 'white' }}
        >
          <option value="all">All Urgency</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(!showImport)}>
            Import
          </button>
          <button className="btn btn-secondary btn-sm" onClick={reload} title="Refresh">
            <RefreshIcon style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </div>

      {/* Import Panel */}
      {showImport && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>Import Inbox Items</h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleLoadDemo}>
                  Load Demo Data
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleClearAll}
                  style={{ color: '#DC2626' }}
                >
                  Clear All
                </button>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
              Paste JSON from your N8N workflow execution or Google Sheets export. Accepts single objects or arrays.
            </p>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder='[{"platform":"instagram","type":"comment","authorName":"@user","text":"Their comment...","category":"LEAD","leadScore":8,...}]'
              style={{
                width: '100%',
                height: '120px',
                padding: '10px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'monospace',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={!importText.trim()}>
                Import
              </button>
              {importResult && (
                <span style={{ fontSize: '12px', color: importResult.added > 0 ? '#0B8F52' : '#DC2626' }}>
                  {importResult.added > 0 ? `Added ${importResult.added} items` : importResult.errors.join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '64px', height: '64px', margin: '0 auto' }}>
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
          </div>
          <h3 style={{ margin: '0 0 8px', color: '#1A1A1A' }}>No inbox items yet</h3>
          <p style={{ color: '#6B7280', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
            Import data from your N8N Social Inbox Monitor workflow, or load demo data to explore the dashboard.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={handleLoadDemo}>
              Load Demo Data
            </button>
            <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
              Import JSON
            </button>
          </div>
        </div>
      )}

      {/* Main Layout: List + Detail */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: '16px', minHeight: '500px' }}>
          {/* Item List */}
          <div style={{ flex: '1 1 55%', minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
              {filtered.length} of {items.length} items
              {filters.search || filters.category !== 'all' || filters.status !== 'all' || filters.platform !== 'all' || filters.urgency !== 'all'
                ? ' (filtered)' : ''}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filtered.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  style={{
                    padding: '12px 16px',
                    background: selectedItem?.id === item.id ? '#F0FDF4' : 'white',
                    border: `1px solid ${selectedItem?.id === item.id ? '#0B8F52' : '#E5E7EB'}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    borderLeft: `4px solid ${CATEGORY_CONFIG[item.category].color}`,
                  }}
                >
                  {/* Row 1: Meta info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: CATEGORY_CONFIG[item.category].color,
                      background: CATEGORY_CONFIG[item.category].bg,
                    }}>
                      {CATEGORY_CONFIG[item.category].label}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: PLATFORM_CONFIG[item.platform].color,
                    }}>
                      {PLATFORM_CONFIG[item.platform].label}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      {item.type === 'dm' ? 'DM' : 'Comment'}
                    </span>
                    {item.category === 'LEAD' && (
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '10px',
                        fontWeight: '700',
                        color: 'white',
                        background: item.leadScore >= 8 ? '#0B8F52' : item.leadScore >= 5 ? '#F59E0B' : '#9CA3AF',
                      }}>
                        {item.leadScore}/10
                      </span>
                    )}
                    {item.urgency === 'high' && (
                      <span style={{ fontSize: '10px', fontWeight: '600', color: URGENCY_CONFIG.high.color }}>
                        HIGH
                      </span>
                    )}
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '11px',
                      color: STATUS_CONFIG[item.status].color,
                      fontWeight: '500',
                    }}>
                      {STATUS_CONFIG[item.status].label}
                    </span>
                  </div>

                  {/* Row 2: Author + message */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A1A', marginBottom: '2px' }}>
                        {item.authorName}
                        {item.state && (
                          <span style={{ fontWeight: '400', color: '#6B7280', marginLeft: '6px', fontSize: '11px' }}>
                            {item.state}{item.county ? ` / ${item.county}` : ''}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: '#374151',
                        lineHeight: '1.4',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {item.text}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0, marginTop: '2px' }}>
                      {timeAgo(item.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {filtered.length === 0 && items.length > 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: '#9CA3AF' }}>
                No items match your filters
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div style={{ flex: '0 0 42%', maxWidth: '500px' }}>
            {selectedItem ? (
              <DetailPanel
                item={selectedItem}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onCopyReply={handleCopyReply}
                copiedId={copiedId}
              />
            ) : (
              <div style={{
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                padding: '48px 24px',
                textAlign: 'center',
                color: '#9CA3AF',
                position: 'sticky',
                top: '16px',
              }}>
                <p style={{ fontSize: '14px' }}>Select an item to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* N8N Setup Hint */}
      <div style={{
        marginTop: '32px',
        padding: '16px 20px',
        background: '#F0FDF4',
        border: '1px solid #BBF7D0',
        borderRadius: '10px',
        fontSize: '13px',
        color: '#166534',
      }}>
        <strong>N8N Integration:</strong> This dashboard reads data imported from your{' '}
        <code style={{ background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px', fontSize: '12px' }}>
          n8n-social-inbox-monitor.json
        </code>{' '}
        workflow. The workflow polls Facebook and Instagram every 15 minutes, classifies comments/DMs with Claude, and logs to Google Sheets.
        Export the Sheet data as JSON and import here, or use the demo data to explore.
      </div>
    </div>
  );
}

// --- Subcomponents ---

function StatCard({ label, value, color, suffix, highlight }: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div style={{
      background: highlight ? '#F0FDF4' : 'white',
      border: `1px solid ${highlight ? '#BBF7D0' : '#E5E7EB'}`,
      borderRadius: '10px',
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: '500', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color, fontFamily: '"Space Grotesk", sans-serif' }}>
        {value}{suffix || ''}
      </div>
    </div>
  );
}

function DetailPanel({ item, onStatusChange, onDelete, onCopyReply, copiedId }: {
  item: InboxItem;
  onStatusChange: (id: string, status: InboxStatus) => void;
  onDelete: (id: string) => void;
  onCopyReply: (item: InboxItem) => void;
  copiedId: string | null;
}) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'sticky',
      top: '16px',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #E5E7EB',
        background: CATEGORY_CONFIG[item.category].bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{
            padding: '3px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '700',
            color: 'white',
            background: CATEGORY_CONFIG[item.category].color,
          }}>
            {CATEGORY_CONFIG[item.category].label}
          </span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: PLATFORM_CONFIG[item.platform].color }}>
            {PLATFORM_CONFIG[item.platform].label} {item.type === 'dm' ? 'DM' : 'Comment'}
          </span>
          {item.category === 'LEAD' && (
            <span style={{
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: '700',
              color: 'white',
              background: item.leadScore >= 8 ? '#0B8F52' : item.leadScore >= 5 ? '#F59E0B' : '#9CA3AF',
            }}>
              Score: {item.leadScore}/10
            </span>
          )}
          <span style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '600',
            color: URGENCY_CONFIG[item.urgency].color,
            border: `1px solid ${URGENCY_CONFIG[item.urgency].color}`,
            marginLeft: 'auto',
          }}>
            {URGENCY_CONFIG[item.urgency].label} Urgency
          </span>
        </div>
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1A1A' }}>
          {item.authorName}
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
          {new Date(item.timestamp).toLocaleString()}
          {item.state && (
            <span style={{ marginLeft: '8px', fontWeight: '500' }}>
              {item.state}{item.county ? ` / ${item.county} County` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Message */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Their Message
        </div>
        <div style={{
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#1A1A1A',
          padding: '12px',
          background: '#F9FAFB',
          borderRadius: '8px',
          borderLeft: `3px solid ${CATEGORY_CONFIG[item.category].color}`,
        }}>
          {item.text}
        </div>

        {item.postText && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              On Post
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic' }}>
              "{item.postText}"
            </div>
          </div>
        )}
      </div>

      {/* Classification */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          AI Analysis
        </div>
        <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>
          {item.reasoning}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
          <MiniTag label="Sentiment" value={item.sentiment} />
          {item.state && <MiniTag label="State" value={item.state} />}
          {item.county && <MiniTag label="County" value={item.county} />}
        </div>
      </div>

      {/* Draft Reply */}
      {item.draftReply && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Suggested Reply
            </div>
            <button
              onClick={() => onCopyReply(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                background: 'white',
                fontSize: '11px',
                cursor: 'pointer',
                color: copiedId === item.id ? '#0B8F52' : '#6B7280',
              }}
            >
              {copiedId === item.id ? (
                <><CheckIcon style={{ width: '12px', height: '12px' }} /> Copied</>
              ) : (
                <><CopyIcon style={{ width: '12px', height: '12px' }} /> Copy</>
              )}
            </button>
          </div>
          <div style={{
            fontSize: '13px',
            lineHeight: '1.6',
            color: '#1A1A1A',
            padding: '12px',
            background: '#F0FDF4',
            borderRadius: '8px',
            border: '1px solid #BBF7D0',
          }}>
            {item.draftReply}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {item.status === 'pending_review' && (
          <>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                onCopyReply(item);
                onStatusChange(item.id, 'replied');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <CheckIcon style={{ width: '14px', height: '14px' }} />
              Copy & Mark Replied
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onStatusChange(item.id, 'ignored')}
            >
              Ignore
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onStatusChange(item.id, 'escalated')}
              style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
            >
              Escalate
            </button>
          </>
        )}
        {item.status !== 'pending_review' && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onStatusChange(item.id, 'pending_review')}
          >
            Reopen
          </button>
        )}
        <button
          onClick={() => onDelete(item.id)}
          style={{
            marginLeft: 'auto',
            padding: '6px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: '#D1D5DB',
            borderRadius: '4px',
          }}
          title="Delete"
        >
          <TrashIcon style={{ width: '14px', height: '14px' }} />
        </button>
      </div>

      {/* Status indicator */}
      <div style={{
        padding: '8px 20px',
        background: STATUS_CONFIG[item.status].color + '15',
        borderTop: `1px solid ${STATUS_CONFIG[item.status].color}30`,
        fontSize: '12px',
        fontWeight: '500',
        color: STATUS_CONFIG[item.status].color,
        textAlign: 'center',
      }}>
        {STATUS_CONFIG[item.status].label}
        {item.repliedAt && ` — ${new Date(item.repliedAt).toLocaleString()}`}
      </div>
    </div>
  );
}

function MiniTag({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: '11px', color: '#6B7280' }}>
      <span style={{ fontWeight: '500' }}>{label}:</span>{' '}
      <span style={{ fontWeight: '600', color: '#374151' }}>{value}</span>
    </span>
  );
}
