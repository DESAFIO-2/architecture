// Renderização WebGL com three.js. Só desenha e anima; quem decide o quê é a view.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { easeInOutCubic, lerpInto } from "./motion";
import type { Appearance } from "./appearance";

const VERTEX = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  uniform float scale;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    vTint = tint;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0 || vAlpha <= 0.0) discard;
    float edge = smoothstep(1.0, 0.78, r2);
    // Leve volume: centro um pouco mais claro, borda um pouco mais escura.
    vec3 shaded = mix(vTint * 0.78, min(vTint * 1.18, vec3(1.0)), 1.0 - r2);
    gl_FragColor = vec4(shaded, vAlpha * edge);
  }
`;

const HOME = new THREE.Vector3(1.9, 1.15, 2.25);
const FRONT = new THREE.Vector3(0, 0, 3.1);

interface Tween {
  start: number;
  duration: number;
  from: Float32Array;
  to: Float32Array;
}

interface CameraTween {
  start: number;
  duration: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export class ProjectorScene {
  readonly canvas: HTMLCanvasElement;
  /** Chamado a cada quadro, depois de atualizar posições e antes de renderizar. */
  onFrame: (() => void) | null = null;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  private readonly controls: OrbitControls;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly cloud: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly links = new THREE.BufferGeometry();
  private readonly linkMaterial: THREE.LineBasicMaterial;
  private readonly raycaster = new THREE.Raycaster();
  private readonly resize: ResizeObserver;
  private linkPairs: [number, number][] = [];
  private tween: Tween | null = null;
  private cameraTween: CameraTween | null = null;
  private frame = 0;
  private disposed = false;

  constructor(private readonly host: HTMLElement, count: number, linkColor: string) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    host.append(this.canvas);

    this.camera.position.copy(HOME);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotateSpeed = 0.9;
    this.controls.minDistance = 0.35;
    this.controls.maxDistance = 9;

    this.positions = new Float32Array(count * 3);
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("tint", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(new Float32Array(count), 1));
    this.geometry.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { scale: { value: 600 } },
      transparent: true,
      depthWrite: false,
    });
    this.cloud = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.cloud);

    this.linkMaterial = new THREE.LineBasicMaterial({ color: linkColor, transparent: true, opacity: 0.55 });
    this.links.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    this.scene.add(new THREE.LineSegments(this.links, this.linkMaterial));

    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    this.loop();
  }

  setAppearance({ colors, sizes, alphas }: Appearance): void {
    const set = (name: string, data: Float32Array): void => {
      const attribute = this.geometry.getAttribute(name) as THREE.BufferAttribute;
      (attribute.array as Float32Array).set(data);
      attribute.needsUpdate = true;
    };
    set("tint", colors);
    set("size", sizes);
    set("alpha", alphas);
  }

  /** Leva os pontos até `target` em `duration` ms; 0 aplica na hora. */
  moveTo(target: Float32Array, duration: number): void {
    if (duration <= 0) {
      this.positions.set(target);
      this.tween = null;
      this.markMoved();
      return;
    }
    this.tween = { start: performance.now(), duration, from: this.positions.slice(), to: target.slice() };
  }

  setLinks(pairs: [number, number][]): void {
    this.linkPairs = pairs;
    this.links.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pairs.length * 6), 3));
    this.updateLinks();
  }

  setAutoRotate(on: boolean): void {
    this.controls.autoRotate = on;
  }

  /** Vista 2D: câmera de frente e rotação travada. Vista 3D: volta ao ângulo inicial. */
  setFlat(flat: boolean, duration = 700): void {
    this.controls.enableRotate = !flat;
    this.controls.target.set(0, 0, 0);
    this.flyTo(flat ? FRONT : HOME, duration);
  }

  resetCamera(): void {
    this.controls.target.set(0, 0, 0);
    this.flyTo(this.controls.enableRotate ? HOME : FRONT, 600);
  }

  pick(clientX: number, clientY: number, sizes: Float32Array): number | null {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const distance = this.camera.position.distanceTo(this.controls.target);
    this.raycaster.params.Points = { threshold: 0.012 * distance };
    this.raycaster.setFromCamera(pointer, this.camera);
    const hits = this.raycaster
      .intersectObject(this.cloud)
      .filter((hit) => hit.index !== undefined && (sizes[hit.index] ?? 0) > 0)
      .sort((a, b) => (a.distanceToRay ?? 0) - (b.distanceToRay ?? 0));
    return hits[0]?.index ?? null;
  }

  project(index: number): ScreenPoint {
    const v = new THREE.Vector3(
      this.positions[index * 3], this.positions[index * 3 + 1], this.positions[index * 3 + 2],
    ).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((v.x + 1) / 2) * rect.width,
      y: ((1 - v.y) / 2) * rect.height,
      visible: v.z > -1 && v.z < 1,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.controls.dispose();
    this.geometry.dispose();
    this.links.dispose();
    this.material.dispose();
    this.linkMaterial.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }

  private flyTo(to: THREE.Vector3, duration: number): void {
    this.cameraTween = { start: performance.now(), duration, from: this.camera.position.clone(), to: to.clone() };
  }

  private fit(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // Tamanho em pixels de um objeto de 1 unidade a 1 unidade de distância.
    const pixelRatio = this.renderer.getPixelRatio();
    this.material.uniforms["scale"]!.value =
      (height * pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
  }

  private markMoved(): void {
    (this.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    this.updateLinks();
  }

  private updateLinks(): void {
    const attribute = this.links.getAttribute("position") as THREE.BufferAttribute;
    const out = attribute.array as Float32Array;
    this.linkPairs.forEach(([a, b], k) => {
      out.set(this.positions.subarray(a * 3, a * 3 + 3), k * 6);
      out.set(this.positions.subarray(b * 3, b * 3 + 3), k * 6 + 3);
    });
    attribute.needsUpdate = true;
  }

  private loop = (): void => {
    if (this.disposed) return;
    if (!this.host.isConnected) {
      this.dispose();
      return;
    }
    const now = performance.now();
    if (this.tween) {
      const t = easeInOutCubic((now - this.tween.start) / this.tween.duration);
      lerpInto(this.positions, this.tween.from, this.tween.to, t);
      this.markMoved();
      if (t >= 1) this.tween = null;
    }
    if (this.cameraTween) {
      const t = easeInOutCubic((now - this.cameraTween.start) / this.cameraTween.duration);
      this.camera.position.lerpVectors(this.cameraTween.from, this.cameraTween.to, t);
      if (t >= 1) this.cameraTween = null;
    }
    this.controls.update();
    this.onFrame?.();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.loop);
  };
}
