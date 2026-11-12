import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ImageResourceApi } from 'app/generated/api/image-resource-api';
import { ImageDTO } from 'app/generated/model/image-dto';
import { ToastService } from 'app/service/toast-service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { TranslateDirective } from 'app/shared/language';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { ProgressSpinnerComponent } from 'app/shared/components/atoms/progress-spinner/progress-spinner.component';
import { InfoBoxComponent } from 'app/shared/components/atoms/info-box/info-box.component';
import {
  ImageUploadButtonComponent,
  ImageUploadError,
} from 'app/shared/components/atoms/image-upload-button/image-upload-button.component';

const I18N_BASE = 'researchGroup.imageLibrary';

@Component({
  selector: 'jhi-research-group-images',
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    TranslateModule,
    TranslateDirective,
    ButtonComponent,
    ConfirmDialog,
    ProgressSpinnerComponent,
    InfoBoxComponent,
    ImageUploadButtonComponent,
  ],
  templateUrl: './research-group-images.component.html',
})
export class ResearchGroupImagesComponent {
  readonly allImages = signal<ImageDTO[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly selectedResearchGroupId = signal<string>('');
  readonly selectedResearchGroupName = signal<string>('');

  readonly totalImages = computed(() => this.allImages().length);

  readonly inUseImages = computed(() => this.allImages().filter(img => img.isInUse === true));

  readonly notInUseImages = computed(() => this.allImages().filter(img => img.isInUse !== true));

  readonly inUseCount = computed(() => this.inUseImages().length);
  readonly notInUseCount = computed(() => this.notInUseImages().length);

  private readonly imageApi = inject(ImageResourceApi);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    this.selectedResearchGroupId.set(this.route.snapshot.queryParamMap.get('researchGroupId') ?? '');
    this.selectedResearchGroupName.set(this.route.snapshot.queryParamMap.get('researchGroupName') ?? '');
    void this.loadImages();
  }

  /**
   * Load all images for the research group
   */
  async loadImages(): Promise<void> {
    try {
      this.isLoading.set(true);
      const researchGroupId = this.selectedResearchGroupId();
      const images = await firstValueFrom(
        researchGroupId === ''
          ? this.imageApi.getResearchGroupJobBanners()
          : this.imageApi.getResearchGroupJobBannersByResearchGroup(researchGroupId),
      );

      this.allImages.set(images);
    } catch {
      this.toastService.showErrorKey(`${I18N_BASE}.error.loadFailed`);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Handle successful image upload from the shared component
   */
  onImageUploaded(uploadedImage: ImageDTO): void {
    this.allImages.update(images => images.concat(uploadedImage));
    this.toastService.showSuccessKey(`${I18N_BASE}.success.imageUploaded`);
  }

  /**
   * Handle upload errors from the shared component
   */
  onUploadError(error: ImageUploadError): void {
    this.toastService.showErrorKey(error.errorKey);
  }

  uploadImage = (file: File): Observable<ImageDTO> => {
    const researchGroupId = this.selectedResearchGroupId();
    return researchGroupId === ''
      ? this.imageApi.uploadJobBanner(file)
      : this.imageApi.uploadJobBannerForResearchGroup(researchGroupId, file);
  };

  /**
   * Delete an image by ID
   */
  async deleteImage(imageId: string): Promise<void> {
    if (!imageId) {
      return;
    }

    try {
      await firstValueFrom(this.imageApi.deleteImage(imageId));
      this.allImages.update(images => images.filter(img => img.imageId !== imageId));
      this.toastService.showSuccessKey(`${I18N_BASE}.success.imageDeleted`);
    } catch {
      this.toastService.showErrorKey(`${I18N_BASE}.error.deleteFailed`);
    }
  }
}
