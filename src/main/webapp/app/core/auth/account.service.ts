import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ResearchGroupShortDTO } from '../../generated/model/research-group-short-dto';
import { UserResourceApi } from '../../generated/api/user-resource-api';
import { UserShortDTO } from '../../generated/model/user-short-dto';
import { formatFullName } from '../../shared/util/name.util';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  memberships?: ResearchGroupShortDTO[];
  authorities?: string[];
}

const ACTIVE_RESEARCH_GROUP_STORAGE_KEY = 'docApply.activeResearchGroupId';

/**
 * Purpose
 * -------
 * Provides a reactive, application-wide source of truth for the currently signed-in user.
 *
 * Responsibilities
 * ----------------
 *  - Loads the current user's information from the server (`loadUser`).
 *  - Exposes reactive signals (`user`, `loaded`, `signedIn`) to let components react to changes in user state.
 *  - Provides convenience getters for user properties such as id, email, name, research group and authorities.
 *  - Allows updates to the user profile (`updateUser`) and password (`updatePassword`).
 *  - Offers role-based checks (`hasAnyAuthority`) to simplify authorization logic in the UI.
 *
 * Notes
 * -----
 *  - This service does not handle authentication itself; it assumes that the server session or Keycloak
 *    has already established an authenticated context.
 *  - It relies on `UserResourceApi` for all server communication.
 *  - Errors when fetching the user are logged and result in `user` being set to `undefined` while `loaded` is true.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  loaded = signal<boolean>(false);
  user = signal<User | undefined>(undefined);
  loadedUser = computed(() => (this.loaded() ? this.user() : undefined));
  signedIn = computed(() => {
    const user = this.user();
    return this.loaded() && user !== undefined;
  });

  /** Memberships of the signed-in user. Empty when not signed in or no memberships. */
  memberships = computed<ResearchGroupShortDTO[]>(() => this.loadedUser()?.memberships ?? []);

  /** True when the signed-in user has at least two PROFESSOR/EMPLOYEE memberships. */
  hasMultipleMemberships = computed(() => this.memberships().length >= 2);

  activeResearchGroupId = signal<string | undefined>(undefined);
  activeResearchGroup = computed<ResearchGroupShortDTO | undefined>(() => {
    const id = this.activeResearchGroupId();
    return id !== undefined ? this.memberships().find(m => m.researchGroupId === id) : undefined;
  });

  private readonly userApi = inject(UserResourceApi);

  /**
   * Returns the id of the signed-in user, or undefined if no user is loaded.
   */
  get userId(): string | undefined {
    return this.loadedUser()?.id;
  }

  /**
   * Returns the email address of the signed-in user, or undefined if no user is loaded.
   */
  get userEmail(): string | undefined {
    return this.loadedUser()?.email;
  }

  /**
   * Returns the full name of the signed-in user, or undefined if no user is loaded.
   */
  get userName(): string | undefined {
    return this.loadedUser()?.name;
  }

  /**
   * Returns the roles/authorities of the signed-in user, or undefined if not available.
   */
  get userAuthorities(): string[] | undefined {
    return this.loadedUser()?.authorities;
  }

  hasAnyAuthority(requiredRoles: string[]): boolean {
    return requiredRoles.some(role => this.loadedUser()?.authorities?.includes(role) ?? false);
  }

  // Loads the user information from the server
  async loadUser(): Promise<void> {
    const userShortDTO: UserShortDTO | null = await this.getCurrentUser();

    if (userShortDTO?.userId != null) {
      const memberships = userShortDTO.memberships ? Array.from(userShortDTO.memberships) : [];
      const user: User = {
        id: userShortDTO.userId,
        email: userShortDTO.email ?? '',
        name: formatFullName(userShortDTO.firstName, userShortDTO.lastName) || 'User',
        avatar: userShortDTO.avatar,
        memberships,
        authorities: userShortDTO.roles ? Array.from(userShortDTO.roles) : undefined,
      };
      this.user.set(user);
      this.loaded.set(true);
      this.restoreActiveResearchGroup(memberships);
    } else {
      this.user.set(undefined);
      this.loaded.set(true);
      this.activeResearchGroupId.set(undefined);
    }
  }

  /**
   * Sets the active research group, persists it to localStorage, and signals
   * subscribers so the page can re-fetch its data with the new scope.
   */
  setActiveResearchGroup(researchGroupId: string | undefined): void {
    if (researchGroupId !== undefined && !this.memberships().some(m => m.researchGroupId === researchGroupId)) {
      return;
    }
    this.activeResearchGroupId.set(researchGroupId);
    if (researchGroupId === undefined) {
      localStorage.removeItem(ACTIVE_RESEARCH_GROUP_STORAGE_KEY);
    } else {
      localStorage.setItem(ACTIVE_RESEARCH_GROUP_STORAGE_KEY, researchGroupId);
    }
  }

  /** Clears the persisted active group; call from sign-out flows. */
  clearActiveResearchGroup(): void {
    this.activeResearchGroupId.set(undefined);
    localStorage.removeItem(ACTIVE_RESEARCH_GROUP_STORAGE_KEY);
  }

  async updateUser(firstName: string, lastName: string): Promise<void> {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    await firstValueFrom(
      this.userApi.updateUserName({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
      }),
    );
    await this.loadUser();
  }

  async updatePassword(password: string): Promise<void> {
    const trimmedPassword = password.trim();
    if (trimmedPassword) {
      await firstValueFrom(this.userApi.updatePassword({ newPassword: trimmedPassword }));
    }
  }

  setAvatar(avatarUrl: string | undefined): void {
    this.user.update(currentUser => (currentUser ? Object.assign({}, currentUser, { avatar: avatarUrl }) : currentUser));
  }

  private async getCurrentUser(): Promise<UserShortDTO | null> {
    try {
      const user = await firstValueFrom(this.userApi.getCurrentUser());
      return user;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      return null;
    }
  }

  private restoreActiveResearchGroup(memberships: ResearchGroupShortDTO[]): void {
    if (memberships.length === 0) {
      this.activeResearchGroupId.set(undefined);
      localStorage.removeItem(ACTIVE_RESEARCH_GROUP_STORAGE_KEY);
      return;
    }
    const stored = localStorage.getItem(ACTIVE_RESEARCH_GROUP_STORAGE_KEY) ?? undefined;
    if (stored !== undefined && memberships.some(m => m.researchGroupId === stored)) {
      this.activeResearchGroupId.set(stored);
      return;
    }
    const fallback = memberships[0].researchGroupId;
    this.activeResearchGroupId.set(fallback);
    if (fallback !== undefined) {
      localStorage.setItem(ACTIVE_RESEARCH_GROUP_STORAGE_KEY, fallback);
    }
  }
}
