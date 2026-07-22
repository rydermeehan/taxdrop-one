import { useState, useEffect } from 'react';
import {
  getOpenRouterSettings,
  saveOpenRouterSettings,
  testApiKey,
  IMAGE_MODELS,
  type ImageModel,
} from '../../services/openrouterService';
import {
  getWebflowToken,
  setWebflowToken,
  verifyToken as verifyWebflowToken,
} from '../../services/webflowService';
import {
  getOnlySocialToken,
  setOnlySocialToken,
  getWorkspaceUuid,
  setWorkspaceUuid,
  verifyConfig as verifyOnlySocial,
} from '../../services/onlySocialService';
import {
  getGSCSettings,
  saveGSCSettings,
  initiateOAuth,
  disconnectGSC,
  getSites,
  setClientId as setGSCClientId,
  setClientSecret as setGSCClientSecret,
} from '../../services/gscService';
import {
  getNeurowriterSettings,
  saveNeurowriterSettings,
  verifyNeurowriterConfig,
} from '../../services/neurowriterService';
import {
  getSendFoxSettings,
  saveSendFoxSettings,
  testApiKey as testSendFoxApiKey,
} from '../../services/sendfoxService';
import {
  getInboxSettings,
  saveInboxSettings,
} from '../../services/socialInboxService';
import {
  getN8nWebhookUrl,
  setN8nWebhookUrl,
} from '../../services/n8nPublishService';
import { CheckIcon } from '../common/Icons';

