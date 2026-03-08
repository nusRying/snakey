import { fetchArenaPacks, fetchLiveOpsPack } from './LiveOps';

export type BootStepStatus = 'pending' | 'loading' | 'done' | 'failed';

export type BootStep = {
  id: string;
  label: string;
  status: BootStepStatus;
  detail?: string;
};

export type BootState = {
  ready: boolean;
  progress: number;
  steps: BootStep[];
};

const MIN_BOOT_SCREEN_MS = 900;

const INITIAL_STEPS: BootStep[] = [
  { id: 'shell', label: 'Preparing interface shell', status: 'pending' },
  { id: 'logo', label: 'Decoding title art', status: 'pending' },
  { id: 'liveops', label: 'Syncing live broadcast', status: 'pending' },
  { id: 'packs', label: 'Loading arena packs', status: 'pending' },
];

export function createInitialBootState(): BootState {
  return {
    ready: false,
    progress: 0,
    steps: INITIAL_STEPS.map((step) => ({ ...step })),
  };
}

function computeProgress(steps: BootStep[]) {
  if (!steps.length) {
    return 100;
  }

  const completed = steps.filter((step) => step.status === 'done' || step.status === 'failed').length;
  return Math.round((completed / steps.length) * 100);
}

function updateStep(
  currentState: BootState,
  stepId: string,
  patch: Partial<BootStep>,
  ready = false
): BootState {
  const steps = currentState.steps.map((step) =>
    step.id === stepId
      ? {
          ...step,
          ...patch,
        }
      : step
  );

  return {
    ready,
    steps,
    progress: computeProgress(steps),
  };
}

async function waitForFonts() {
  if (typeof document === 'undefined' || !document.fonts?.ready) {
    return;
  }

  await document.fonts.ready;
}

async function preloadLogo() {
  if (typeof window === 'undefined') {
    return;
  }

  await new Promise<void>((resolve) => {
    const img = new Image();
    img.src = '/snakey-logo.svg';

    const finish = () => resolve();
    img.onload = finish;
    img.onerror = finish;

    if (typeof img.decode === 'function') {
      img.decode().then(finish).catch(finish);
    }
  });
}

async function runBootTask(
  stepId: string,
  task: () => Promise<void>,
  getState: () => BootState,
  onUpdate: (nextState: BootState) => void
) {
  onUpdate(updateStep(getState(), stepId, { status: 'loading' }));

  try {
    await task();
    onUpdate(updateStep(getState(), stepId, { status: 'done' }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    onUpdate(updateStep(getState(), stepId, { status: 'failed', detail }));
  }
}

export async function warmAppBoot(onUpdate?: (nextState: BootState) => void) {
  let bootState = createInitialBootState();
  const startedAt = Date.now();
  const emit = (nextState: BootState) => {
    bootState = nextState;
    onUpdate?.(nextState);
  };
  const getState = () => bootState;

  emit(bootState);

  await Promise.all([
    runBootTask(
      'shell',
      async () => {
        await waitForFonts();
      },
      getState,
      emit
    ),
    runBootTask(
      'logo',
      async () => {
        await preloadLogo();
      },
      getState,
      emit
    ),
    runBootTask(
      'liveops',
      async () => {
        await fetchLiveOpsPack();
      },
      getState,
      emit
    ),
    runBootTask(
      'packs',
      async () => {
        await fetchArenaPacks();
      },
      getState,
      emit
    ),
  ]);

  const remainingMs = Math.max(0, MIN_BOOT_SCREEN_MS - (Date.now() - startedAt));
  if (remainingMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
  }

  const readyState = {
    ...getState(),
    ready: true,
    progress: 100,
  };
  emit(readyState);
  return readyState;
}