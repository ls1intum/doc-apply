import { Component, ViewEncapsulation, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  imports: [DatePipe, TranslateDirective, RouterLink],
  encapsulation: ViewEncapsulation.None,
})
export default class FooterComponent {
  readonly version = VERSION;

  protected profileInfo;

  private profileService = inject(ProfileService);

  constructor() {
    this.profileInfo = toSignal(this.profileService.getProfileInfo());
  }

  protected get gitInfo(): GitInfo | undefined {
    const info = this.profileInfo();
    return hasText(info?.ribbonEnv) && info.gitInfo ? info.gitInfo : undefined;
  }
}
