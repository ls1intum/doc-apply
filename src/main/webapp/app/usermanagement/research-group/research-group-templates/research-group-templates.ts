import { Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import { TableLazyLoadEvent } from 'primeng/table';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { DynamicTableColumn, DynamicTableComponent } from '../../../shared/components/organisms/dynamic-table/dynamic-table.component';
import { ButtonComponent } from '../../../shared/components/atoms/button/button.component';
import TranslateDirective from '../../../shared/language/translate.directive';
import { ToastService } from '../../../service/toast-service';
import { EmailTemplateResourceApi } from '../../../generated/api/email-template-resource-api';
import { EmailTemplateOverviewDTO } from '../../../generated/model/email-template-overview-dto';
import { AccountService } from '../../../core/auth/account.service';

@Component({
  selector: 'jhi-research-group-templates',
  imports: [DynamicTableComponent, ButtonComponent, TranslateDirective, TranslateModule, ConfirmDialog],
  templateUrl: './research-group-templates.html',
})
export class ResearchGroupTemplates {
  protected readonly emailTemplateApi = inject(EmailTemplateResourceApi);
  protected readonly toastService = inject(ToastService);
  protected readonly translate = inject(TranslateService);
  protected readonly router = inject(Router);
  protected readonly accountService = inject(AccountService);

  protected currentLang = toSignal(this.translate.onLangChange.pipe(map(e => e.lang)), { initialValue: this.translate.getCurrentLang() });

  protected readonly actionsTemplate = viewChild.required<TemplateRef<unknown>>('actionsTemplate');

  protected readonly isEmployee = computed<boolean>(() => {
    const currentUserAuthorities = this.accountService.userAuthorities;
    return currentUserAuthorities?.includes(UserShortDTORolesEnum.Employee) ?? false;
  });

  protected readonly columns = computed<DynamicTableColumn[]>(() => {
    const actionsTemplate = this.actionsTemplate();

    return [
      { field: 'displayName', header: `${this.translationKey}.tableColumns.templateName`, width: '28rem' },
      { field: 'createdBy', header: `${this.translationKey}.tableColumns.createdBy`, width: '15rem' },
      { field: 'actions', header: '', width: '7rem', template: actionsTemplate },
    ];
  });

  protected readonly translationKey: string = 'researchGroup.emailTemplates';

  protected readonly tableData = computed(() => {
    this.currentLang();
    return this.responseData().map(template => {
      const displayName = this.translate.instant(`${this.translationKey}.messageType.${template.emailType}`);
      const createdBy =
        template.isCustom === true
          ? `${template.firstName ?? ''} ${template.lastName ?? ''}`.trim()
          : this.translate.instant(`${this.translationKey}.systemDefault`);

      return {
        emailTemplateId: template.emailTemplateId,
        emailType: template.emailType,
        isCustom: template.isCustom,
        english: template.english,
        german: template.german,
        firstName: template.firstName,
        lastName: template.lastName,
        lastModifiedAt: template.lastModifiedAt,
        displayName,
        createdBy,
      };
    });
  });

  protected readonly availableEmailTypesForCreate = computed(() =>
    this.responseData()
      .filter(t => t.isCustom !== true)
      .map(t => t.emailType),
  );

  protected readonly pageNumber = signal<number>(0);
  protected readonly pageSize = signal<number>(10);
  protected readonly total = signal<number>(0);

  private readonly responseData = signal<EmailTemplateOverviewDTO[]>([]);

  async delete(templateId: string): Promise<void> {
    try {
      await firstValueFrom(this.emailTemplateApi.deleteTemplate(templateId));
      this.toastService.showSuccess({ detail: this.translate.instant(`${this.translationKey}.deleteSuccess`) });
    } catch {
      this.toastService.showError({ detail: this.translate.instant(`${this.translationKey}.deleteFailed`) });
    } finally {
      void this.loadPage();
    }
  }

  onTableEmit(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.pageSize();
    this.pageNumber.set(first / rows);
    this.pageSize.set(rows);
    void this.loadPage();
  }

  protected navigateToCreate(): void {
    void this.router.navigate(['/research-group/template/new']);
  }

  protected navigateToEdit(templateId: string): void {
    void this.router.navigate(['/research-group/template', templateId, 'edit']);
  }

  protected navigateToView(emailType: string): void {
    void this.router.navigate(['/research-group/template/new'], { queryParams: { emailType } });
  }

  private async loadPage(): Promise<void> {
    try {
      const page = await firstValueFrom(this.emailTemplateApi.getTemplates(this.pageNumber(), this.pageSize()));
      this.responseData.set(page.content ?? []);
      this.total.set(page.totalElements ?? 0);
    } catch {
      this.toastService.showError({ detail: 'Failed to load templates' });
    }
  }
}
