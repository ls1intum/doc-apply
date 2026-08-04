import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { hasText } from 'app/shared/util/text.util';

import { GitInfo, InfoGitResponse, InfoResponse, ProfileInfo } from './profile-info.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly applicationConfigService = inject(ApplicationConfigService);

  private readonly infoUrl = this.applicationConfigService.getEndpointFor('management/info');
  private profileInfo$?: Observable<ProfileInfo>;

  getProfileInfo(): Observable<ProfileInfo> {
    if (this.profileInfo$) {
      return this.profileInfo$;
    }

    this.profileInfo$ = this.http.get<InfoResponse>(this.infoUrl).pipe(
      map((response: InfoResponse) => {
        const profileInfo: ProfileInfo = {
          activeProfiles: response.activeProfiles,
          inProduction: response.activeProfiles?.includes('prod'),
          openAPIEnabled: response.activeProfiles?.includes('api-docs'),
        };
        if (response.activeProfiles && response['display-ribbon-on-profiles'] != null) {
          const displayRibbonOnProfiles = response['display-ribbon-on-profiles'].split(',');
          const ribbonProfiles = displayRibbonOnProfiles.filter(
            (profile): boolean => response.activeProfiles?.includes(profile) as boolean,
          );
          if (ribbonProfiles.length > 0) {
            profileInfo.ribbonEnv = ribbonProfiles[0];
          }
        }
        profileInfo.gitInfo = mapGitInfo(response.git);
        return profileInfo;
      }),
      shareReplay(),
    );
    return this.profileInfo$;
  }
}

function mapGitInfo(git: InfoGitResponse | undefined): GitInfo | undefined {
  const idValue = git?.commit?.id;
  const fullId = typeof idValue === 'string' ? idValue : idValue?.full;
  const abbrevId = typeof idValue === 'string' ? fullId?.slice(0, 7) : idValue?.abbrev;
  const branch = git?.branch;
  const time = git?.commit?.time;
  const userName = git?.commit?.user?.name;
  if (!hasText(fullId) || !hasText(abbrevId) || !hasText(branch) || !hasText(time) || !hasText(userName)) {
    return undefined;
  }
  return {
    branch,
    commitHashShort: abbrevId,
    commitHashFull: fullId,
    commitTime: time,
    lastCommitter: userName,
  };
}