export function ApiSettings() {
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState<ImageModel>('google/gemini-3-pro-image-preview');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);

  // Webflow state
  const [webflowToken, setWebflowTokenState] = useState('');
  const [testingWebflow, setTestingWebflow] = useState(false);
  const [webflowTestResult, setWebflowTestResult] = useState<'success' | 'error' | null>(null);
  const [webflowSaved, setWebflowSaved] = useState(false);

  // OnlySocial state
  const [onlySocialToken, setOnlySocialTokenState] = useState('');
  const [onlySocialWorkspace, setOnlySocialWorkspaceState] = useState('');
  const [testingOnlySocial, setTestingOnlySocial] = useState(false);
  const [onlySocialTestResult, setOnlySocialTestResult] = useState<'success' | 'error' | null>(null);
  const [onlySocialSaved, setOnlySocialSaved] = useState(false);

  // GSC state
  const [gscClientId, setGscClientIdState] = useState('');
  const [gscClientSecret, setGscClientSecretState] = useState('');
  const [gscConnected, setGscConnected] = useState(false);
  const [gscSiteUrl, setGscSiteUrl] = useState('');
  const [gscSites, setGscSites] = useState<{ siteUrl: string; permissionLevel: string }[]>([]);
  const [loadingGscSites, setLoadingGscSites] = useState(false);
  const [gscSaved, setGscSaved] = useState(false);
  const [gscError, setGscError] = useState<string | null>(null);

  // Neurowriter state
  const [neurowriterApiKey, setNeurowriterApiKey] = useState('');
  const [testingNeurowriter, setTestingNeurowriter] = useState(false);
  const [neurowriterTestResult, setNeurowriterTestResult] = useState<'success' | 'error' | null>(null);
  const [neurowriterSaved, setNeurowriterSaved] = useState(false);

  // SendFox state
  const [sendFoxApiKey, setSendFoxApiKey] = useState('');
  const [testingSendFox, setTestingSendFox] = useState(false);
  const [sendFoxTestResult, setSendFoxTestResult] = useState<'success' | 'error' | null>(null);
  const [sendFoxSaved, setSendFoxSaved] = useState(false);

  // N8N Publish state
  const [n8nWebhookUrlState, setN8nWebhookUrlState] = useState('');
  const [n8nSaved, setN8nSaved] = useState(false);

  // Meta / Social Inbox state
  const [metaPageToken, setMetaPageToken] = useState('');
  const [metaPageId, setMetaPageId] = useState('');
  const [instagramBusinessId, setInstagramBusinessId] = useState('');
  const [metaSaved, setMetaSaved] = useState(false);

  useEffect(() => {
    const settings = getOpenRouterSettings();
    setApiKey(settings.apiKey);
    setDefaultModel(settings.defaultModel);

    // Load Webflow token
    const wfToken = getWebflowToken();
    if (wfToken) {
      setWebflowTokenState(wfToken);
    }

    // Load OnlySocial config
    const osToken = getOnlySocialToken();
    const osWorkspace = getWorkspaceUuid();
    if (osToken) setOnlySocialTokenState(osToken);
    if (osWorkspace) setOnlySocialWorkspaceState(osWorkspace);

    // Load GSC config
    const gscSettings = getGSCSettings();
    setGscConnected(gscSettings.isConnected);
    if (gscSettings.siteUrl) setGscSiteUrl(gscSettings.siteUrl);
    // Load client ID and secret from localStorage
    const storedClientId = localStorage.getItem('gsc-client-id');
    const storedClientSecret = localStorage.getItem('gsc-client-secret');
    if (storedClientId) setGscClientIdState(storedClientId);
    if (storedClientSecret) setGscClientSecretState(storedClientSecret);

    // If connected, load sites
    if (gscSettings.isConnected) {
      loadGscSites();
    }

    // Load Neurowriter config
    const nwSettings = getNeurowriterSettings();
    if (nwSettings.apiKey) setNeurowriterApiKey(nwSettings.apiKey);

    // Load SendFox config
    const sfSettings = getSendFoxSettings();
    if (sfSettings.apiKey) setSendFoxApiKey(sfSettings.apiKey);

    // Load N8N webhook URL
    const n8nUrl = getN8nWebhookUrl();
    if (n8nUrl) setN8nWebhookUrlState(n8nUrl);

    // Load Meta / Social Inbox config
    const inboxSettings = getInboxSettings();
    if (inboxSettings.metaPageToken) setMetaPageToken(inboxSettings.metaPageToken);
    if (inboxSettings.metaPageId) setMetaPageId(inboxSettings.metaPageId);
    if (inboxSettings.instagramBusinessId) setInstagramBusinessId(inboxSettings.instagramBusinessId);
  }, []);

  const handleTestKey = async () => {
    if (!apiKey) return;

    setTesting(true);
    setTestResult(null);

    const valid = await testApiKey(apiKey);
    setTestResult(valid ? 'success' : 'error');
    setTesting(false);
  };

  const handleSave = () => {
    saveOpenRouterSettings({ apiKey, defaultModel });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestWebflow = async () => {
    if (!webflowToken) return;

    setTestingWebflow(true);
    setWebflowTestResult(null);

    // Save token first so verifyToken can use it
    setWebflowToken(webflowToken);

    const valid = await verifyWebflowToken();
    setWebflowTestResult(valid ? 'success' : 'error');
    setTestingWebflow(false);
  };

  const handleSaveWebflow = () => {
    setWebflowToken(webflowToken);
    setWebflowSaved(true);
    setTimeout(() => setWebflowSaved(false), 2000);
  };

  // OnlySocial error details state
  const [onlySocialErrorDetail, setOnlySocialErrorDetail] = useState<string | null>(null);

  const handleTestOnlySocial = async () => {
    if (!onlySocialToken || !onlySocialWorkspace) return;

    setTestingOnlySocial(true);
    setOnlySocialTestResult(null);
    setOnlySocialErrorDetail(null);

    // Save config first so verify can use it
    setOnlySocialToken(onlySocialToken);
    setWorkspaceUuid(onlySocialWorkspace);

    try {
      const valid = await verifyOnlySocial();
      setOnlySocialTestResult(valid ? 'success' : 'error');
      if (!valid) {
        setOnlySocialErrorDetail('Check browser console (F12) for details');
      }
    } catch (err) {
      setOnlySocialTestResult('error');
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setOnlySocialErrorDetail(errorMsg);
      console.error('OnlySocial test error:', err);
    }
    setTestingOnlySocial(false);
  };

  const handleSaveOnlySocial = () => {
    setOnlySocialToken(onlySocialToken);
    setWorkspaceUuid(onlySocialWorkspace);
    setOnlySocialSaved(true);
    setTimeout(() => setOnlySocialSaved(false), 2000);
  };

  // GSC handlers
  const loadGscSites = async () => {
    setLoadingGscSites(true);
    try {
      const sites = await getSites();
      setGscSites(sites);
      // If no site is selected yet and we have sites, select the first one
      if (!gscSiteUrl && sites.length > 0) {
        setGscSiteUrl(sites[0].siteUrl);
        saveGSCSettings({ siteUrl: sites[0].siteUrl });
      }
    } catch (err) {
      console.error('Failed to load GSC sites:', err);
    } finally {
      setLoadingGscSites(false);
    }
  };

  const handleSaveGSCCredentials = () => {
    if (gscClientId.trim()) {
      setGSCClientId(gscClientId.trim());
      if (gscClientSecret.trim()) {
        setGSCClientSecret(gscClientSecret.trim());
      }
      setGscSaved(true);
      setGscError(null);
      setTimeout(() => setGscSaved(false), 2000);
    }
  };

  const handleConnectGSC = async () => {
    if (!gscClientId.trim() || !gscClientSecret.trim()) {
      setGscError('Please enter both OAuth Client ID and Client Secret first');
      return;
    }
    // Save credentials before redirecting
    setGSCClientId(gscClientId.trim());
    setGSCClientSecret(gscClientSecret.trim());
    setGscError(null);
    try {
      await initiateOAuth();
    } catch (err) {
      setGscError(err instanceof Error ? err.message : 'Failed to initiate OAuth');
    }
  };

  const handleDisconnectGSC = () => {
    disconnectGSC();
    setGscConnected(false);
    setGscSites([]);
    setGscSiteUrl('');
  };

  const handleSaveGSC = () => {
    saveGSCSettings({ siteUrl: gscSiteUrl });
    setGscSaved(true);
    setTimeout(() => setGscSaved(false), 2000);
  };

  // Neurowriter handlers
  const handleTestNeurowriter = async () => {
    if (!neurowriterApiKey) return;

    setTestingNeurowriter(true);
    setNeurowriterTestResult(null);

    // Save config first so verify can use it
    saveNeurowriterSettings({ apiKey: neurowriterApiKey });

    try {
      const valid = await verifyNeurowriterConfig();
      setNeurowriterTestResult(valid ? 'success' : 'error');
    } catch {
      setNeurowriterTestResult('error');
    }
    setTestingNeurowriter(false);
  };

  const handleSaveNeurowriter = () => {
    saveNeurowriterSettings({ apiKey: neurowriterApiKey });
    setNeurowriterSaved(true);
    setTimeout(() => setNeurowriterSaved(false), 2000);
  };

  // SendFox handlers
  const handleTestSendFox = async () => {
    if (!sendFoxApiKey) return;

    setTestingSendFox(true);
    setSendFoxTestResult(null);

    try {
      const valid = await testSendFoxApiKey(sendFoxApiKey);
      setSendFoxTestResult(valid ? 'success' : 'error');
      if (valid) {
        // Save if valid
        saveSendFoxSettings({ apiKey: sendFoxApiKey });
      }
    } catch {
      setSendFoxTestResult('error');
    }
    setTestingSendFox(false);
  };

  const handleSaveSendFox = () => {
    saveSendFoxSettings({ apiKey: sendFoxApiKey });
    setSendFoxSaved(true);
    setTimeout(() => setSendFoxSaved(false), 2000);
  };

  return (
    <>
    <div className="card">
      <div className="card-header">
        <h4>OpenRouter API</h4>
      </div>
      <div className="card-body">
        <p className="text-sm text-gray mb-md">
          Connect to OpenRouter to generate images using AI models like Nano Banana (Gemini), FLUX, and more.
          Get your API key at{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
            openrouter.ai/keys
          </a>
        </p>

        <div className="form-group">
          <label className="form-label">API Key</label>
          <div className="flex gap-sm">
            <input
              type="password"
              className="form-input"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={handleTestKey}
              disabled={!apiKey || testing}
            >
              {testing ? 'Testing...' : 'Test'}
            </button>
          </div>
          {testResult === 'success' && (
            <p className="form-hint" style={{ color: 'var(--td-emerald-light)' }}>
              <CheckIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
              API key is valid
            </p>
          )}
          {testResult === 'error' && (
            <p className="form-error">Invalid API key. Please check and try again.</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Default Model</label>
          <select
            className="form-select"
            value={defaultModel}
            onChange={e => setDefaultModel(e.target.value as ImageModel)}
          >
            {IMAGE_MODELS.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.provider})
              </option>
            ))}
          </select>
          <p className="form-hint">
            {IMAGE_MODELS.find(m => m.id === defaultModel)?.description}
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>

    {/* Webflow Settings */}
    <div className="card mt-lg">
      <div className="card-header">
        <h4>Webflow CMS</h4>
      </div>
      <div className="card-body">
        <p className="text-sm text-gray mb-md">
          Connect to Webflow to publish blog posts and glossary terms directly to TaxDrop.com CMS.
          Create a Site Token at{' '}
          <a href="https://webflow.com/dashboard/account/integrations" target="_blank" rel="noopener noreferrer">
            Webflow Integrations
          </a>
          {' '}with CMS read/write permissions.
        </p>

        <div className="form-group">
          <label className="form-label">Site API Token</label>
          <div className="flex gap-sm">
            <input
              type="password"
              className="form-input"
              value={webflowToken}
              onChange={e => setWebflowTokenState(e.target.value)}
              placeholder="Enter your Webflow Site Token..."
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={handleTestWebflow}
              disabled={!webflowToken || testingWebflow}
            >
              {testingWebflow ? 'Testing...' : 'Test'}
            </button>
          </div>
          {webflowTestResult === 'success' && (
            <p className="form-hint" style={{ color: 'var(--td-emerald-light)' }}>
              <CheckIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
              Token is valid - connected to TaxDrop site
            </p>
          )}
          {webflowTestResult === 'error' && (
            <p className="form-error">Invalid token or insufficient permissions. Ensure CMS read/write access.</p>
          )}
        </div>

        <button className="btn btn-primary" onClick={handleSaveWebflow}>
          {webflowSaved ? 'Saved!' : 'Save Token'}
        </button>
      </div>
    </div>

    {/* OnlySocial Settings */}
    <div className="card mt-lg">
      <div className="card-header">
        <h4>OnlySocial</h4>
      </div>
      <div className="card-body">
        <p className="text-sm text-gray mb-md">
          Connect to OnlySocial to schedule and publish social media posts.
        </p>

        <div className="form-group">
          <label className="form-label">API Token</label>
          <input
            type="password"
            className="form-input"
            value={onlySocialToken}
            onChange={e => setOnlySocialTokenState(e.target.value)}
            placeholder="Enter your OnlySocial API token..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Workspace UUID</label>
          <div className="flex gap-sm">
            <input
              type="text"
              className="form-input"
              value={onlySocialWorkspace}
              onChange={e => setOnlySocialWorkspaceState(e.target.value)}
              placeholder="7fc16550-2f54-49c7-9f27-a00ca019ce53"
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={handleTestOnlySocial}
              disabled={!onlySocialToken || !onlySocialWorkspace || testingOnlySocial}
            >
              {testingOnlySocial ? 'Testing...' : 'Test'}
            </button>
          </div>
          {onlySocialTestResult === 'success' && (
            <p className="form-hint" style={{ color: 'var(--td-emerald-light)' }}>
              <CheckIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
              Connected successfully - found social accounts
            </p>
          )}
          {onlySocialTestResult === 'error' && (
            <div className="form-error">
              <p style={{ marginBottom: '8px' }}>Connection failed.</p>
              {onlySocialErrorDetail && (
                <div style={{
                  marginBottom: '8px',
                  padding: '8px',
                  background: '#FEE2E2',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}>
                  {onlySocialErrorDetail}
                </div>
              )}
              <p style={{ fontSize: '12px', marginBottom: '4px' }}><strong>Common issues:</strong></p>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px' }}>
                <li>Make sure you're using the <strong>Workspace UUID</strong> from the URL</li>
                <li>Check that your API token has not expired</li>
              </ul>
            </div>
          )}
        </div>

        <button className="btn btn-primary" onClick={handleSaveOnlySocial}>
          {onlySocialSaved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>

    {/* N8N Publish Webhook */}
    <div className="card mt-lg">
      <div className="card-header">
        <h4>N8N Publish Webhook</h4>
      </div>
      <div className="card-body">
        <p className="text-sm text-gray mb-md">
          Connect to your N8N workflow to publish social media content directly from the studio.
          Import the <code style={{ background: '#E5E7EB', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>n8n-studio-publish-workflow.json</code> workflow
          into your N8N instance and activate it.
        </p>

        <div className="form-group">
          <label className="form-label">Webhook URL</label>
          <input
            type="text"
            className="form-input"
            value={n8nWebhookUrlState}
            onChange={e => setN8nWebhookUrlState(e.target.value)}
            placeholder="https://taxdrop.app.n8n.cloud/webhook/studio-publish"
          />
          <p className="text-xs text-gray" style={{ marginTop: 4 }}>
            Found in your N8N workflow's Webhook node → Production URL
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => {
          setN8nWebhookUrl(n8nWebhookUrlState);
          setN8nSaved(true);
          setTimeout(() => setN8nSaved(false), 2000);
        }}>
          {n8nSaved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>

    {/* Google Search Console */}
    <div className="card mt-lg">
      <div className="card-header">
        <h4>Google Search Console</h4>
      </div>
      <div className="card-body">
        <p className="text-sm text-gray mb-md">
          Connect directly to Google Search Console to view search performance data and content opportunities.
        </p>

        {/* OAuth Credentials Setup */}
        <div className="form-group">
          <label className="form-label">Google OAuth Client ID</label>
          <input
            type="text"
            className="form-input"
            value={gscClientId}
            onChange={e => setGscClientIdState(e.target.value)}
            placeholder="123456789-abcdef.apps.googleusercontent.com"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Google OAuth Client Secret</label>
          <div className="flex gap-sm">
            <input
              type="password"
              className="form-input"
              value={gscClientSecret}
              onChange={e => setGscClientSecretState(e.target.value)}
              placeholder="GOCSPX-..."
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={handleSaveGSCCredentials}
              disabled={!gscClientId.trim()}
            >
              {gscSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-gray" style={{ marginTop: 4 }}>
            Required for web applications. Found in Google Cloud Console alongside Client ID.
          </p>
        </div>

        <div style={{ marginBottom: 16, padding: 12, background: '#F9FAFB', borderRadius: 8, fontSize: 12 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 500 }}>Setup Instructions:</p>
          <ol style={{ margin: 0, paddingLeft: 16 }}>
            <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
            <li>Create a new project or select existing one</li>
            <li>Enable the <strong>"Google Search Console API"</strong> in API Library</li>
            <li>Configure OAuth consent screen (External, add your email as test user)</li>
            <li>Create OAuth 2.0 Client ID → Select <strong>"Web application"</strong></li>
            <li>Add this Authorized redirect URI: <code style={{ background: '#E5E7EB', padding: '2px 6px', borderRadius: 4 }}>{window.location.origin}</code></li>
            <li>Copy both <strong>Client ID</strong> and <strong>Client Secret</strong> and paste above</li>
            <li>Click Save, then Connect Google Account</li>
          </ol>
        </div>

        {gscError && (
          <div style={{ padding: 12, background: '#FEE2E2', borderRadius: 8, color: '#DC2626', fontSize: 13, marginBottom: 16 }}>
            {gscError}
          </div>
        )}

        {!gscConnected ? (
          <button
            className="btn btn-primary"
            onClick={handleConnectGSC}
            disabled={!gscClientId.trim() || !gscClientSecret.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Connect Google Account
          </button>
        ) : (
          <>
            <div style={{ marginBottom: 'var(--spacing-md)', padding: 'var(--spacing-md)', background: 'var(--td-mint)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckIcon style={{ width: 16, height: 16, color: 'var(--td-emerald-dark)' }} />
                <span style={{ fontWeight: 500, color: 'var(--td-emerald-dark)' }}>Connected to Google</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleDisconnectGSC}>
                Disconnect
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Select Site</label>
              {loadingGscSites ? (
                <p className="text-gray">Loading sites...</p>
              ) : gscSites.length === 0 ? (
                <p className="text-gray">No sites found in your Search Console account.</p>
              ) : (
                <select
                  className="form-select"
                  value={gscSiteUrl}
                  onChange={e => setGscSiteUrl(e.target.value)}
                >
                  {gscSites.map(site => (
                    <option key={site.siteUrl} value={site.siteUrl}>
                      {site.siteUrl} ({site.permissionLevel})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button className="btn btn-primary" onClick={handleSaveGSC} disabled={!gscSiteUrl}>
              {gscSaved ? 'Saved!' : 'Save Settings'}
            </button>
          </>
        )}
      </div>
    </div>

    {/* NeuronWriter */}
    <div className="card mt-lg">
      <div className="card-header">
        <h4>NeuronWriter</h4>
      </div>
      <div className="card-body">
        <p className="text-sm text-gray mb-md">
          Connect to NeuronWriter for SEO content optimization and keyword analysis.
        </p>

        <div className="form-group">
          <label className="form-label">NeuronWriter API Key</label>
          <div className="flex gap-sm">
            <input
              type="password"
              className="form-input"
              value={neurowriterApiKey}
              onChange={e => setNeurowriterApiKey(e.target.value)}
              placeholder="Enter your NeuronWriter API key..."
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={handleTestNeurowriter}
              disabled={!neurowriterApiKey || testingNeurowriter}
            >
              {testingNeurowriter ? 'Testing...' : 'Test'}
            </button>
          </div>
          <p className="text-xs text-gray" style={{ marginTop: 4 }}>
            Get your API key from NeuronWriter: Profile → Neuron API Access
          </p>
          {neurowriterTestResult === 'success' && (
            <p className="form-hint" style={{ color: 'var(--td-emerald-light)' }}>
              <CheckIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
              Connected successfully
            </p>
          )}
          {neurowriterTestResult === 'error' && (
            <p className="form-error">Connection failed. Check your API key.</p>
          )}
        </div>

        <button className="btn btn-primary" onClick={handleSaveNeurowriter}>
          {neurowriterSaved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>

    {/* SendFox */}
    <div className="card mt-lg">
      <div className="card-header">
        <h4>SendFox Email Marketing</h4>
      </div>
      <div className="card-body">
        <p className="text-sm text-gray mb-md">
          Connect to SendFox for email marketing. View your lists and copy generated email content for campaigns.
          Get your Personal Access Token at{' '}
          <a href="https://sendfox.com/account/oauth" target="_blank" rel="noopener noreferrer">
            sendfox.com/account/oauth
          </a>
        </p>

        <div className="form-group">
          <label className="form-label">Personal Access Token</label>
          <div className="flex gap-sm">
            <input
              type="password"
              className="form-input"
              value={sendFoxApiKey}
              onChange={e => setSendFoxApiKey(e.target.value)}
              placeholder="Enter your SendFox access token..."
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={handleTestSendFox}
              disabled={!sendFoxApiKey || testingSendFox}
            >
              {testingSendFox ? 'Testing...' : 'Test'}
            </button>
          </div>
          <p className="text-xs text-gray" style={{ marginTop: 4 }}>
            Create a Personal Access Token at SendFox → Account → OAuth
          </p>
          {sendFoxTestResult === 'success' && (
            <p className="form-hint" style={{ color: 'var(--td-emerald-light)' }}>
              <CheckIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
              Connected successfully
            </p>
          )}
          {sendFoxTestResult === 'error' && (
            <p className="form-error">Connection failed. Check your access token.</p>
          )}
        </div>

        <button className="btn btn-primary" onClick={handleSaveSendFox}>
          {sendFoxSaved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>

    {/* Meta / Social Inbox Settings */}
    <div className="card mt-lg">
      <div className="card-header">
        <h4>Meta (Facebook + Instagram) — Social Inbox</h4>
      </div>
      <div className="card-body">
        <p className="text-sm text-gray mb-md">
          Connect to Meta Graph API for the Social Inbox Monitor. Used by the N8N workflow to poll
          comments and DMs from your Facebook Page and Instagram Business account.
        </p>

        <div className="form-group">
          <label className="form-label">Page Access Token</label>
          <input
            type="password"
            className="form-input"
            value={metaPageToken}
            onChange={e => setMetaPageToken(e.target.value)}
            placeholder="EAAxxxxxxx..."
          />
          <p className="text-xs text-gray" style={{ marginTop: 4 }}>
            Generate a long-lived Page Access Token from your{' '}
            <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer">
              Meta Graph API Explorer
            </a>
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Facebook Page ID</label>
          <input
            type="text"
            className="form-input"
            value={metaPageId}
            onChange={e => setMetaPageId(e.target.value)}
            placeholder="123456789012345"
          />
          <p className="text-xs text-gray" style={{ marginTop: 4 }}>
            Found in your Facebook Page Settings &rarr; About
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Instagram Business Account ID</label>
          <input
            type="text"
            className="form-input"
            value={instagramBusinessId}
            onChange={e => setInstagramBusinessId(e.target.value)}
            placeholder="17841400xxxxxxx"
          />
          <p className="text-xs text-gray" style={{ marginTop: 4 }}>
            Query: GET /{'{page-id}'}?fields=instagram_business_account&access_token={'{token}'}
          </p>
        </div>

        <div style={{ marginBottom: 16, padding: 12, background: '#F9FAFB', borderRadius: 8, fontSize: 12 }}>
          <p style={{ margin: '0 0 6px', fontWeight: 500 }}>Required Graph API Permissions:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {['pages_read_engagement', 'pages_manage_posts', 'pages_messaging', 'instagram_basic', 'instagram_manage_comments', 'instagram_manage_messages'].map(p => (
              <code key={p} style={{ background: '#E5E7EB', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{p}</code>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => {
          saveInboxSettings({ metaPageToken, metaPageId, instagramBusinessId });
          setMetaSaved(true);
          setTimeout(() => setMetaSaved(false), 2000);
        }}>
          {metaSaved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
    </>
  );
}
