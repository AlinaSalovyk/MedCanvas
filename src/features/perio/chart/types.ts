import type { PerioSite, getToothPerio, getPerioSummary } from "@/odontogram";

export type PerioSiteData = ReturnType<typeof getToothPerio>;
export type PerioSummaryData = ReturnType<typeof getPerioSummary>;

export type ToothCellRefs = {
  pd: Partial<Record<PerioSite, HTMLInputElement>>;
  gm: Partial<Record<PerioSite, HTMLInputElement>>;
  bop: Partial<Record<PerioSite, HTMLInputElement>>;
  cal: Partial<Record<PerioSite, HTMLSpanElement>>;
  mobility: HTMLSelectElement | null;
  furcation: Partial<Record<string, HTMLButtonElement>>;
  plaque: Partial<Record<string, HTMLButtonElement>>;
  cejVisibility: HTMLButtonElement | null;
  rootConcavity: HTMLButtonElement | null;
  pi: Partial<Record<string, HTMLButtonElement>>;
  gi: Partial<Record<string, HTMLButtonElement>>;
  kg: HTMLInputElement | null;
  gingivalThickness: HTMLButtonElement | null;
  millerClass: HTMLButtonElement | null;
  mpi: Partial<Record<string, HTMLButtonElement>>;
  mbi: Partial<Record<string, HTMLButtonElement>>;
};

export type GridHandlers = {
  onPd: (toothNo: number, site: PerioSite, raw: string) => void;
  onGm: (toothNo: number, site: PerioSite, raw: string) => void;
  onBop: (toothNo: number, site: PerioSite, checked: boolean) => void;
  onMobility: (toothNo: number, value: string) => void;
  onFurcation: (toothNo: number, entrance: string) => void;
  onPlaque: (toothNo: number, surface: string) => void;
  onCejVisibility: (toothNo: number) => void;
  onRootConcavity: (toothNo: number) => void;
  onPiSurface: (toothNo: number, surface: string) => void;
  onGiSurface: (toothNo: number, surface: string) => void;
  onKg: (toothNo: number, raw: string) => void;
  onGingivalThickness: (toothNo: number) => void;
  onMillerClass: (toothNo: number) => void;
  onMpiSurface: (toothNo: number, surface: string) => void;
  onMbiSurface: (toothNo: number, surface: string) => void;
};

export type BuiltArch = {
  grid: HTMLDivElement;
  buccalCell: HTMLDivElement;
  palatalCell: HTMLDivElement;
};
