import React, { useEffect, useRef, useState } from 'react';
import { ELEMENT_COLORS, moleculeFormula, subscriptFormula, uid, type BondOrder, type ElementSymbol, type SketchAtom, type SketchMolecule } from '../lib/molecule';

export type DrawTool = 'select' | 'atom' | 'bond' | 'erase';

interface Props {
  molecule: SketchMolecule;
  onChange: (molecule: SketchMolecule) => void;
  tool: DrawTool;
  element: ElementSymbol;
  bondOrder: BondOrder;
}

const WIDTH = 720, HEIGHT = 440;

export function MoleculeCanvas({ molecule, onChange, tool, element, bondOrder }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<string | null>(null);
  const bondStart = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bondFrom, setBondFrom] = useState<string | null>(null);

  useEffect(() => { setSelected(null); setBondFrom(null); drag.current = null; bondStart.current = null; }, [molecule.id]);

  const point = (e: React.PointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * WIDTH / rect.width, y: (e.clientY - rect.top) * HEIGHT / rect.height };
  };
  const atomAt = (x: number, y: number) => molecule.atoms.find((a) => Math.hypot(a.x - x, a.y - y) < 30);
  const capture = (e: React.PointerEvent) => { try { svg.current?.setPointerCapture(e.pointerId); } catch { /* ескі браузер */ } };

  const atomDown = (e: React.PointerEvent, atom: SketchAtom) => {
    e.stopPropagation();
    svg.current?.focus();
    if (tool === 'atom') {
      onChange({ ...molecule, atoms: molecule.atoms.map((a) => a.id === atom.id ? { ...a, element } : a) });
      setSelected(atom.id);
    } else if (tool === 'bond') {
      bondStart.current = atom.id;
      setBondFrom(atom.id);
      capture(e);
    } else if (tool === 'erase') {
      onChange({ ...molecule, atoms: molecule.atoms.filter((a) => a.id !== atom.id), bonds: molecule.bonds.filter((b) => b.a !== atom.id && b.b !== atom.id) });
      setSelected(null);
    } else {
      drag.current = atom.id;
      setSelected(atom.id);
      capture(e);
    }
  };

  const pointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    svg.current?.focus();
    const p = point(e);
    if (tool === 'atom') {
      const atom: SketchAtom = { id: uid('a'), element, x: Math.round(p.x / 20) * 20, y: Math.round(p.y / 20) * 20 };
      atom.x = Math.max(24, Math.min(WIDTH - 24, atom.x));
      atom.y = Math.max(52, Math.min(HEIGHT - 24, atom.y));
      onChange({ ...molecule, atoms: [...molecule.atoms, atom] });
      setSelected(atom.id);
    } else if (tool === 'select') setSelected(null);
  };

  const pointerMove = (e: React.PointerEvent) => {
    if (!drag.current || tool !== 'select') return;
    const p = point(e);
    onChange({ ...molecule, atoms: molecule.atoms.map((a) => a.id === drag.current ? { ...a, x: Math.max(24, Math.min(WIDTH - 24, p.x)), y: Math.max(52, Math.min(HEIGHT - 24, p.y)) } : a) });
  };

  const pointerUp = (e: React.PointerEvent) => {
    drag.current = null;
    if (tool === 'bond' && bondStart.current) {
      const p = point(e), target = atomAt(p.x, p.y);
      const from = bondStart.current;
      if (target && target.id !== from) {
        const existing = molecule.bonds.find((b) => (b.a === from && b.b === target.id) || (b.b === from && b.a === target.id));
        onChange({
          ...molecule,
          bonds: existing
            ? molecule.bonds.map((b) => b.id === existing.id ? { ...b, order: bondOrder } : b)
            : [...molecule.bonds, { id: uid('b'), a: from, b: target.id, order: bondOrder }],
        });
      }
    }
    bondStart.current = null;
    setBondFrom(null);
  };

  const bondDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (tool === 'erase') onChange({ ...molecule, bonds: molecule.bonds.filter((b) => b.id !== id) });
    else if (tool === 'bond') onChange({ ...molecule, bonds: molecule.bonds.map((b) => b.id === id ? { ...b, order: bondOrder } : b) });
    else setSelected(id);
  };

  const keyDown = (e: React.KeyboardEvent) => {
    if ((e.key !== 'Delete' && e.key !== 'Backspace') || !selected) return;
    e.preventDefault();
    if (molecule.atoms.some((a) => a.id === selected)) {
      onChange({ ...molecule, atoms: molecule.atoms.filter((a) => a.id !== selected), bonds: molecule.bonds.filter((b) => b.a !== selected && b.b !== selected) });
    } else onChange({ ...molecule, bonds: molecule.bonds.filter((b) => b.id !== selected) });
    setSelected(null);
  };

  const atoms = new Map(molecule.atoms.map((a) => [a.id, a]));
  return (
    <div className={'sketch-canvas tool-' + tool}>
      <svg ref={svg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="application" tabIndex={0}
        aria-label={`${molecule.name}. 2D молекула сызбасы. Атомды өшіру үшін таңдап, Delete пернесін басыңыз.`}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onKeyDown={keyDown}>
        <defs>
          <pattern id={`grid-${molecule.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--sketch-grid)" />
          </pattern>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill={`url(#grid-${molecule.id})`} />
        {molecule.bonds.map((bond) => {
          const a = atoms.get(bond.a), b = atoms.get(bond.b);
          if (!a || !b) return null;
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len;
          const offsets = bond.order === 1 ? [0] : bond.order === 2 ? [-4, 4] : [-6, 0, 6];
          return (
            <g key={bond.id} className={selected === bond.id ? 'sketch-bond selected' : 'sketch-bond'} onPointerDown={(e) => bondDown(e, bond.id)}>
              <line className="bond-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              {offsets.map((o, i) => <line key={i} className="bond-line" x1={a.x + nx * o} y1={a.y + ny * o} x2={b.x + nx * o} y2={b.y + ny * o} />)}
            </g>
          );
        })}
        {molecule.atoms.map((atom) => (
          <g key={atom.id} className={'sketch-atom' + (selected === atom.id || bondFrom === atom.id ? ' selected' : '')} transform={`translate(${atom.x} ${atom.y})`} onPointerDown={(e) => atomDown(e, atom)}>
            <circle className="atom-touch" r="29" />
            <circle className="atom-halo" r="23" />
            <circle className="atom-bg" r="18" />
            <text y="6" textAnchor="middle" fill={ELEMENT_COLORS[atom.element]}>{atom.element}</text>
          </g>
        ))}
        {!molecule.atoms.length && (
          <g className="canvas-empty" pointerEvents="none">
            <text x={WIDTH / 2} y={HEIGHT / 2 - 8} textAnchor="middle">Атом қосу үшін бос орынды бас</text>
            <text x={WIDTH / 2} y={HEIGHT / 2 + 20} textAnchor="middle">немесе сол жақтан дайын шаблонды таңдауға болады</text>
          </g>
        )}
      </svg>
      <div className="canvas-caption"><span>{molecule.name}</span><strong>{subscriptFormula(moleculeFormula(molecule))}</strong></div>
    </div>
  );
}
