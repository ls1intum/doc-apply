export interface InfoGitResponse {
  branch?: string;
  commit?: {
    // With management.info.git.mode=full Spring Boot nests this as { full, abbrev, describe };
    // with mode=simple it's a plain string.
    id?: string | { full?: string; abbrev?: string };
    time?: string;
    user?: { name?: string };
  };
}

export interface InfoResponse {
  'display-ribbon-on-profiles'?: string;
  git?: InfoGitResponse;
  build?: unknown;
  activeProfiles?: string[];
}

export interface GitInfo {
  branch: string;
  commitHashShort: string;
  commitHashFull: string;
  commitTime: string;
  lastCommitter: string;
}

export class ProfileInfo {
  constructor(
    public activeProfiles?: string[],
    public ribbonEnv?: string,
    public inProduction?: boolean,
    public openAPIEnabled?: boolean,
    public gitInfo?: GitInfo,
  ) {}
}
