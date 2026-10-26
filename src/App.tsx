import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertCircle,
  ArrowUpRight,
  BookText,
  Check,
  Database,
  Download,
  FileText,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { auth, configured, db } from './firebase';
import type { ContentForm, ContentItem, Topic } from './types';
import { validateContent } from './types';

type Page = 'content' | 'topics';
type Modal = 'new-item' | 'edit-item' | 'new-topic' | null;

function explainError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e.code === 'permission-denied') return '資料庫拒絕操作：請檢查管理員權限與 Firestore Security Rules。';
  if (e.code === 'auth/invalid-credential') return '帳號或密碼不正確。';
  if (e.code === 'auth/too-many-requests') return '登入嘗試過多，請稍後重試。';
  if (e.code === 'unavailable') return '目前無法連接 Firestore，請檢查網路狀態。';
  return e.message ?? '發生未知錯誤。';
}

function formatTime(timestamp: ContentItem['updatedAt']): string {
  try {
    return timestamp?.toDate?.().toLocaleString('zh-TW', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }) ?? '—';
  } catch {
    return '—';
  }
}

function downloadTopicJSON(topicId: string, items: ContentItem[]) {
  const exportItems = items
    .filter((item) => item.topicId === topicId && item.isActive)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, text, sizeLevel, baseWeight }) => ({ id, text, sizeLevel, baseWeight }));

  const payload = {
    schemaVersion: 1,
    topicId,
    generatedAt: new Date().toISOString(),
    items: exportItems,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `toasteism-${topicId}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return exportItems.length;
}

function Login({ onMessage }: { onMessage: (s: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      onMessage('已登入，正在驗證管理員權限。');
    } catch (err) {
      setError(explainError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-screen">
      <div className="auth-pattern" aria-hidden="true" />
      <div className="auth-card">
        <div className="brand-symbol"><Layers3 size={25} strokeWidth={2.5} /></div>
        <div className="eyebrow">TOASTEISM / BACKOFFICE</div>
        <h1>資訊的形狀，<br /><span>由你來整理。</span></h1>
        <p className="auth-description">內容管理系統 v1.0<br />登入後可以管理議題、關鍵字、字級與人工權重。</p>
        <form onSubmit={login} className="auth-form">
          <label>管理員 Email<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="team@example.com" /></label>
          <label>密碼<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
          {error && <div className="inline-error"><AlertCircle size={16}/>{error}</div>}
          <button className="btn btn-primary btn-wide" disabled={busy} type="submit">
            {busy ? <LoaderCircle className="spin" size={17} /> : <LockKeyhole size={17} />} 登入管理平台
          </button>
        </form>
        <div className="auth-footnote">只開放已列入 Firestore <code>admins</code> 的帳號。</div>
      </div>
    </div>
  );
}

function ContentModal({
  kind, original, topics, selectedTopic, onClose, onSaved,
}: {
  kind: 'new-item' | 'edit-item'; original: ContentItem | null; topics: Topic[];
  selectedTopic: string; onClose: () => void; onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<ContentForm>({
    topicId: original?.topicId ?? (topics.some((t) => t.id === selectedTopic) ? selectedTopic : topics[0]?.id ?? ''),
    text: original?.text ?? '',
    sizeLevel: String(original?.sizeLevel ?? 2) as ContentForm['sizeLevel'],
    baseWeight: String(original?.baseWeight ?? 0.5),
    isActive: original?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validateContent(form, topics);
    if (message) { setError(message); return; }
    setBusy(true);
    setError('');
    const data = {
      topicId: form.topicId,
      text: form.text.trim(),
      sizeLevel: Number(form.sizeLevel),
      baseWeight: Number(form.baseWeight),
      isActive: form.isActive,
      updatedAt: serverTimestamp(),
    };
    try {
      if (kind === 'edit-item' && original) {
        await updateDoc(doc(db, 'contentItems', original.id), data);
      } else {
        await addDoc(collection(db, 'contentItems'), { ...data, createdAt: serverTimestamp() });
      }
      onSaved(kind === 'edit-item' ? '資訊已更新。' : '資訊已新增。');
    } catch (err) { setError(explainError(err)); }
    finally { setBusy(false); }
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={kind === 'new-item' ? '新增資訊' : '編輯資訊'}>
        <div className="modal-header">
          <div><div className="eyebrow">CONTENT ITEM</div><h2>{kind === 'new-item' ? '新增資訊內容' : '編輯資訊內容'}</h2></div>
          <button className="icon-button" type="button" aria-label="關閉" onClick={onClose} disabled={busy}><X size={19}/></button>
        </div>
        <form onSubmit={submit} className="editor-form">
          <label>所屬議題
            <select value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })} required>
              {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
            </select>
          </label>
          <label>文字內容 <span className="field-hint">一組可完整理解、可獨立撕取的資訊</span>
            <textarea required maxLength={120} rows={3} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="例如：店家可以減少設計支出" />
            <span className="char-count">{form.text.length} / 120</span>
          </label>
          <div className="two-col">
            <label>文字大小等級
              <select value={form.sizeLevel} onChange={(e) => setForm({ ...form, sizeLevel: e.target.value as ContentForm['sizeLevel'] })}>
                <option value="1">1 — 小</option><option value="2">2 — 中</option><option value="3">3 — 大</option>
              </select>
            </label>
            <label>人工初始權重
              <input type="number" min="0" max="1" step="any" value={form.baseWeight}
                onChange={(e) => setForm({ ...form, baseWeight: e.target.value })} required />
            </label>
          </div>
          <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}/><span>啟用此筆資料 <small>啟用後才會出現在 TD JSON 匯出中</small></span></label>
          {error && <div className="inline-error"><AlertCircle size={16}/>{error}</div>}
          <div className="modal-actions"><button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>取消</button><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} 儲存資料</button></div>
        </form>
      </div>
    </div>
  );
}

function TopicModal({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const [topicId, setTopicId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = topicId.trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) { setError('議題 ID 僅可使用小寫英文、數字與中間連字號。'); return; }
    if (!name.trim() || name.trim().length > 60) { setError('議題名稱須為 1 至 60 字。'); return; }
    setBusy(true);
    setError('');
    try {
      const ref = doc(db, 'topics', slug);
      if ((await getDoc(ref)).exists()) { setError('此議題 ID 已存在，請使用其他 ID。'); return; }
      await setDoc(ref, { name: name.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      onSaved('新議題已建立。');
    } catch (err) { setError(explainError(err)); }
    finally { setBusy(false); }
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal compact" role="dialog" aria-modal="true" aria-label="新增議題">
        <div className="modal-header"><div><div className="eyebrow">NEW TOPIC</div><h2>新增議題</h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="關閉"><X size={19}/></button></div>
        <form onSubmit={submit} className="editor-form">
          <label>議題名稱<input placeholder="例如：AI 菜單" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required /></label>
          <label>固定議題 ID <span className="field-hint">建立後不修改，避免 TD 對應中斷</span><input placeholder="例如：ai-menu" value={topicId} onChange={(e) => setTopicId(e.target.value)} required /></label>
          {error && <div className="inline-error"><AlertCircle size={16}/>{error}</div>}
          <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>取消</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Plus size={16}/>} 建立議題</button></div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [page, setPage] = useState<Page>('content');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notification, setNotification] = useState('');
  const [dataError, setDataError] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!configured) return;
    let disposed = false;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (disposed) return;
      setUser(nextUser);
      setIsAdmin(null);
      setAuthError('');
      if (!nextUser) { setIsAdmin(false); return; }
      try {
        const adminDoc = await getDoc(doc(db, 'admins', nextUser.uid));
        if (!disposed) setIsAdmin(adminDoc.exists() && adminDoc.data()?.enabled === true);
      } catch (err) {
        if (!disposed) { setIsAdmin(false); setAuthError(explainError(err)); }
      }
    }, (err) => { if (!disposed) setAuthError(explainError(err)); });
    return () => { disposed = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!isAdmin || !user) return;
    setLoadingData(true);
    const unsubscribeTopics = onSnapshot(collection(db, 'topics'),
      (snapshot) => setTopics(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Topic)).sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))),
      (err) => setDataError(explainError(err)));
    const unsubscribeItems = onSnapshot(collection(db, 'contentItems'),
      (snapshot) => { setItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ContentItem))); setLoadingData(false); },
      (err) => { setDataError(explainError(err)); setLoadingData(false); });
    return () => { unsubscribeTopics(); unsubscribeItems(); };
  }, [isAdmin, user]);

  const visibleItems = useMemo(() => items.filter((item) =>
    (selectedTopic === 'all' || item.topicId === selectedTopic)
    && (showInactive || item.isActive)
    && (item.text.toLowerCase().includes(search.trim().toLowerCase()) || item.id.includes(search.trim()))
  ).sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)),
  [items, search, selectedTopic, showInactive]);

  const activeCount = items.filter((item) => item.isActive).length;
  const selectedName = topics.find((topic) => topic.id === selectedTopic)?.name ?? '';
  function saved(message: string) { setModal(null); setEditing(null); setNotification(message); }
  async function remove(item: ContentItem) {
    if (!window.confirm(`確定永久刪除「${item.text}」？\n刪除後無法從網站還原。`)) return;
    setBusyId(item.id);
    try { await deleteDoc(doc(db, 'contentItems', item.id)); setNotification('資料已刪除。'); }
    catch (err) { setDataError(explainError(err)); }
    finally { setBusyId(null); }
  }
  async function toggle(item: ContentItem) {
    setBusyId(item.id);
    try { await updateDoc(doc(db, 'contentItems', item.id), { isActive: !item.isActive, updatedAt: serverTimestamp() }); }
    catch (err) { setDataError(explainError(err)); }
    finally { setBusyId(null); }
  }
  async function renameTopic(topic: Topic) {
    const nextName = window.prompt('輸入新的議題名稱（ID 不會改變）', topic.name);
    if (nextName === null || nextName.trim() === topic.name) return;
    if (!nextName.trim() || nextName.trim().length > 60) { setDataError('名稱必須在 1 到 60 字之間。'); return; }
    setBusyId(topic.id);
    try { await updateDoc(doc(db, 'topics', topic.id), { name: nextName.trim(), updatedAt: serverTimestamp() }); setNotification('議題名稱已更新。'); }
    catch (err) { setDataError(explainError(err)); }
    finally { setBusyId(null); }
  }

  if (!configured) return (
    <div className="setup-screen"><div className="setup-card"><Database size={32}/><h1>先設定 Firebase 連線</h1>
      <p>請將專案內的 <code>.env.example</code> 複製成 <code>.env</code>，填入 Firebase Web App 設定，然後重新啟動網站。</p><p>詳細操作請見下載包中的 <code>README.md</code>。</p></div></div>
  );
  if (user === undefined) return <div className="loading-screen"><LoaderCircle className="spin" size={27}/><p>載入管理平台中…</p></div>;
  if (!user) return <Login onMessage={setNotification} />;
  if (isAdmin === null) return <div className="loading-screen"><LoaderCircle className="spin" size={27}/><p>驗證管理員權限中…</p></div>;
  if (!isAdmin) return <div className="setup-screen"><div className="setup-card"><LockKeyhole size={30}/><h1>尚未獲得管理權限</h1><p>目前登入帳號：<strong>{user.email}</strong></p><p>請到 Firestore 建立 <code>admins/{user.uid}</code>，並設定 <code>enabled: true</code>。{authError}</p><button className="btn btn-ghost" onClick={() => signOut(auth)}>切換帳號</button></div></div>;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header"><div className="brand-symbol small"><Layers3 size={20}/></div><div><div className="brand-title">TOASTEISM</div><div className="brand-subtitle">Words Database</div></div></div>
        <div className="sidebar-section">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="主要導覽">
          <button className={`nav-item ${page === 'content' ? 'active' : ''}`} onClick={() => setPage('content')}><BookText size={18}/> 資訊內容 <span>{items.length}</span></button>
          <button className={`nav-item ${page === 'topics' ? 'active' : ''}`} onClick={() => setPage('topics')}><Layers3 size={18}/> 議題管理 <span>{topics.length}</span></button>
        </nav>
        <div className="sidebar-section second">TOPICS</div>
        <div className="topic-nav">
          {topics.length === 0 ? <p className="muted-sidebar">尚未建立議題</p> : topics.map((topic) => (
            <button key={topic.id} onClick={() => { setSelectedTopic(topic.id); setPage('content'); }} className={`topic-shortcut ${page === 'content' && selectedTopic === topic.id ? 'selected' : ''}`}>
              <span className="topic-dot"/>{topic.name}<span className="tiny-count">{items.filter((item) => item.topicId === topic.id).length}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom"><div className="signed-in"><span className="user-avatar">{(user.email ?? 'A').charAt(0).toUpperCase()}</span><div><strong>管理員</strong><small title={user.email ?? ''}>{user.email}</small></div></div><button className="signout" onClick={() => signOut(auth)} title="登出"><LogOut size={18}/></button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">WORKSPACE <span>/</span> {page === 'content' ? 'CONTENT ITEMS' : 'TOPIC SETTINGS'}</div><div className="topbar-right"><span className="status-dot"/> FIRESTORE CONNECTED <span className="header-version">v1.0</span></div></header>
        <div className="content-wrap">
          {notification && <div className="notice success" role="status"><Check size={17}/>{notification}<button aria-label="關閉通知" onClick={() => setNotification('')}><X size={17}/></button></div>}
          {dataError && <div className="notice error" role="alert"><AlertCircle size={17}/>{dataError}<button aria-label="關閉通知" onClick={() => setDataError('')}><X size={17}/></button></div>}
          <div className="page-intro"><div><div className="eyebrow dark">CONTENT MANAGEMENT SYSTEM</div><h1>{page === 'content' ? '資訊內容管理' : '議題設定'}</h1><p>{page === 'content' ? '建立、編輯與整理吐司上的資訊片段。' : '維護資訊所屬的議題分類與固定識別碼。'}</p></div>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setModal(page === 'content' ? 'new-item' : 'new-topic'); }} disabled={page === 'content' && topics.length === 0}><Plus size={17}/>{page === 'content' ? '新增資訊' : '新增議題'}</button></div>

          {page === 'content' ? (
            <>
              <div className="stats-grid">
                <div className="stat-card"><span>資訊總數</span><strong>{items.length}</strong><small>資料庫中的所有資訊</small></div>
                <div className="stat-card"><span>已啟用</span><strong>{activeCount}</strong><small>可輸出至 TouchDesigner</small></div>
                <div className="stat-card"><span>議題數量</span><strong>{topics.length}</strong><small>已建立的分類</small></div>
              </div>
              <section className="data-panel"><div className="panel-header"><div><h2>資訊清單</h2><p>每一筆代表一組可獨立呈現的文字內容</p></div><span className="panel-count">{visibleItems.length} 筆</span></div>
                <div className="filters"><div className="search-control"><Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋文字內容或 ID…" aria-label="搜尋資訊" /></div>
                  <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} aria-label="選擇議題"><option value="all">全部議題</option>{topics.map((topic) => <option value={topic.id} key={topic.id}>{topic.name}</option>)}</select>
                  <label className="simple-checkbox"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}/> 包含停用</label>
                </div>
                <div className="table-scroll"><table className="content-table"><thead><tr><th>資訊文字</th><th>議題</th><th>字級</th><th>人工權重</th><th>狀態</th><th>更新時間</th><th className="align-right">操作</th></tr></thead>
                  <tbody>{visibleItems.map((item) => (<tr key={item.id}><td><div className="item-primary">{item.text}</div><div className="item-id" title={item.id}>#{item.id.slice(0, 12)}</div></td><td><span className="topic-pill">{topics.find((topic) => topic.id === item.topicId)?.name ?? item.topicId}</span></td><td><span className="number-cell">{item.sizeLevel}</span></td><td><span className="weight-value">{item.baseWeight.toFixed(2)}</span><div className="weight-track"><span style={{width: `${item.baseWeight * 100}%`}}/></div></td><td><button className={`state-pill ${item.isActive ? 'enabled' : 'disabled'}`} disabled={busyId === item.id} title="點擊切換啟用狀態" onClick={() => toggle(item)}>{item.isActive ? '啟用中' : '已停用'}</button></td><td className="date-cell">{formatTime(item.updatedAt)}</td><td><div className="row-actions"><button className="icon-button" title="編輯" aria-label={`編輯 ${item.text}`} onClick={() => { setEditing(item); setModal('edit-item'); }}><Pencil size={17}/></button><button className="icon-button danger" title="刪除" aria-label={`刪除 ${item.text}`} disabled={busyId === item.id} onClick={() => remove(item)}><Trash2 size={17}/></button></div></td></tr>))}
                    {visibleItems.length === 0 && <tr><td colSpan={7}><div className="empty-state"><FileText size={26}/><strong>{loadingData ? '正在讀取…' : '目前沒有符合條件的資料'}</strong><span>請建立議題並新增第一組資訊，或調整篩選條件。</span></div></td></tr>}
                  </tbody></table></div>
              </section>
              <section className="export-panel"><div className="export-icon"><Download size={20}/></div><div><h3>TouchDesigner 資料交付</h3><p>選定一個議題，匯出該議題所有「已啟用」的資訊。匯出內容包含 ID、文字、字級、初始權重。</p><small>{selectedTopic === 'all' ? '請先在上方選擇單一議題' : `目前選擇：${selectedName} · ${items.filter((item) => item.topicId === selectedTopic && item.isActive).length} 筆可匯出`}</small></div>
                <button className="btn btn-outline" disabled={selectedTopic === 'all'} onClick={() => { const count = downloadTopicJSON(selectedTopic, items); setNotification(`已匯出 ${selectedName} 的 ${count} 筆已啟用資訊。`); }}><Download size={17}/> 匯出 JSON</button></section>
            </>
          ) : (
            <><section className="data-panel topic-panel"><div className="panel-header"><div><h2>議題清單</h2><p>議題 ID 建立後固定不變，避免 TD 資料對應中斷。</p></div><span className="panel-count">{topics.length} 個議題</span></div>
              {topics.length === 0 ? <div className="empty-state"><Layers3 size={28}/><strong>還沒有議題</strong><span>先建立一個議題，再新增吐司資訊。</span></div> : <div className="topic-cards">{topics.map((topic) => <div className="topic-card" key={topic.id}><div className="topic-card-icon"><Layers3 size={19}/></div><div className="topic-card-text"><h3>{topic.name}</h3><code>{topic.id}</code><p>{items.filter((item) => item.topicId === topic.id).length} 筆資訊</p></div><button className="icon-button" disabled={busyId === topic.id} onClick={() => renameTopic(topic)} title="修改議題名稱"><Pencil size={18}/></button><button className="btn btn-text" onClick={() => { setPage('content'); setSelectedTopic(topic.id); }}>查看 <ArrowUpRight size={15}/></button></div>)}</div>}
              </section><div className="guidance"><AlertCircle size={19}/><div><strong>為什麼不能在網站直接刪除議題？</strong><p>避免該議題下的資訊變成無法追溯的孤兒資料。需要刪除時，請先備份並規劃資料遷移。</p></div></div></>
          )}
          <footer className="footer"><span>TOASTEISM © 2026 — CONTENT STUDIO</span><span>Manual weight · No automatic audience feedback</span></footer>
        </div>
      </main>
      {(modal === 'new-item' || modal === 'edit-item') && <ContentModal key={`${modal}-${editing?.id ?? ''}`} kind={modal} original={editing} topics={topics} selectedTopic={selectedTopic} onClose={() => setModal(null)} onSaved={saved}/>}
      {modal === 'new-topic' && <TopicModal onClose={() => setModal(null)} onSaved={saved} />}
    </div>
  );
}
