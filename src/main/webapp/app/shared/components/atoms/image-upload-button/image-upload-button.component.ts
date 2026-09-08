import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Observable, firstValueFrom } from 'rxjs';
import { ImageResourceApi } from 'app/generated/api/image-resource-api';
import { ImageDTO } from 'app/generated/model/image-dto';
import { ProgressSpinnerComponent } from 'app/shared/components/atoms/progress-spinner/progress-spinner.component';

export interface ImageUploadConfig {
  maxFileSizeBytes?: number;
  maxImageDimensionPx?: number;
  acceptedTypes?: string[];
}

export interface ImageUploadError {
  type: 'fileTooLarge' | 'invalidFileType' | 'dimensionsTooLarge' | 'invalidImage' | 'uploadFailed';
  errorKey: string;
}

@Component({
  selector: 'jhi-image-upload-button',
  imports: [CommonModule, FontAwesomeModule, ProgressSpinnerComponent],
  templateUrl: './image-upload-button.component.html',
})
export class ImageUploadButtonComponent {
  // Inputs
  config = input<ImageUploadConfig>({});
  uploadFn = input<(_: File) => Observable<ImageDTO>>();

  // Outputs
  imageUploaded = output<ImageDTO>();
  uploadError = output<ImageUploadError>();

  // State
  readonly isUploading = signal<boolean>(false);

  // Services
  readonly imageApi = inject(ImageResourceApi);

  // Constants
  readonly DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  readonly DEFAULT_MAX_DIMENSION = 4096;
  readonly DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

  // Computed
  readonly acceptedImageTypes = computed(() => {
    const types = this.config().acceptedTypes ?? this.DEFAULT_ACCEPTED_TYPES;
    return types.join(',');
  });

  readonly containerClasses = computed(() => {
    // A button is inline-block and would shrink to its icon, so it is made to fill its grid cell like a div would.
    const base = 'block w-full relative rounded-lg transition-all';

    if (this.isUploading()) {
      return `${base} opacity-50 pointer-events-none`;
    }
    return `${base} cursor-pointer hover:shadow-lg hover:-translate-y-1`;
  });

  readonly innerClasses = computed(() => {
    const base = 'aspect-video border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all';
    const hover = !this.isUploading() ? 'hover:border-primary hover:bg-background-surface-alt' : '';
    return `${base} border-border-default ${hover}`.trim();
  });

  /**
   * Handle image file selection and upload
   */
  async onImageSelected(event: Event): Promise<void> {
    const fileInput: HTMLInputElement = event.target as HTMLInputElement;
    if (!fileInput.files || fileInput.files.length === 0) {
      return;
    }

    const file = fileInput.files[0];
    const maxSize = this.config().maxFileSizeBytes ?? this.DEFAULT_MAX_FILE_SIZE;
    const allowedTypes = this.config().acceptedTypes ?? this.DEFAULT_ACCEPTED_TYPES;
    const maxDimension = this.config().maxImageDimensionPx ?? this.DEFAULT_MAX_DIMENSION;

    // Validate file size
    if (file.size > maxSize) {
      this.uploadError.emit({
        type: 'fileTooLarge',
        errorKey: 'imageUpload.error.fileTooLarge',
      });
      fileInput.value = '';
      return;
    }

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      this.uploadError.emit({
        type: 'invalidFileType',
        errorKey: 'imageUpload.error.invalidFileType',
      });
      fileInput.value = '';
      return;
    }

    // Validate dimensions
    try {
      const dimensions = await this.getImageDimensions(file);
      if (dimensions.width > maxDimension || dimensions.height > maxDimension) {
        this.uploadError.emit({
          type: 'dimensionsTooLarge',
          errorKey: 'imageUpload.error.dimensionsTooLarge',
        });
        fileInput.value = '';
        return;
      }
    } catch {
      this.uploadError.emit({
        type: 'invalidImage',
        errorKey: 'imageUpload.error.invalidImage',
      });
      fileInput.value = '';
      return;
    }

    // Upload the image
    try {
      this.isUploading.set(true);
      const uploadObservable = this.uploadFn()?.(file) ?? this.imageApi.uploadJobBanner(file);
      const uploadedImage = await firstValueFrom(uploadObservable);
      this.imageUploaded.emit(uploadedImage);
    } catch {
      this.uploadError.emit({
        type: 'uploadFailed',
        errorKey: 'imageUpload.error.uploadFailed',
      });
    } finally {
      this.isUploading.set(false);
      fileInput.value = '';
    }
  }

  /**
   * Get the dimensions of an image file
   */
  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }
}
