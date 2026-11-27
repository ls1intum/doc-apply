import { computed, signal, WritableSignal } from '@angular/core';
import { vi } from 'vitest';
import { AccountService, User } from 'app/core/auth/account.service';
import { ResearchGroupShortDTO } from 'app/generated/model/research-group-short-dto';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

export type AccountServiceMock = Pick<
  AccountService,
  | 'user'
  | 'loadedUser'
  | 'signedIn'
  | 'loaded'
  | 'hasAnyAuthority'
  | 'userId'
  | 'userAuthorities'
  | 'memberships'
  | 'hasMultipleMemberships'
  | 'activeResearchGroupId'
  | 'activeResearchGroup'
> & {
  loadUser: ReturnType<typeof vi.fn>;
  authorities: UserShortDTORolesEnum[];
  setAuthorities: (roles: UserShortDTORolesEnum[]) => void;
  updateUser: ReturnType<typeof vi.fn>;
  updatePassword: ReturnType<typeof vi.fn>;
  setActiveResearchGroup: ReturnType<typeof vi.fn>;
  clearActiveResearchGroup: ReturnType<typeof vi.fn>;
};

export let defaultUser: User = {
  id: 'id-2',
  name: 'User',
  email: 'user@test.com',
  authorities: [],
};

export function createAccountServiceMock(signedIn?: boolean, loaded?: boolean): AccountServiceMock {
  const userLocal: WritableSignal<User | undefined> = signal(defaultUser);
  const activeResearchGroupId: WritableSignal<string | undefined> = signal(undefined);

  const normalizeRole = (role: string | UserShortDTORolesEnum): string => role.toString().toUpperCase();

  const memberships = computed<ResearchGroupShortDTO[]>(() => userLocal()?.memberships ?? []);
  const hasMultipleMemberships = computed(() => memberships().length >= 2);
  const activeResearchGroup = computed<ResearchGroupShortDTO | undefined>(() => {
    const id = activeResearchGroupId();
    return id !== undefined ? memberships().find(m => m.researchGroupId === id) : undefined;
  });

  const mock: AccountServiceMock = {
    user: userLocal,
    loadedUser: computed(() => (userLocal() ? userLocal() : undefined)),
    loaded: signal<boolean>(loaded ?? true),
    signedIn: signal<boolean>(signedIn ?? true),
    authorities: [],
    hasAnyAuthority: (roles: string[]) => {
      if (!roles.length) {
        return false;
      }
      const normalizedAuthorities = mock.authorities.map(normalizeRole);
      const normalizedRequested = roles.map(role => role.toUpperCase());
      return normalizedRequested.some(role => normalizedAuthorities.includes(role));
    },
    loadUser: vi.fn(),
    setAuthorities: (roles: UserShortDTORolesEnum[]) => {
      mock.authorities = roles;
    },
    updateUser: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    memberships,
    hasMultipleMemberships,
    activeResearchGroupId,
    activeResearchGroup,
    setActiveResearchGroup: vi.fn((id: string | undefined) => {
      activeResearchGroupId.set(id);
    }),
    clearActiveResearchGroup: vi.fn(() => {
      activeResearchGroupId.set(undefined);
    }),
    get userId(): string | undefined {
      return userLocal()?.id;
    },
    get userAuthorities(): string[] | undefined {
      return userLocal()?.authorities;
    },
  };

  return mock;
}

export function provideAccountServiceMock(mock = createAccountServiceMock()) {
  return { provide: AccountService, useValue: mock };
}
