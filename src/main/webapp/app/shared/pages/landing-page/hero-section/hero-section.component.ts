import { Component, inject } from '@angular/core';
import { Carousel } from 'primeng/carousel';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { Router } from '@angular/router';

import TranslateDirective from '../../../language/translate.directive';

@Component({
  selector: 'jhi-hero-section',
  standalone: true,
  imports: [Carousel, TranslateModule, TranslateDirective, ButtonComponent],
  templateUrl: './hero-section.component.html',
})
export class HeroSectionComponent {
  imagesWithBackgroundClass = [
    {
      image: 'landing-page-hero-section-1',
      backgroundClass:
        "bg-[url('/content/images/landing-page/hero-section/landing-page-hero-section-1.webp')] bg-cover bg-no-repeat bg-[position:50%_30%] max-lg:bg-center",
      overlayOpacityClass: 'opacity-35',
    },
    {
      image: 'landing-page-hero-section-2',
      backgroundClass:
        "bg-[url('/content/images/landing-page/hero-section/landing-page-hero-section-2.webp')] bg-cover bg-no-repeat bg-[position:50%_17%] max-lg:bg-center",
      overlayOpacityClass: 'opacity-40',
    },
    {
      image: 'landing-page-hero-section-3',
      backgroundClass:
        "bg-[url('/content/images/landing-page/hero-section/landing-page-hero-section-3.webp')] bg-cover bg-no-repeat bg-[position:50%_60%] max-lg:bg-center",
      overlayOpacityClass: 'opacity-40',
    },
  ];

  private router = inject(Router);

  async navigateToPositionsOverview(): Promise<void> {
    await this.router.navigate(['/job-overview']);
  }
}
