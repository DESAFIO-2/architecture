// Tipagem mínima do que o projetor usa do Plotly.
declare module "plotly.js-dist-min" {
  export interface PlotlyHTMLElement extends HTMLElement {
    on(event: "plotly_click", handler: (data: { points: { customdata: number }[] }) => void): void;
    removeAllListeners?(event: string): void;
  }
  export function react(
    root: HTMLElement,
    data: object[],
    layout: object,
    config?: object,
  ): Promise<PlotlyHTMLElement>;
  export function purge(root: HTMLElement): void;
  const Plotly: { react: typeof react; purge: typeof purge };
  export default Plotly;
}
