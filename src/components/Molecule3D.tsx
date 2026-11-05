import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ELEMENT_COLORS, moleculeFormula, subscriptFormula, type SketchMolecule } from '../lib/molecule';

const RADII: Record<string, number> = { C: .25, H: .17, O: .27, N: .27, S: .3, P: .3, F: .24, Cl: .28, Br: .3, I: .32 };

export function Molecule3D({ molecule }: { molecule: SketchMolecule }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    setError(false);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', `${molecule.name} молекуласының айналдырылатын 3D моделі`);
    renderer.domElement.setAttribute('role', 'img');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
    camera.position.set(0, .25, 6.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.dampingFactor = .08;
    controls.minDistance = 2.5;
    controls.maxDistance = 13;
    controls.enablePan = false;

    scene.add(new THREE.HemisphereLight(0xf4ffe9, 0x26362f, 2.3));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(4, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbce68b, 1.4);
    rim.position.set(-5, -2, -3);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);
    const count = Math.max(1, molecule.atoms.length);
    const cx = molecule.atoms.reduce((s, a) => s + a.x, 0) / count;
    const cy = molecule.atoms.reduce((s, a) => s + a.y, 0) / count;
    const positions = new Map(molecule.atoms.map((a, i) => [a.id, new THREE.Vector3((a.x - cx) / 66, -(a.y - cy) / 66, molecule.atoms.length === 1 ? 0 : Math.sin(i * 2.37) * .32)]));
    const disposables: { dispose: () => void }[] = [];
    const renderAtoms = molecule.atoms.map((atom) => ({ element: atom.element, position: positions.get(atom.id)! }));
    const renderBonds = molecule.bonds.map((bond) => ({ start: positions.get(bond.a)!, end: positions.get(bond.b)!, order: bond.order }));

    // Скелеттік сызбада жазылмайтын H атомдарын 3D бейнеде көрсету.
    const valence: Record<string, number> = { C: 4, O: 2, N: 3, S: 2, P: 3, F: 1, Cl: 1, Br: 1, I: 1 };
    const directions = [new THREE.Vector3(1, 1, 1), new THREE.Vector3(-1, -1, 1), new THREE.Vector3(-1, 1, -1), new THREE.Vector3(1, -1, -1), new THREE.Vector3(0, 1, 0)];
    molecule.atoms.forEach((atom, i) => {
      if (!valence[atom.element]) return;
      const used = molecule.bonds.reduce((sum, bond) => sum + (bond.a === atom.id || bond.b === atom.id ? bond.order : 0), 0);
      const implicit = Math.max(0, valence[atom.element] - used);
      const start = positions.get(atom.id)!;
      for (let h = 0; h < implicit; h++) {
        const direction = directions[h % directions.length].clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), i * .63).normalize();
        const end = start.clone().add(direction.multiplyScalar(.66));
        renderAtoms.push({ element: 'H', position: end });
        renderBonds.push({ start: start.clone(), end, order: 1 });
      }
    });

    for (const bond of renderBonds) {
      const direction = bond.end.clone().sub(bond.start);
      const length = direction.length();
      const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
      const offsets = bond.order === 1 ? [0] : bond.order === 2 ? [-.085, .085] : [-.12, 0, .12];
      for (const offset of offsets) {
        const shift = perpendicular.clone().multiplyScalar(offset);
        const geometry = new THREE.CylinderGeometry(.045, .045, length, 12);
        const material = new THREE.MeshStandardMaterial({ color: 0x819189, roughness: .42, metalness: .08 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(bond.start).add(bond.end).multiplyScalar(.5).add(shift);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
        group.add(mesh);
        disposables.push(geometry, material);
      }
    }

    for (const atom of renderAtoms) {
      const geometry = new THREE.SphereGeometry(RADII[atom.element] ?? .25, 32, 24);
      const material = new THREE.MeshStandardMaterial({ color: ELEMENT_COLORS[atom.element], roughness: .28, metalness: .06 });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(atom.position);
      group.add(sphere);
      disposables.push(geometry, material);
    }

    const size = () => {
      const w = Math.max(1, el.clientWidth), h = Math.max(280, el.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    size();
    const observer = new ResizeObserver(size);
    observer.observe(el);
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [molecule]);

  return (
    <div className="molecule-3d" ref={host}>
      {error && <div className="webgl-error"><b>3D бейне қолжетімсіз</b><span>Браузерде WebGL қосулы екенін тексер. 2D редактор жұмыс істей береді.</span></div>}
      {!molecule.atoms.length && <div className="molecule-3d-empty">Алдымен 2D режимінде атом қос</div>}
      <div className="molecule-3d-hud"><span>{molecule.name}</span><strong>{subscriptFormula(moleculeFormula(molecule))}</strong></div>
      <div className="molecule-3d-help">Айналдыру: сүйреу · Жақындату: дөңгелек</div>
    </div>
  );
}
