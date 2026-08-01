import { Component, ViewEncapsulation, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { VERSION } from 'app/app.constants';
import { hasText } from 'app/shared/util/text.util';

import TranslateDirective from '../../shared/language/translate.directive';
import { ProfileService } from '../profiles/profile.service';
import { GitInfo } from '../profiles/profile-info.model';

@Component({
  selector: 'jhi-footer',
  standalone: true,
  templateUrl: './footer.component.html',
  imports: [DatePipe, TranslateDirective],
  encapsulation: ViewEncapsulation.None,
})
export default class FooterComponent {
  version: string;

  protected profileInfo;

  private router = inject(Router);
  private profileService = inject(ProfileService);

  constructor() {
    this.version = VERSION;
    this.profileInfo = toSignal(this.profileService.getProfileInfo());
  }

  navigateToImprint(): void {
    void this.router.navigate(['/imprint']);
  }

  navigateToPrivacy(): void {
    void this.router.navigate(['/privacy']);
  }

  navigateToAboutUs(): void {
    void this.router.navigate(['/about-us']);
  }

  protected get gitInfo(): GitInfo | undefined {
    const info = this.profileInfo();
    return hasText(info?.ribbonEnv) && info.gitInfo ? info.gitInfo : undefined;
  }
}
