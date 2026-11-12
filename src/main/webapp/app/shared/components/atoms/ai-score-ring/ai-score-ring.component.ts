import { Component, computed, effect, input, signal } from '@angular/core';

@Component({
  selector: 'jhi-ai-score-ring',
  standalone: true,
  templateUrl: './ai-score-ring.component.html',
})
export class AiScoreRingComponent {
  score = input<number | undefined>(undefined);
  isLoading = input<boolean>(false);

  readonly WARNING_THRESHOLD = 50;
  readonly DANGER_THRESHOLD = 29;
  readonly NORMALIZED_PATH_LENGTH = 100;
  readonly animatedScore = signal<number | undefined>(undefined);

  /** Whether a numeric score is available */
  readonly hasScore = computed(() => this.score() !== undefined);

  readonly boundedScore = computed(() => {
    const value = this.score();
    if (value === undefined || !Number.isFinite(value)) {
      return undefined;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  });

  readonly strokeOffset = computed(() => {
    const score = this.animatedScore();
    return this.NORMALIZED_PATH_LENGTH - (score ?? 0);
  });

  readonly scoreColor = computed(() => {
    const score = this.animatedScore();
    if (score === undefined) {
      return 'var(--color-text-tertiary)';
    }

    if (score <= this.DANGER_THRESHOLD) {
      return 'var(--color-negative-default)';
    }

    if (score <= this.WARNING_THRESHOLD) {
      return 'var(--color-warning-default)';
    }

    return 'var(--color-primary-default)';
  });

  private isFirstRender = true;

  private animationEffect = effect(onCleanup => {
    const targetScore = this.boundedScore();

    if (this.isFirstRender) {
      this.isFirstRender = false;
      this.animatedScore.set(targetScore);
      return;
    }

    if (targetScore === undefined) {
      this.animatedScore.set(undefined);
      return;
    }

    const currentAnimated = this.animatedScore();

    if (currentAnimated === undefined) {
      this.animatedScore.set(targetScore);
      return;
    }

    if (targetScore === currentAnimated) {
      return;
    }
    let currentScore = currentAnimated;
    const step = targetScore > currentScore ? 1 : -1;
    const animate = (): void => {
      currentScore += step;
      this.animatedScore.set(currentScore);

      if (currentScore !== targetScore) {
        frameId = globalThis.requestAnimationFrame(animate);
      }
    };

    let frameId = globalThis.requestAnimationFrame(animate);

    onCleanup(() => {
      globalThis.cancelAnimationFrame(frameId);
    });
  });
}
