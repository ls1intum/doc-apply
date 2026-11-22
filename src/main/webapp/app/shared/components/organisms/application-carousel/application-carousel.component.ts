import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  ViewEncapsulation,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ApplicationEvaluationDetailDTO } from 'app/generated/model/application-evaluation-detail-dto';

import { ApplicationCardComponent } from '../../molecules/application-card/application-card.component';
import { ButtonComponent } from '../../atoms/button/button.component';
import TranslateDirective from '../../../language/translate.directive';
import { BREAKPOINTS } from '../../../constants/breakpoints';

const VISIBLE_DESKTOP = 3;

@Component({
  selector: 'jhi-application-carousel',
  imports: [ApplicationCardComponent, FontAwesomeModule, ButtonComponent, TranslateDirective],
  templateUrl: './application-carousel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    tabindex: '0',
    role: 'region',
    'aria-roledescription': 'carousel',
    'aria-label': 'Applications carousel',
  },
})
export class ApplicationCarouselComponent {
  totalRecords = input(0);
  currentIndex = input(0);
  carouselIndex = input(0);
  applications = input.required<ApplicationEvaluationDetailDTO[]>();
  carouselSize = input.required<number>();
  cardsVisible = signal(VISIBLE_DESKTOP);

  next = output();
  prev = output();

  isStart = computed(() => this.currentIndex() === 0);
  isEnd = computed(() => this.currentIndex() === this.totalRecords() - 1 || this.totalRecords() === 0);

  readonly visibleApplications = computed(() => {
    const apps: ApplicationEvaluationDetailDTO[] = this.applications();
    const size = this.cardsVisible();
    const half = Math.floor(size / 2);
    const result: (ApplicationEvaluationDetailDTO | undefined)[] = [];

    for (let offset = -half; offset <= half; offset++) {
      const index = this.carouselIndex() + offset;
      const item = index >= 0 && index < this.carouselSize() ? apps.at(index) : undefined;
      result.push(item);
    }

    return result;
  });

  readonly middle = computed(() => Math.floor(this.cardsVisible() / 2));

  private readonly updateCardsEffect = effect(() => {
    this.updateVisibleCards();
  });

  private resizeHandlerBound = this.resizeHandler.bind(this);

  constructor() {
    window.addEventListener('resize', this.resizeHandlerBound);
  }

  @HostListener('document:keydown', ['$event'])
  handleGlobalKeyDown(event: KeyboardEvent): void {
    // 1. Standard Guard Clauses
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    // 2. Focus Guard
    const active = document.activeElement as HTMLElement | null;
    if (active) {
      const isEditable = ['INPUT', 'TEXTAREA'].includes(active.tagName) || active.isContentEditable;
      const isInsideEditable = !!active.closest('[contenteditable="true"]');

      if (isEditable || isInsideEditable) {
        return;
      }
    }

    // 3. Navigation Logic
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        this.loadNext();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.loadPrev();
        break;
    }
  }

  loadNext(): void {
    this.next.emit();
  }

  loadPrev(): void {
    this.prev.emit();
  }

  private updateVisibleCards(): void {
    const container = document.querySelector('.page-container') ?? document.querySelector('main') ?? document.querySelector('.content');

    const width = container?.clientWidth ?? window.innerWidth;

    if (width < BREAKPOINTS.md) {
      this.cardsVisible.set(1);
    } else if (width < BREAKPOINTS.smallDesktop) {
      this.cardsVisible.set(2);
    } else if (width < BREAKPOINTS.xl) {
      this.cardsVisible.set(3);
    } else if (width < BREAKPOINTS.ultraWide) {
      this.cardsVisible.set(5);
    } else {
      this.cardsVisible.set(6);
    }
  }

  private resizeHandler(): void {
    this.updateVisibleCards();
  }
}
