import { Component, ViewEncapsulation, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { QuillEditorComponent } from 'ngx-quill';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TabItem, TabPanelTemplateDirective, TabViewComponent } from 'app/shared/components/molecules/tab-view/tab-view.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { BackButtonComponent } from 'app/shared/components/atoms/back-button/back-button.component';
import 'quill-mention/autoregister';
import { EmailTemplateDTO, EmailTemplateDTOEmailTypeEnum } from 'app/generated/model/email-template-dto';
import { EmailTemplateTranslationDTO } from 'app/generated/model/email-template-translation-dto';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { SavingStates } from 'app/shared/constants/saving-states';
import { AutoSaveController } from 'app/shared/util/auto-save-controller';
import { SavingBadgeComponent } from 'app/shared/components/atoms/saving-badge/saving-badge.component';
import { SiteConfigService } from 'app/core/config/site-config.service';
import { AiResourceApi } from 'app/generated/api/ai-resource-api';
import { UserResourceApi } from 'app/generated/api/user-resource-api';
import { AiFeatureStatusService } from 'app/service/ai-feature-status.service';
import { MessageComponent } from 'app/shared/components/atoms/message/message.component';
import { TranslationIndicatorComponent } from 'app/shared/components/atoms/translation-indicator/translation-indicator.component';
import { StickyFooterShellComponent } from 'app/shared/components/molecules/sticky-footer-shell/sticky-footer-shell.component';

import { SelectComponent, SelectOption } from '../../../shared/components/atoms/select/select.component';
import TranslateDirective from '../../../shared/language/translate.directive';
import { ToastService } from '../../../service/toast-service';
import { EmailTemplateResourceApi } from '../../../generated/api/email-template-resource-api';
import { AccountService } from '../../../core/auth/account.service';

const EMPTY_TRANSLATION: EmailTemplateTranslationDTO = { subject: '', body: '' };
const ALL_TYPES_PAGE_SIZE = 100;
const AUTO_TRANSLATE_DELAY_MS = 2500;

/** One of the two languages an email template is written in. */
type TemplateLanguage = 'english' | 'german';

/** A translation the page should fill in: from the language the author wrote into the one left empty. */
interface TranslationJob {
  source: TemplateLanguage;
  target: TemplateLanguage;
}

/** The other language as it was when the author last typed in a language, keyed by the language they typed in. */
type SourceAtAuthorEdit = Partial<Record<TemplateLanguage, EmailTemplateTranslationDTO>>;

/** The translation the page filled in by itself, with the source text it was made from, so it can follow later edits. */
interface AutoTranslation {
  target: TemplateLanguage;
  source: EmailTemplateTranslationDTO;
}

/**
 * Tells whether a language of a template has neither a subject nor any text in its body.
 *
 * @param translation the subject and body of one language
 * @returns whether both are empty
 */
function isEmptyTranslation(translation: EmailTemplateTranslationDTO): boolean {
  return (translation.subject ?? '').trim() === '' && !hasBodyText(translation.body);
}

/**
 * Tells whether a language of a template has both a subject and text in its body.
 *
 * @param translation the subject and body of one language
 * @returns whether both are filled in
 */
function isCompleteTranslation(translation: EmailTemplateTranslationDTO): boolean {
  return (translation.subject ?? '').trim() !== '' && hasBodyText(translation.body);
}

/**
 * Tells whether editor HTML shows any text, so an untouched editor's empty paragraph counts as empty.
 *
 * @param html the editor HTML
 * @returns whether there is visible text or a variable
 */
function hasBodyText(html: string | undefined): boolean {
  const parsed = new DOMParser().parseFromString(html ?? '', 'text/html');
  return parsed.body.textContent.trim() !== '' || (parsed.body.querySelector('.mention') ?? undefined) !== undefined;
}

/**
 * Tells whether two language versions have the same subject and body.
 *
 * @param a the first version
 * @param b the second version
 * @returns whether they match
 */
function sameTranslation(a: EmailTemplateTranslationDTO, b: EmailTemplateTranslationDTO): boolean {
  return (a.subject ?? '') === (b.subject ?? '') && (a.body ?? '') === (b.body ?? '');
}

