import { hasText } from 'app/shared/util/text.util';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { EMPTY, Observable, firstValueFrom } from 'rxjs';
import { BackButtonComponent } from 'app/shared/components/atoms/back-button/back-button.component';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { InfoBoxComponent } from 'app/shared/components/atoms/info-box/info-box.component';
import {
  ImageUploadButtonComponent,
  ImageUploadError,
} from 'app/shared/components/atoms/image-upload-button/image-upload-button.component';
import { SelectComponent } from 'app/shared/components/atoms/select/select.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { ImageDTO } from 'app/generated/model/image-dto';
import { ImageResourceApi } from 'app/generated/api/image-resource-api';
import { DepartmentResourceApi } from 'app/generated/api/department-resource-api';
import { DepartmentDTO } from 'app/generated/model/department-dto';
import { ToastService } from 'app/service/toast-service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';

interface DepartmentSelectOption {
  name: string;
  value: string | number;
}

@Component({
  selector: 'jhi-department-images',
  imports: [
    ButtonComponent,
    BackButtonComponent,
    TranslateDirective,
    TranslateModule,
    ConfirmDialog,
    InfoBoxComponent,
    ImageUploadButtonComponent,
    SelectComponent,
  ],
  templateUrl: './department-images.component.html',
})
export class DepartmentImages {
  readonly defaultImages = signal<ImageDTO[]>([]);
  readonly departments = signal<DepartmentDTO[]>([]);
  readonly selectedDepartment = signal<DepartmentSelectOption | undefined>(undefined);

  readonly departmentOptions = computed<DepartmentSelectOption[]>(() =>
    this.departments()
      .map(department => ({
        name: department.name ?? '',
        value: department.departmentId ?? '',
      }))
      .filter(option => option.value !== '' && option.name !== '')
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  readonly selectedDepartmentId = computed(() => String(this.selectedDepartment()?.value ?? ''));
  readonly canUpload = computed(() => this.selectedDepartmentId() !== '');
  readonly inUseImages = computed(() => this.defaultImages().filter(image => image.isInUse === true));
  readonly notInUseImages = computed(() => this.defaultImages().filter(image => image.isInUse !== true));

  private readonly imageApi = inject(ImageResourceApi);
  private readonly departmentApi = inject(DepartmentResourceApi);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly preselectedDepartmentId = signal<string>('');

  constructor() {
    this.preselectedDepartmentId.set(this.route.snapshot.queryParamMap.get('departmentId') ?? '');
    void this.loadDepartments();
  }

  async loadDepartments(): Promise<void> {
    try {
      const departments = await firstValueFrom(this.departmentApi.getDepartments());
      this.departments.set(departments);
      this.applyPreselectedDepartment();
    } catch {
      this.departments.set([]);
      this.toastService.showErrorKey('researchGroup.departments.images.error.loadDepartments');
    }
  }

  onDepartmentChange(selection: DepartmentSelectOption | undefined): void {
    this.selectedDepartment.set(selection);
    void this.loadDefaultImages();
  }

  async loadDefaultImages(): Promise<void> {
    const departmentId = this.selectedDepartmentId();
    if (departmentId === '') {
      this.defaultImages.set([]);
      return;
    }
    try {
      const images = await firstValueFrom(this.imageApi.getDefaultJobBanners(departmentId));
      this.defaultImages.set(images);
    } catch {
      this.defaultImages.set([]);
      this.toastService.showErrorKey('researchGroup.departments.images.error.loadImages');
    }
  }

  uploadDefaultImage = (file: File): Observable<ImageDTO> => {
    const departmentId = this.selectedDepartmentId();
    if (departmentId === '') {
      this.toastService.showErrorKey('researchGroup.departments.images.error.noDepartment');
      return EMPTY;
    }
    return this.imageApi.uploadDefaultJobBanner(departmentId, file);
  };

  onImageUploaded(uploadedImage: ImageDTO): void {
    this.defaultImages.update(images => images.concat(uploadedImage));
  }

  onUploadError(error: ImageUploadError): void {
    this.toastService.showErrorKey(error.errorKey);
  }

  async onDeleteImage(imageId: string | undefined): Promise<void> {
    if (!hasText(imageId)) {
      return;
    }

    try {
      await firstValueFrom(this.imageApi.deleteImage(imageId));
      this.defaultImages.update(images => images.filter(image => image.imageId !== imageId));
      this.toastService.showSuccessKey('researchGroup.departments.images.success.imageDeleted');
    } catch {
      this.toastService.showErrorKey('researchGroup.departments.images.error.deleteFailed');
    }
  }

  private applyPreselectedDepartment(): void {
    const departmentId = this.preselectedDepartmentId();
    if (departmentId === '' || this.selectedDepartmentId() !== '') {
      return;
    }

    const match = this.departmentOptions().find(option => option.value === departmentId);
    if (!match) {
      return;
    }

    this.selectedDepartment.set(match);
    void this.loadDefaultImages();
  }
}
