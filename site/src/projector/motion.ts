// Matemática das animações, sem three.js e sem DOM: tudo aqui é testável.

/** Suaviza o começo e o fim de uma transição (0 → 1). */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Interpola dois quadros achatados para dentro de `out`. */
export function lerpInto(out: Float32Array, from: ArrayLike<number>, to: ArrayLike<number>, t: number): Float32Array {
  for (let i = 0; i < out.length; i++) {
    const a = from[i] ?? 0;
    out[i] = a + ((to[i] ?? 0) - a) * t;
  }
  return out;
}

/**
 * Posição numa sequência de quadros para um progresso de 0 a 1.
 * Interpola entre quadros vizinhos para o replay da otimização ficar contínuo.
 */
export function frameAt(out: Float32Array, frames: ArrayLike<number>[], progress: number): Float32Array {
  if (frames.length === 0) return out;
  const last = frames.length - 1;
  const position = Math.min(1, Math.max(0, progress)) * last;
  const index = Math.min(last, Math.floor(position));
  const next = Math.min(last, index + 1);
  return lerpInto(out, frames[index] as ArrayLike<number>, frames[next] as ArrayLike<number>, position - index);
}

/** Iteração do t-SNE correspondente ao progresso do replay (para o contador na tela). */
export function iterationAt(iterations: number[], progress: number): number {
  if (iterations.length === 0) return 0;
  const last = iterations.length - 1;
  const position = Math.min(1, Math.max(0, progress)) * last;
  const index = Math.floor(position);
  const a = iterations[index] ?? 0;
  const b = iterations[Math.min(last, index + 1)] ?? a;
  return Math.round(a + (b - a) * (position - index));
}

/** Achata o eixo Z para a vista 2D, mantendo X e Y. */
export function flatten(frame: ArrayLike<number>): Float32Array {
  const out = Float32Array.from(frame);
  for (let i = 2; i < out.length; i += 3) out[i] = 0;
  return out;
}