@Component({
  selector: 'jhi-research-group-template-edit',
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    StringInputComponent,
    TabViewComponent,
    TabPanelTemplateDirective,
    QuillEditorComponent,
    BackButtonComponent,
    SelectComponent,
    TranslateModule,
    TranslateDirective,
    SavingBadgeComponent,
    MessageComponent,
    StickyFooterShellComponent,
    TranslationIndicatorComponent,
  ],
  templateUrl: './research-group-template-edit.html',
  styleUrl: './research-group-template-edit.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ResearchGroupTemplateEdit {
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly emailTemplateApi = inject(EmailTemplateResourceApi);
  readonly translate = inject(TranslateService);
  readonly siteName = inject(SiteConfigService).siteName;
  readonly toastService = inject(ToastService);
  readonly accountService = inject(AccountService);

  readonly languageTabs: TabItem[] = [
    { id: 'english', translationKey: 'researchGroup.emailTemplates.english' },
    { id: 'german', translationKey: 'researchGroup.emailTemplates.german' },
  ];

  /** Debounced auto-save controller. Owns the 3 s timer and the badge state. */
  readonly autoSave = new AutoSaveController({ save: () => this.executeAutoSave() });

  readonly lastSavedSnapshot = signal<EmailTemplateDTO | undefined>(undefined);
  skipNextAutosave = false;

  readonly paramMapSignal = toSignal(this.route.paramMap, { initialValue: convertToParamMap({}) });
  readonly queryParamMapSignal = toSignal(this.route.queryParamMap, { initialValue: convertToParamMap({}) });

  readonly currentLang = toSignal(this.translate.onLangChange.pipe(map(e => e.lang)), { initialValue: this.translate.getCurrentLang() });
  readonly templateId = computed(() => this.paramMapSignal().get('templateId') ?? undefined);
  readonly customizableEmailTypes = signal<EmailTemplateDTOEmailTypeEnum[]>([]);
  readonly alreadyCustomEmailTypes = signal<Set<EmailTemplateDTOEmailTypeEnum>>(new Set());

  readonly preselectedEmailTypeFromQuery = computed<EmailTemplateDTOEmailTypeEnum | undefined>(() => {
    const raw = this.queryParamMapSignal().get('emailType') ?? undefined;
    if (raw === undefined) {
      return undefined;
    }
    return this.customizableEmailTypes().find(v => v === raw);
  });

  readonly formModel = signal<EmailTemplateDTO>({
    emailType: undefined,
    english: { subject: '', body: '' },
    german: { subject: '', body: '' },
  });

  readonly currentSnapshot = computed(() => this.formModel());
  readonly hasUnsavedChanges = computed(() => JSON.stringify(this.currentSnapshot()) !== JSON.stringify(this.lastSavedSnapshot()));
  readonly translationKey = 'researchGroup.emailTemplates';

  readonly templateDisplayName = computed(() => {
    this.currentLang();
    const emailType = this.formModel().emailType;
    if (emailType === undefined) {
      return '';
    }
    return this.translate.instant(`${this.translationKey}.messageType.${emailType}`);
  });

  readonly english = computed(() => this.formModel().english ?? EMPTY_TRANSLATION);
  readonly german = computed(() => this.formModel().german ?? EMPTY_TRANSLATION);

  /** The translation the page filled in by itself and the author has not edited since. */
  readonly autoTranslation = signal<AutoTranslation | undefined>(undefined);
  /** The language a translation is being requested for. */
  readonly translatingInto = signal<TemplateLanguage | undefined>(undefined);

  readonly autoTranslatedLanguage = computed(() => this.autoTranslation()?.target);

  /**
   * Finds a language that should be translated: one the author left empty, or one the page translated earlier whose
   * source has changed since, while the other language is complete. Nothing is translated without AI, without the
   * author's AI consent, for an employee who cannot save, or while a translation is running.
   */
  readonly pendingTranslation = computed<TranslationJob | undefined>(() => {
    const form = this.formModel();
    const isEmployee = this.accountService.userAuthorities?.includes(UserShortDTORolesEnum.Employee) === true;
    if (!this.aiConsent() || !this.aiFeatureStatus.aiSystemEnabled() || isEmployee || form.emailType === undefined) {
      return undefined;
    }
    if (this.translatingInto() !== undefined) {
      return undefined;
    }
    const jobs: TranslationJob[] = [
      { source: 'english', target: 'german' },
      { source: 'german', target: 'english' },
    ];
    return jobs.find(job => this.needsTranslation(form, job));
  });

  readonly selectOptions = computed<SelectOption[]>(() => {
    const taken = this.alreadyCustomEmailTypes();
    const currentType = this.formModel().emailType;
    return this.customizableEmailTypes()
      .filter(v => !taken.has(v) || v === currentType)
      .map(v => ({
        name: `researchGroup.emailTemplates.messageType.${v}`,
        value: v,
      }));
  });

  preselectedEmailType = computed(() => this.selectOptions().find(o => o.value === (this.formModel().emailType ?? '')) ?? undefined);

  readonly modules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['link'],
    ],
    mention: {
      allowedChars: /^[A-Za-z_]*$/,
      mentionDenotationChars: ['$'],
      showDenotationChar: false,
      spaceAfterInsert: false,

      source: (searchTerm: string, renderList: (values: unknown[], searchTerm: string) => void) => {
        const items = this.TEMPLATE_VARIABLES.map(v => ({
          id: v,
          value: this.translate.instant(`researchGroup.emailTemplates.variables.${v}`),
        }));
        const matches = searchTerm.length
          ? items.filter((item): boolean => item.value.toLowerCase().includes(searchTerm.toLowerCase()))
          : items;
        renderList(matches, searchTerm);
      },
    },
  };

  readonly TEMPLATE_VARIABLES = [
    'APPLICANT_FIRST_NAME',
    'APPLICANT_LAST_NAME',
    'APPLICANT_GENDER',
    'USER_FIRST_NAME',
    'USER_LAST_NAME',
    'SUPERVISING_PROFESSOR_FIRST_NAME',
    'SUPERVISING_PROFESSOR_LAST_NAME',
    'SUPERVISING_PROFESSOR_EMAIL',
    'JOB_TITLE',
    'RESEARCH_GROUP_NAME',
    'INTERVIEW_DATE',
    'INTERVIEW_START_TIME',
    'INTERVIEW_END_TIME',
    'INTERVIEW_LOCATION',
    'INTERVIEW_STREAM_LINK',
    'BOOKING_LINK',
    'DOWNLOAD_LINK',
    'EXPORT_EXPIRES_DAYS',
    'SITE_NAME',
  ];

  readonly templateVariables: SelectOption[] = this.TEMPLATE_VARIABLES.map(v => ({
    name: `researchGroup.emailTemplates.variables.${v}`,
    value: v,
  }));

  readonly loadEffect = effect(() => {
    const templateId = this.templateId();
    if (templateId !== undefined) {
      void this.load(templateId);
      return;
    }
    const preselected = this.preselectedEmailTypeFromQuery();
    if (preselected !== undefined) {
      void this.prefillFromDefault(preselected);
    }
  });

  readonly translateVariablesEffect = effect(() => {
    this.currentLang();
    const form = untracked(() => this.formModel());
    this.skipNextAutosave = true;
    this.formModel.set(this.translateMentionsInTemplate(form));
  });

  /** Translates a missing language once the source has rested for a moment, so a half-typed text is not translated. */
  readonly autoTranslateEffect = effect(onCleanup => {
    const job = this.pendingTranslation();
    if (job === undefined) {
      return;
    }
    const timer = setTimeout(() => void this.translateMissingLanguage(job), AUTO_TRANSLATE_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });

  readonly formChangeEffect = effect(() => {
    const form = this.formModel();

    if (this.skipNextAutosave) {
      this.skipNextAutosave = false;
      return;
    }
    if (form.emailType === undefined) {
      return;
    }

    const isEmployee = this.accountService.userAuthorities?.includes(UserShortDTORolesEnum.Employee);
    if (isEmployee === true) {
      return;
    }

    // Restart the debounce timer. The badge stays on its current state until
    // the timer fires so it does not flicker on every keystroke.
    this.autoSave.notifyChanged();
  });

  private readonly aiApi = inject(AiResourceApi);
  private readonly userApi = inject(UserResourceApi);
  private readonly aiFeatureStatus = inject(AiFeatureStatusService);
  /**
   * The other language as it was when the author last typed in a language. A language the author emptied is translated
   * again only once the other language changes, so clearing a text to rewrite it does not bring the translation back.
   */
  private readonly sourceAtAuthorEdit = signal<SourceAtAuthorEdit>({});
  /** The source text whose last translation failed, so a failing model is not asked again for the same text. */
  private readonly failedTranslationSource = signal<EmailTemplateTranslationDTO | undefined>(undefined);
  private readonly aiConsent = signal(false);

  constructor() {
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    void this.loadCustomizableEmailTypes();
    void this.loadAiConsent();
  }

  readonly beforeUnloadHandler = (): void => {
    if (this.hasUnsavedChanges()) {
      void this.autoSave.flush();
    }
  };

  setSelectedEmailType(selection: SelectOption | undefined): void {
    if (selection === undefined) {
      return;
    }
    const matched = this.customizableEmailTypes().find(v => v === selection.value);
    this.formModel.update(prev => this.withEmailType(prev, matched));
  }

  updateEnglishSubject(subject: string): void {
    this.markEdited('english');
    this.formModel.update(prev => this.withEnglish(prev, { subject, body: prev.english?.body ?? '' }));
  }

  updateEnglishBody(body: string): void {
    this.markEdited('english');
    this.formModel.update(prev => this.withEnglish(prev, { subject: prev.english?.subject ?? '', body }));
  }

  updateGermanSubject(subject: string): void {
    this.markEdited('german');
    this.formModel.update(prev => this.withGerman(prev, { subject, body: prev.german?.body ?? '' }));
  }

  updateGermanBody(body: string): void {
    this.markEdited('german');
    this.formModel.update(prev => this.withGerman(prev, { subject: prev.german?.subject ?? '', body }));
  }

  /**
   * Records that the author typed in a language. A translation the page made there now belongs to the author, and the
   * other language is remembered as it is now, so an emptied language waits for the other one to change.
   *
   * @param language the language the author edited
   */
  private markEdited(language: TemplateLanguage): void {
    if (this.autoTranslation()?.target === language) {
      this.autoTranslation.set(undefined);
    }
    const otherLanguage: TemplateLanguage = language === 'english' ? 'german' : 'english';
    const otherText = this.formModel()[otherLanguage] ?? EMPTY_TRANSLATION;
    const previous = this.sourceAtAuthorEdit();
    this.sourceAtAuthorEdit.set({
      english: language === 'english' ? otherText : previous.english,
      german: language === 'german' ? otherText : previous.german,
    });
  }

  /**
   * Tells whether a translation job applies to the form: the source must be complete, and the target either an earlier
   * automatic translation of a source that has changed since, or empty. An empty target the author typed in is only
   * translated once the source has changed since that edit.
   *
   * @param form the current form
   * @param job the translation to check
   * @returns whether the page should translate
   */
  private needsTranslation(form: EmailTemplateDTO, job: TranslationJob): boolean {
    const source = form[job.source] ?? EMPTY_TRANSLATION;
    const target = form[job.target] ?? EMPTY_TRANSLATION;
    const failed = this.failedTranslationSource();
    if (!isCompleteTranslation(source) || (failed !== undefined && sameTranslation(failed, source))) {
      return false;
    }
    const auto = this.autoTranslation();
    if (auto?.target === job.target) {
      return !sameTranslation(auto.source, source);
    }
    if (!isEmptyTranslation(target)) {
      return false;
    }
    const sourceAtEdit = this.sourceAtAuthorEdit()[job.target];
    return sourceAtEdit === undefined || !sameTranslation(sourceAtEdit, source);
  }

  /**
   * Asks the server to translate the source language and fills the result into the target language. The result is
   * dropped when the author changed the source or wrote in the target while waiting. A failure stays quiet, because the
   * server then sends the other language instead of an empty email.
   *
   * @param job the languages to translate from and into
   */
  private async translateMissingLanguage(job: TranslationJob): Promise<void> {
    const source = this.formModel()[job.source] ?? EMPTY_TRANSLATION;
    this.translatingInto.set(job.target);
    try {
      const result = await firstValueFrom(this.aiApi.translateEmailTemplate(job.target === 'german' ? 'de' : 'en', source));
      const current = this.formModel();
      if (!sameTranslation(current[job.source] ?? EMPTY_TRANSLATION, source) || !this.needsTranslation(current, job)) {
        return;
      }
      const translated: EmailTemplateTranslationDTO = {
        subject: result.subject ?? '',
        body: this.translateMentionsInHtml(result.body ?? ''),
      };
      this.formModel.set(job.target === 'german' ? this.withGerman(current, translated) : this.withEnglish(current, translated));
      this.autoTranslation.set({ target: job.target, source });
    } catch {
      this.failedTranslationSource.set(source);
    } finally {
      this.translatingInto.set(undefined);
    }
  }

  /**
   * Loads the user's AI consent, which decides whether the page may translate a missing language. Without it, the
   * page simply does not translate, so a failure needs no message.
   */
  private async loadAiConsent(): Promise<void> {
    try {
      this.aiConsent.set(await firstValueFrom(this.userApi.getAiConsent()));
    } catch {
      this.aiConsent.set(false);
    }
  }

  /**
   * Loads the customizable email types and the subset already customised by this research group.
   * Populates the dropdown options and the "taken" set used to hide duplicates.
   *
   * The dataset is bounded by the EmailType enum, so a single large-page request retrieves it all.
   */
  private async loadCustomizableEmailTypes(): Promise<void> {
    try {
      // 1) Fetch the merged overview list from the server (already filtered to customizable types).
      const page = await firstValueFrom(this.emailTemplateApi.getTemplates(0, ALL_TYPES_PAGE_SIZE));
      const allOverviews = page.content ?? [];

      // 2) Derive the set of all customizable types (de-duplicated).
      const customizableTypes = Array.from(
        new Set(allOverviews.map(o => o.emailType).filter((t): t is EmailTemplateDTOEmailTypeEnum => t !== undefined)),
      );

      // 3) Derive the set of types that already have a custom row for this research group.
      const alreadyCustomTypes = new Set(
        allOverviews
          .filter(o => o.isCustom === true)
          .map(o => o.emailType)
          .filter((t): t is EmailTemplateDTOEmailTypeEnum => t !== undefined),
      );

      this.customizableEmailTypes.set(customizableTypes);
      this.alreadyCustomEmailTypes.set(alreadyCustomTypes);
    } catch {
      this.toastService.showError({ detail: 'Failed to load email types' });
    }
  }

  private withEmailType(form: EmailTemplateDTO, emailType: EmailTemplateDTOEmailTypeEnum | undefined): EmailTemplateDTO {
    return {
      emailTemplateId: form.emailTemplateId,
      emailType,
      english: form.english,
      german: form.german,
    };
  }

  private withEnglish(form: EmailTemplateDTO, english: EmailTemplateTranslationDTO): EmailTemplateDTO {
    return {
      emailTemplateId: form.emailTemplateId,
      emailType: form.emailType,
      english,
      german: form.german,
    };
  }

  private withGerman(form: EmailTemplateDTO, german: EmailTemplateTranslationDTO): EmailTemplateDTO {
    return {
      emailTemplateId: form.emailTemplateId,
      emailType: form.emailType,
      english: form.english,
      german,
    };
  }

  /**
   * Re-renders the visible labels of every Quill mention span using the current language's translation
   * for the variable id. Returns a new template with both translations updated.
   *
   * @param form the current form model
   * @returns a new template with mention labels translated
   */
  private translateMentionsInTemplate(form: EmailTemplateDTO): EmailTemplateDTO {
    return {
      emailTemplateId: form.emailTemplateId,
      emailType: form.emailType,
      english: {
        subject: form.english?.subject ?? '',
        body: this.translateMentionsInHtml(form.english?.body ?? ''),
      },
      german: {
        subject: form.german?.subject ?? '',
        body: this.translateMentionsInHtml(form.german?.body ?? ''),
      },
    };
  }

  /**
   * Re-renders the visible label of every Quill mention span in one body with the current language's name for its variable.
   *
   * @param html the editor HTML of one body
   * @returns the HTML with translated mention labels
   */
  private translateMentionsInHtml(html: string): string {
    // 1) Parse the HTML so we can rewrite each mention span in place.
    const parser = new DOMParser();
    const parsed = parser.parseFromString(html, 'text/html');

    // 2) For each `.mention`, rewrite its data-value and inner label using the current translation.
    const mentionElements = parsed.querySelectorAll('.mention');
    mentionElements.forEach(mention => {
      const variableId = mention.getAttribute('data-id') ?? undefined;
      if (variableId === undefined || variableId === '') {
        return;
      }
      const translationKey = `researchGroup.emailTemplates.variables.${variableId}`;
      const translatedLabel = this.translate.instant(translationKey);
      mention.setAttribute('data-value', translatedLabel);
      const innerSpan = mention.querySelector('span[contenteditable="false"]');
      if (innerSpan) {
        innerSpan.innerHTML = `<span class="ql-mention-denotation-char">$</span>${translatedLabel}`;
      }
    });

    // 3) Serialise back to HTML.
    return parsed.body.innerHTML;
  }

  /**
   * Save callback invoked by the {@link AutoSaveController} when its debounce timer fires.
   * Updates an existing template when an id is present, otherwise creates a new one
   * and back-fills the assigned id.
   *
   * @returns `true` when the persist call succeeded, `false` otherwise so the controller
   *          can flip the badge to `FAILED`.
   */
  private async executeAutoSave(): Promise<boolean> {
    const form = this.formModel();
    // 1) Skip if no email type was picked yet — there is nothing meaningful to save.
    if (form.emailType === undefined) {
      return true;
    }

    try {
      // 2) Update if we already have an id, otherwise create and adopt the new id.
      if (form.emailTemplateId !== undefined) {
        await firstValueFrom(this.emailTemplateApi.updateTemplate(form));
      } else {
        const created = await firstValueFrom(this.emailTemplateApi.createTemplate(form));
        this.formModel.set({
          emailTemplateId: created.emailTemplateId,
          emailType: form.emailType,
          english: form.english,
          german: form.german,
        });
        this.skipNextAutosave = true;
      }
      // 3) Snapshot the saved state so subsequent diffs detect "unsaved changes" correctly.
      this.lastSavedSnapshot.set(this.formModel());
      return true;
    } catch {
      // 4) Surface a generic toast. The dropdown already prevents duplicate-type collisions;
      //    reaching this point is a rare race or non-UI client.
      this.toastService.showError({ detail: 'Autosave failed' });
      return false;
    }
  }

  /**
   * Loads an existing custom template by id and seeds the form, translating mentions to the current language.
   *
   * @param templateId the id of the custom template to load
   */
  private async load(templateId: string): Promise<void> {
    try {
      const fetched = await firstValueFrom(this.emailTemplateApi.getTemplate(templateId));
      const safeTemplate: EmailTemplateDTO = {
        emailTemplateId: fetched.emailTemplateId,
        emailType: fetched.emailType,
        english: fetched.english ?? EMPTY_TRANSLATION,
        german: fetched.german ?? EMPTY_TRANSLATION,
      };
      const translatedTemplate = this.translateMentionsInTemplate(safeTemplate);
      this.skipNextAutosave = true;
      this.formModel.set(translatedTemplate);
      this.lastSavedSnapshot.set(translatedTemplate);
      this.autoSave.setState(SavingStates.SAVED);
    } catch {
      this.toastService.showError({ detail: 'Failed to load template' });
    }
  }

  /**
   * Prefills the form using the system default content for the given email type.
   * Used when the user opens the editor with `?emailType=...` to start customising from the default.
   *
   * @param emailType the email type whose default content should be loaded
   */
  private async prefillFromDefault(emailType: EmailTemplateDTOEmailTypeEnum): Promise<void> {
    try {
      // 1) Find the overview row matching the requested email type.
      const page = await firstValueFrom(this.emailTemplateApi.getTemplates(0, ALL_TYPES_PAGE_SIZE));
      const allOverviews = page.content ?? [];
      const matchingOverview = allOverviews.find(o => o.emailType === emailType);
      if (!matchingOverview) {
        this.toastService.showError({ detail: 'Default template not found' });
        return;
      }
      // 2) Seed the form with the default content (no id, so the next save will create a new custom).
      const prefilled: EmailTemplateDTO = {
        emailType,
        english: matchingOverview.english ?? EMPTY_TRANSLATION,
        german: matchingOverview.german ?? EMPTY_TRANSLATION,
      };
      this.skipNextAutosave = true;
      this.formModel.set(this.translateMentionsInTemplate(prefilled));
      this.autoSave.setState(SavingStates.SAVED);
    } catch {
      this.toastService.showError({ detail: 'Failed to load default template' });
    }
  }
}
