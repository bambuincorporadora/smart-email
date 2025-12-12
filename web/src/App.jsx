import { useMemo, useState } from 'react';
import './App.css';
import { loginRequest, msalInstance, msalReady } from './msal';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

const priorityMeta = {
  high: { label: 'Alta', color: '#ff4d6d' },
  medium: { label: 'Media', color: '#f4a261' },
  low: { label: 'Baixa', color: '#4cc9f0' }
};

const sampleEmails = [
  {
    id: 'demo-1',
    priority: 'high',
    senderName: 'Carla (Diretoria)',
    from: 'carla@empresa.com',
    subject: 'Aprovacao de contrato hoje',
    summary: 'Contrato do cliente Atlas precisa da sua assinatura hoje para liberar faturamento.',
    actionNeeded: true,
    suggestedAction: 'Assinar e responder confirmando.',
    implicitDeadline: 'Hoje',
    receivedDateTime: new Date().toISOString(),
    webLink: 'https://outlook.office.com'
  },
  {
    id: 'demo-2',
    priority: 'medium',
    senderName: 'Equipe Produto',
    from: 'produto@empresa.com',
    subject: 'Revisar requisitos sprint',
    summary: 'Precisamos do seu ok nos requisitos da proxima sprint ate amanha cedo.',
    actionNeeded: true,
    suggestedAction: 'Responder com ajustes ou aprovacao.',
    implicitDeadline: 'Amanha',
    receivedDateTime: new Date().toISOString(),
    webLink: 'https://outlook.office.com'
  },
  {
    id: 'demo-3',
    priority: 'low',
    senderName: 'Comunicados',
    from: 'comunicados@empresa.com',
    subject: 'Newsletter semanal',
    summary: 'Resumo de eventos internos e oportunidades.',
    actionNeeded: false,
    suggestedAction: 'Ler se tiver tempo.',
    implicitDeadline: null,
    receivedDateTime: new Date().toISOString(),
    webLink: 'https://outlook.office.com'
  }
];

function Badge({ priority }) {
  const meta = priorityMeta[priority] || priorityMeta.low;
  return (
    <span className="badge" style={{ background: meta.color }}>
      {meta.label}
    </span>
  );
}

function EmailCard({ item }) {
  return (
    <div className="card">
      <div className="card-header">
        <Badge priority={item.priority} />
        <span className="timestamp">
          {new Date(item.receivedDateTime).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
          })}
        </span>
      </div>
      <div className="subject-row">
        <div className="sender">{item.senderName}</div>
        <div className="subject">{item.subject}</div>
      </div>
      <p className="summary">{item.summary}</p>
      <div className="tags">
        {item.actionNeeded && <span className="pill danger">Acao necessaria</span>}
        {item.implicitDeadline && <span className="pill warning">{item.implicitDeadline}</span>}
      </div>
      <div className="actions">
        <a className="link" href={item.webLink} target="_blank" rel="noreferrer">
          Abrir no Outlook ->
        </a>
        <span className="pill ghost">{item.suggestedAction}</span>
      </div>
    </div>
  );
}

function App() {
  const [account, setAccount] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [days, setDays] = useState(2);
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [priority, setPriority] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emails, setEmails] = useState(sampleEmails);

  const filtered = useMemo(() => {
    if (!priority) return emails;
    return emails.filter((e) => e.priority === priority);
  }, [emails, priority]);

  const loginMicrosoft = async () => {
    setError('');
    try {
      if (!msalInstance.getConfiguration().auth.clientId) {
        throw new Error('Configure VITE_AAD_CLIENT_ID para habilitar o login.');
      }
      await msalReady;
      const loginResponse = await msalInstance.loginPopup(loginRequest);
      const activeAccount = loginResponse.account || msalInstance.getAllAccounts()[0];
      setAccount(activeAccount);
      const tokenResponse = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: activeAccount
      });
      setAccessToken(tokenResponse.accessToken);
      await loadEmails(tokenResponse.accessToken);
    } catch (err) {
      setError(`Falha ao autenticar: ${err.message}`);
    }
  };

  const logoutMicrosoft = async () => {
    setError('');
    try {
      const activeAccount = account || msalInstance.getAllAccounts()[0];
      if (activeAccount) {
        await msalInstance.logoutPopup({ account: activeAccount });
      }
    } catch (err) {
      console.warn('Logout falhou', err);
    } finally {
      setAccount(null);
      setAccessToken('');
      setEmails(sampleEmails);
    }
  };

  const loadEmails = async (tokenOverride) => {
    const tokenToUse = tokenOverride || accessToken;
    setError('');
    if (!tokenToUse) {
      setError('Faca login com a Microsoft para obter o token do Graph.');
      return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams({
        days: days.toString(),
        unread: unreadOnly ? 'true' : 'false',
        ...(priority ? { priority } : {})
      });
      const response = await fetch(`${API_BASE}/api/emails?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${tokenToUse}`
        }
      });
      if (!response.ok) {
        throw new Error(`Erro ao buscar e-mails: ${response.status}`);
      }
      const data = await response.json();
      setEmails(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="hero">
        <div>
          <p className="eyebrow">Smart Mail</p>
          <h1>Seus e-mails criticos, priorizados e resumidos.</h1>
          <p className="lede">
            Conecte com o Outlook (Microsoft 365), veja o que importa primeiro, com prioridade,
            resumo e acao sugerida. Configure periodo, VIPs e palavras-chave.
          </p>
          <div className="controls">
            <div className="row">
              <button className="cta" onClick={loginMicrosoft} disabled={loading}>
                {account ? 'Atualizar com minha conta' : 'Login com Microsoft'}
              </button>
              {account && (
                <>
                  <span className="pill ghost">Logado como {account.username}</span>
                  <button className="pill-btn" onClick={logoutMicrosoft}>
                    Sair
                  </button>
                </>
              )}
            </div>
            <div className="row">
              <label className="field small">
                <span>Periodo</span>
                <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  <option value={1}>Hoje</option>
                  <option value={2}>Ultimos 2 dias</option>
                  <option value={7}>Ultimos 7 dias</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                />
                Apenas nao lidos
              </label>
              <div className="pill-group">
                {['', 'high', 'medium', 'low'].map((p) => (
                  <button
                    key={p || 'all'}
                    className={`pill-btn ${priority === p ? 'active' : ''}`}
                    onClick={() => setPriority(p)}
                  >
                    {p ? `Prioridade ${priorityMeta[p].label}` : 'Todas'}
                  </button>
                ))}
              </div>
              <button className="pill-btn" onClick={() => loadEmails()} disabled={loading}>
                {loading ? 'Buscando...' : 'Atualizar lista'}
              </button>
            </div>
            {error && <div className="error">{error}</div>}
          </div>
        </div>
        <div className="hero-card">
          <p className="mini-label">Como funciona</p>
          <ol>
            <li>Registre o app no Azure AD (MSAL) com scopes Mail.Read + offline_access.</li>
            <li>Configure VITE_AAD_CLIENT_ID, VITE_AAD_TENANT_ID e VITE_AAD_REDIRECT_URI.</li>
            <li>Faca login e carregue os e-mails com prioridade e resumo.</li>
          </ol>
          <p className="mini-label">Config (server)</p>
          <code>POST /config</code>
          <p className="mini-label">E-mails (server)</p>
          <code>GET /api/emails</code>
        </div>
      </div>

      <div className="list">
        {filtered.map((email) => (
          <EmailCard key={email.id} item={email} />
        ))}
        {!filtered.length && <div className="empty">Nenhum e-mail com esse filtro.</div>}
      </div>
    </div>
  );
}

export default App;
