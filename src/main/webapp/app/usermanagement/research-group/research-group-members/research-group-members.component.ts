import { hasText } from 'app/shared/util/text.util';
import { Component, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TableLazyLoadEvent } from 'primeng/table';
import { BackButtonComponent } from 'app/shared/components/atoms/back-button/back-button.component';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { DialogService } from 'primeng/dynamicdialog';
import { UserShortDTO } from 'app/generated/model/user-short-dto';
import { ActivatedRoute, Router } from '@angular/router';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { DynamicTableColumn, DynamicTableComponent } from '../../../shared/components/organisms/dynamic-table/dynamic-table.component';
import { ConfirmDialog } from '../../../shared/components/atoms/confirm-dialog/confirm-dialog';
import TranslateDirective from '../../../shared/language/translate.directive';
import { ToastService } from '../../../service/toast-service';
import { AccountService } from '../../../core/auth/account.service';
import { ResearchGroupResourceApi } from '../../../generated/api/research-group-resource-api';
import { formatFullName } from '../../../shared/util/name.util';
import { ResearchGroupAddMembersComponent } from '../research-group-add-members/research-group-add-members.component';

interface MembersRow {
  avatar?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: UserShortDTORolesEnum[];
  userId?: string;
  name: string;
  role: string;
  isCurrentUser: boolean;
  canRemove: boolean;
}

@Component({
  selector: 'jhi-research-group-members',
  imports: [
    BackButtonComponent,
    ButtonComponent,
    TranslateDirective,
    TranslateModule,
    DynamicTableComponent,
    DialogModule,
    FormsModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    ConfirmDialog,
    UserAvatarComponent,
  ],
  templateUrl: './research-group-members.component.html',
})
export class ResearchGroupMembersComponent {
  members = signal<UserShortDTO[]>([]);
  pageNumber = signal<number>(0);
  pageSize = signal<number>(10);
  total = signal<number>(0);

  researchGroupId = signal<string | undefined>(undefined);
  researchGroupName = signal<string | undefined>(undefined);

  readonly nameTemplate = viewChild.required<TemplateRef<unknown>>('nameTemplate');
  readonly deleteTemplate = viewChild.required<TemplateRef<unknown>>('deleteTemplate');

  readonly columns = computed<DynamicTableColumn[]>(() => {
    const nameTemplate = this.nameTemplate();
    const deleteTemplate = this.deleteTemplate();

    return [
      { field: 'name', header: `${this.translationKey}.tableColumns.name`, width: '26rem', template: nameTemplate },
      { field: 'email', header: `${this.translationKey}.tableColumns.email`, width: '26rem' },
      { field: 'role', header: `${this.translationKey}.tableColumns.role`, width: '26rem' },
      { field: 'actions', header: '', width: '5rem', template: deleteTemplate },
    ];
  });

  // Transform members data for display
  readonly tableData = computed<MembersRow[]>(() => {
    return this.members().map((member): MembersRow => {
      const isCurrentUser = this.isCurrentUser(member);
      let canRemove = !isCurrentUser;

      if (this.isEmployee()) {
        canRemove = false;
      }

      return {
        email: member.email,
        avatar: member.avatar,
        firstName: member.firstName,
        lastName: member.lastName,
        roles: member.roles,
        userId: member.userId,
        name: formatFullName(member.firstName, member.lastName),
        role: this.formatRoles(member.roles),
        isCurrentUser,
        canRemove,
      };
    });
  });

  readonly isEmployee = computed(() => this.accountService.userAuthorities?.includes(UserShortDTORolesEnum.Employee) ?? false);

  private researchGroupApi = inject(ResearchGroupResourceApi);
  private toastService = inject(ToastService);
  private accountService = inject(AccountService);
  private translate = inject(TranslateService);
  private readonly dialogService = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Convert route observables to signals so we can create a derived computed signal
  private readonly routeParamMap = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly routeQueryParamMap = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  private readonly routeId = computed<string | undefined>(() => {
    const params = this.routeParamMap();
    const queryParams = this.routeQueryParamMap();
    return params.get('id') ?? queryParams.get('researchGroupId') ?? undefined;
  });

  private readonly routeIdEffect = effect(() => {
    const id = this.routeId();
    // Track the active group too so switching groups in the header re-runs the load
    // even when the route itself doesn't change.
    this.accountService.activeResearchGroupId();
    this.researchGroupId.set(id);
    this.researchGroupName.set(undefined);
    if (hasText(id)) {
      void this.loadResearchGroupName(id);
    }
    void this.loadMembers();
  });

  private readonly translationKey: string = 'researchGroup.members';

  loadOnTableEmit(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? 10;
    this.pageNumber.set(first / rows);
    this.pageSize.set(rows);

    void this.loadMembers();
  }

  async removeMember(member: UserShortDTO): Promise<void> {
    try {
      await firstValueFrom(this.researchGroupApi.removeMemberFromResearchGroup(member.userId ?? ''));
      this.toastService.showSuccessKey(`${this.translationKey}.toastMessages.removeSuccess`, {
        memberName: formatFullName(member.firstName, member.lastName),
      });

      // Refresh the members list
      await this.loadMembers();
    } catch {
      this.toastService.showErrorKey(`${this.translationKey}.toastMessages.removeFailed`, {
        memberName: formatFullName(member.firstName, member.lastName),
      });
    }
  }

  async loadMembers(): Promise<void> {
    try {
      const id = this.researchGroupId();
      const members = hasText(id)
        ? await firstValueFrom(this.researchGroupApi.getResearchGroupMembersById(id, this.pageSize(), this.pageNumber()))
        : await firstValueFrom(this.researchGroupApi.getResearchGroupMembers(this.pageSize(), this.pageNumber()));

      this.members.set(members.content ?? []);
      this.total.set(members.totalElements ?? 0);
    } catch {
      this.toastService.showErrorKey(`${this.translationKey}.toastMessages.loadFailed`);
    }
  }

  openAddMembersModal(): void {
    const ref = this.dialogService.open(ResearchGroupAddMembersComponent, {
      header: this.translate.instant('researchGroup.members.addMembers'),
      style: { background: 'var(--p-background-default)', width: '50rem' },
      closable: true,
      draggable: false,
      modal: true,
      data: { researchGroupId: this.researchGroupId() },
    });

    ref?.onClose.subscribe((added: boolean) => {
      if (added) {
        void this.loadMembers();
      }
    });
  }

  /** Internal methods */

  private formatRoles(roles?: string[]): string {
    if (roles === undefined || roles.length === 0) {
      return this.translate.instant(`${this.translationKey}.noRole`);
    }

    return roles.map(role => role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()).join(', ');
  }

  private isCurrentUser(member: UserShortDTO): boolean {
    return member.userId === this.accountService.userId;
  }

  private async loadResearchGroupName(researchGroupId: string): Promise<void> {
    try {
      const researchGroup = await firstValueFrom(this.researchGroupApi.getResearchGroup(researchGroupId));
      this.researchGroupName.set(researchGroup.name);
    } catch {
      this.researchGroupName.set(undefined);
    }
  }
}
