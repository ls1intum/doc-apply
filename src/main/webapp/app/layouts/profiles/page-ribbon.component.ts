import { Component, OnInit, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';
import { TranslateDirective } from 'app/shared/language';

import { ProfileService } from './profile.service';

@Component({
  selector: 'jhi-page-ribbon',
  imports: [AsyncPipe, TranslateDirective],
  template: `
    @if (ribbonEnv$ | async; as ribbonEnv) {
      <div
        class="absolute top-[40px] w-[15em] z-[9999] overflow-hidden whitespace-nowrap pointer-events-none opacity-75 bg-[rgba(170,0,0,0.5)]"
      >
        <a
          href=""
          class="block my-px py-[10px] px-[50px] text-center text-white font-normal no-underline pointer-events-none [text-shadow:0_0_5px_#444]"
          [jhiTranslate]="'global.ribbon.' + (ribbonEnv ?? '')"
          >{{
            {
              dev: 'Development',
              'test-server': 'Test Server',
            }[ribbonEnv ?? '']
          }}</a
        >
      </div>
    }
  `,
})
export default class PageRibbonComponent implements OnInit {
  ribbonEnv$?: Observable<string | undefined>;

  private readonly profileService = inject(ProfileService);

  ngOnInit(): void {
    this.ribbonEnv$ = this.profileService.getProfileInfo().pipe(map(profileInfo => profileInfo.ribbonEnv));
  }
}
