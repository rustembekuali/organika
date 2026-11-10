import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/ui';
import { MoleculeCanvas, type DrawTool } from '../components/MoleculeCanvas';
import { Molecule3D } from '../components/Molecule3D';
import {
  ELEMENTS, MOLECULE_TEMPLATES, cloneMolecule, emptyMolecule, moleculeFormula, moleculeSvg,
  reactionBalance, subscriptFormula, uid,
  type BondOrder, type ElementSymbol, type SketchMolecule, type SketchReaction,
} from '../lib/molecule';

type Side = 'left' | 'right';
const PROJECTS_KEY = 'organika-sketch-v1';

function readProjects(): SketchReaction[] {
  try {
    const data = JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? '[]');
    return Array.isArray(data) ? data.filter((p) => p && Array.isArray(p.left) && Array.isArray(p.right)) : [];
  } catch { return []; }
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Formula({ molecule }: { molecule: SketchMolecule }) {
  return <span className="sketch-formula">{subscriptFormula(moleculeFormula(molecule))}</span>;
}

export function ConstructorLab() {
  const [left, setLeft] = useState<SketchMolecule[]>(() => [MOLECULE_TEMPLATES.find((t) => t.id === 'ethene')!.make(), MOLECULE_TEMPLATES.find((t) => t.id === 'water')!.make()]);
  const [right, setRight] = useState<SketchMolecule[]>(() => [MOLECULE_TEMPLATES.find((t) => t.id === 'ethanol')!.make()]);
  const [active, setActive] = useState<{ side: Side; id: string }>(() => ({ side: 'left', id: left[0].id }));
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [tool, setTool] = useState<DrawTool>('atom');
  const [element, setElement] = useState<ElementSymbol>('C');
  const [bondOrder, setBondOrder] = useState<BondOrder>(1);
  const [title, setTitle] = useState('Этиленді гидраттау');
  const [condition, setCondition] = useState('H₃PO₄, t°, p');
  const [projectId, setProjectId] = useState(() => uid('project'));
  const [projects, setProjects] = useState<SketchReaction[]>(readProjects);
  const [message, setMessage] = useState('');

  useEffect(() => {
    try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); } catch { setMessage('Браузер жобаны сақтай алмады. JSON арқылы жүктеп ал.'); }
  }, [projects]);

  const list = active.side === 'left' ? left : right;
  const molecule = list.find((m) => m.id === active.id) ?? list[0];
  const balance = useMemo(() => reactionBalance(left, right), [left, right]);

  const updateMolecule = (next: SketchMolecule) => {
    const set = active.side === 'left' ? setLeft : setRight;
    set((items) => items.map((m) => m.id === next.id ? next : m));
  };
  const choose = (side: Side, id: string) => setActive({ side, id });
  const addMolecule = (side: Side) => {
    const m = emptyMolecule(side === 'left' ? 'Жаңа реагент' : 'Жаңа өнім');
    (side === 'left' ? setLeft : setRight)((items) => [...items, m]);
    setActive({ side, id: m.id });
    setMode('2d');
  };
  const removeMolecule = (side: Side, id: string) => {
    const items = side === 'left' ? left : right;
    let next = items.filter((m) => m.id !== id);
    if (!next.length) next = [emptyMolecule(side === 'left' ? 'Жаңа реагент' : 'Жаңа өнім')];
    (side === 'left' ? setLeft : setRight)(next);
    if (active.side === side && active.id === id) setActive({ side, id: next[0].id });
  };
  const applyTemplate = (make: () => SketchMolecule) => {
    if (!molecule) return;
    if (molecule.atoms.length && !window.confirm('Ағымдағы сызбаның орнына шаблонды салу керек пе?')) return;
    const next = { ...make(), id: molecule.id };
    updateMolecule(next);
    setMode('2d');
  };
  const clearCurrent = () => {
    if (!molecule?.atoms.length || window.confirm('Ағымдағы молекуланың барлық атомын өшіру керек пе?')) {
      if (molecule) updateMolecule({ ...molecule, atoms: [], bonds: [] });
    }
  };
  const newReaction = () => {
    if ([...left, ...right].some((m) => m.atoms.length) && !window.confirm('Жаңа реакция бастау керек пе? Ағымдағы сызбаны алдымен сақтап ал.')) return;
    const l = emptyMolecule('Бірінші реагент'), r = emptyMolecule('Бірінші өнім');
    setLeft([l]); setRight([r]); setActive({ side: 'left', id: l.id });
    setTitle('Жаңа реакция'); setCondition(''); setProjectId(uid('project')); setMessage(''); setMode('2d');
  };
  const saveProject = () => {
    if (![...left, ...right].some((m) => m.atoms.length)) { setMessage('Сақтау үшін кемінде бір атом сал.'); return; }
    const project: SketchReaction = { id: projectId, title: title.trim() || 'Атаусыз реакция', condition: condition.trim(), left, right, ts: Date.now() };
    setProjects((items) => [project, ...items.filter((p) => p.id !== project.id)]);
    setMessage(balance.ok ? 'Реакция сақталды. Атомдық баланс дұрыс.' : 'Жоба сақталды. Балансты теңестіруді аяқтау керек.');
  };
  const loadProject = (p: SketchReaction) => {
    const l = p.left.map(cloneMolecule), r = p.right.map(cloneMolecule);
    if (!l.length) l.push(emptyMolecule('Жаңа реагент'));
    if (!r.length) r.push(emptyMolecule('Жаңа өнім'));
    setLeft(l); setRight(r); setActive({ side: 'left', id: l[0].id });
    setTitle(p.title); setCondition(p.condition); setProjectId(p.id); setMessage('Жоба редакторға жүктелді.'); setMode('2d');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const exportProject = () => download(`${title.trim() || 'organika-reaction'}.json`, JSON.stringify({ title, condition, left, right }, null, 2), 'application/json');

  const sideBlock = (side: Side, items: SketchMolecule[]) => (
    <section className="molecule-list" aria-label={side === 'left' ? 'Реагенттер' : 'Өнімдер'}>
      <div className="molecule-list-head"><h3>{side === 'left' ? 'Реагенттер' : 'Өнімдер'}</h3><span>{items.length}</span></div>
      <div className="molecule-items">
        {items.map((m, i) => (
          <div key={m.id} className={'molecule-item' + (active.side === side && active.id === m.id ? ' active' : '')}>
            <button className="molecule-select" onClick={() => choose(side, m.id)} aria-pressed={active.side === side && active.id === m.id}>
              <span className="molecule-index">{i + 1}</span><span><b>{m.name}</b><small>{subscriptFormula(moleculeFormula(m))}</small></span>
            </button>
            <button className="molecule-remove" onClick={() => removeMolecule(side, m.id)} aria-label={`${m.name} — өшіру`}><Icon n="x" size={13} /></button>
          </div>
        ))}
      </div>
      <button className="add-molecule" onClick={() => addMolecule(side)}><Icon n="plus" size={15} />{side === 'left' ? 'Реагент қосу' : 'Өнім қосу'}</button>
    </section>
  );

  return (
    <section className="constructor" aria-label="2D және 3D молекула конструкторы">
      <div className="constructor-heading">
        <div><span className="studio-label">ОРГАНИКА · КОНСТРУКТОР</span><h2>Молекула конструкторы</h2><p>Атомдарды қой, байланыстарды сал — реакцияңды 2D және 3D форматта көр.</p></div>
        <div className="constructor-heading-actions">
          <div className="view-switch" role="group" aria-label="Көрініс режимі">
            <button className={mode === '2d' ? 'on' : ''} aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>2D сызба</button>
            <button className={mode === '3d' ? 'on' : ''} aria-pressed={mode === '3d'} onClick={() => setMode('3d')}>3D модель</button>
          </div>
          <button className="btn ghost" onClick={newReaction}>Жаңа реакция</button>
        </div>
      </div>

      <div className="constructor-grid">
        <aside className="constructor-sidebar">
          {sideBlock('left', left)}
          <div className="reaction-divider"><span>→</span></div>
          {sideBlock('right', right)}
          <section className="template-library">
            <h3>Шаблондар</h3>
            <p>Таңдалған молекуланың орнына салады.</p>
            <div>{MOLECULE_TEMPLATES.map((t) => <button key={t.id} onClick={() => applyTemplate(t.make)}>{t.name}</button>)}</div>
          </section>
        </aside>

        <div className="editor-workbench">
          <div className="editor-titlebar">
            <label><span>{active.side === 'left' ? 'Реагент' : 'Өнім'} атауы</span><input value={molecule?.name ?? ''} onChange={(e) => molecule && updateMolecule({ ...molecule, name: e.target.value })} /></label>
            <span className="editor-formula">{molecule && subscriptFormula(moleculeFormula(molecule))}</span>
          </div>
          {mode === '2d' && (
            <div className="draw-toolbar" aria-label="Сызба құралдары">
              <div className="tool-group" role="group" aria-label="Құрал">
                {([['select', 'Таңдау'], ['atom', 'Атом'], ['bond', 'Байланыс'], ['erase', 'Өшіру']] as [DrawTool, string][]).map(([id, label]) => <button key={id} className={tool === id ? 'on' : ''} aria-pressed={tool === id} onClick={() => setTool(id)}>{label}</button>)}
              </div>
              {tool === 'atom' && <div className="element-tools" role="group" aria-label="Элемент">{ELEMENTS.map((el) => <button key={el} className={element === el ? 'on' : ''} aria-pressed={element === el} onClick={() => setElement(el)}>{el}</button>)}</div>}
              {tool === 'bond' && <div className="tool-group" role="group" aria-label="Байланыс түрі">{([1, 2, 3] as BondOrder[]).map((n) => <button key={n} className={bondOrder === n ? 'on' : ''} aria-pressed={bondOrder === n} onClick={() => setBondOrder(n)}>{n === 1 ? 'Жалғыз' : n === 2 ? 'Қосарлы' : 'Үштік'}</button>)}</div>}
            </div>
          )}
          <div className="canvas-shell">
            {molecule && (mode === '2d' ? <MoleculeCanvas molecule={molecule} onChange={updateMolecule} tool={tool} element={element} bondOrder={bondOrder} /> : <Molecule3D molecule={molecule} />)}
          </div>
          <div className="editor-statusbar">
            <span>{mode === '2d' ? (tool === 'bond' ? 'Байланыс үшін бір атомнан екінші атомға сүйре' : tool === 'atom' ? 'Бос орынды басып, атом қос; атомды бассаң, элементін ауыстырасың' : tool === 'select' ? 'Атомды сүйреп жылжыт; Delete арқылы өшір' : 'Атомды немесе байланысты басып өшір') : '3D геометрия визуалды иллюстрация; нақты кеңістік оптимизациясы емес'}</span>
            <div><button onClick={clearCurrent} disabled={!molecule?.atoms.length}>Тазалау</button><button onClick={() => molecule && download(`${molecule.name || 'molecule'}.svg`, moleculeSvg(molecule), 'image/svg+xml')} disabled={!molecule?.atoms.length}><Icon n="download" size={14} />SVG</button></div>
          </div>
        </div>

        <aside className="reaction-inspector">
          <div className="inspector-head"><span>РЕАКЦИЯ</span><i className={balance.ok ? 'balanced' : ''}>{balance.ok ? 'Теңестірілген' : 'Баланс тексерілуде'}</i></div>
          <div className="reaction-preview">
            <div>{left.filter((m) => m.atoms.length).map((m, i) => <React.Fragment key={m.id}>{i > 0 && <b>+</b>}<Formula molecule={m} /></React.Fragment>)}</div>
            <span className="preview-arrow"><small>{condition || 'шартсыз'}</small>→</span>
            <div>{right.filter((m) => m.atoms.length).map((m, i) => <React.Fragment key={m.id}>{i > 0 && <b>+</b>}<Formula molecule={m} /></React.Fragment>)}</div>
          </div>
          <div className="balance-list">
            {balance.elements.length ? balance.elements.map((el) => <div key={el} className={(balance.left[el] ?? 0) === (balance.right[el] ?? 0) ? 'ok' : 'bad'}><span>{el}</span><b>{balance.left[el] ?? 0}</b><i>:</i><b>{balance.right[el] ?? 0}</b></div>) : <p>Атом қосқанда баланс осында көрінеді.</p>}
          </div>
          <div className="reaction-fields">
            <label>Реакция атауы<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="мысалы: Этиленді гидраттау" /></label>
            <label>Жебенің үстіндегі шарт<input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="мысалы: Ni, t°" /></label>
          </div>
          <button className="btn save-project" onClick={saveProject}><Icon n="check" size={17} />Жобаны сақтау</button>
          <button className="export-project" onClick={exportProject}><Icon n="download" size={15} />JSON ретінде жүктеп алу</button>
          <p className="storage-note">Жобалар тек осы браузерде сақталады.</p>
          {message && <div className="project-message" role="status">{message}</div>}
        </aside>
      </div>

      <section className="saved-projects">
        <div className="saved-head"><div><span>ЖЕКЕ КІТАПХАНА</span><h2>Менің реакцияларым</h2></div><b>{projects.length}</b></div>
        {!projects.length ? <div className="saved-empty">Сақталған жоба әлі жоқ. Жоғарыдағы «Жобаны сақтау» батырмасын бас.</div> : (
          <div className="saved-grid">{projects.map((p) => (
            <article key={p.id} className="saved-card">
              <div><h3>{p.title}</h3><time>{new Date(p.ts).toLocaleDateString('kk-KZ')}</time></div>
              <p>{p.left.map((m) => subscriptFormula(moleculeFormula(m))).join(' + ')} → {p.right.map((m) => subscriptFormula(moleculeFormula(m))).join(' + ')}</p>
              <div><button onClick={() => loadProject(p)}>Редакторда ашу</button><button onClick={() => download(`${p.title}.json`, JSON.stringify(p, null, 2), 'application/json')} aria-label={`${p.title} — JSON жүктеп алу`}><Icon n="download" size={15} /></button><button className="danger-link" onClick={() => { if (window.confirm(`«${p.title}» жобасын өшіру керек пе?`)) setProjects((items) => items.filter((x) => x.id !== p.id)); }}>Өшіру</button></div>
            </article>
          ))}</div>
        )}
      </section>
    </section>
  );
}
