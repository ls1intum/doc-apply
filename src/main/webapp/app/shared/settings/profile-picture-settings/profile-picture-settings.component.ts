import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AccountService } from 'app/core/auth/account.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ImageResourceApi } from 'app/generated/api/image-resource-api';
import { UserResourceApi } from 'app/generated/api/user-resource-api';
import { ImageCropperComponent, ImageTransform } from 'ngx-image-cropper';
import { ToastService } from 'app/service/toast-service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { normalizeOptionalString } from 'app/shared/util/util';
import { firstValueFrom } from 'rxjs';

const CROP_CONTAINER_SIZE = 360;
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'jhi-profile-picture-settings',
  standalone: true,
  imports: [
    ButtonComponent,
    ConfirmDialog,
    DialogComponent,
    TranslateDirective,
    TranslateModule,
    FormsModule,
    FontAwesomeModule,
    UserAvatarComponent,
    ImageCropperComponent,
  ],
  templateUrl: './profile-picture-settings.component.html',
})
export class ProfilePictureSettingsComponent {
  fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  imageCropper = viewChild(ImageCropperComponent);

  readonly CROP_SIZE = CROP_CONTAINER_SIZE;

  cropDialogVisible = signal(false);
  selectedFile = signal<File | undefined>(undefined);
  imageLoaded = signal(false);
  cropTransform: ImageTransform = this.createDefaultTransform();

  /**
   * Resolves the display name used by the avatar fallback component.
   * Blank names are treated as absent values.
   *
   * @returns the normalized full name or undefined when no usable name is available
   */
  fullName = computed<string | undefined>(() => {
    const name = this.accountService.loadedUser()?.name.trim();
    return name === '' ? undefined : name;
  });

  /**
   * Returns the sanitized avatar URL currently stored for the signed-in user.
   * Blank values are normalized to null so the template can fall back to initials.
   *
   * @returns the normalized avatar URL or null when no avatar is set
   */
  currentProfilePictureUrl = computed<string | null>(() => normalizeOptionalString(this.accountService.loadedUser()?.avatar));

  private readonly accountService = inject(AccountService);
  private readonly imageApi = inject(ImageResourceApi);
  private readonly toastService = inject(ToastService);
  private readonly userApi = inject(UserResourceApi);

  onAddPictureClick(): void {
    this.fileInput().nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    this.loadFileForCrop(file);
    fileInput.value = '';
  }

  onCancel(): void {
    this.resetCropDialog();
  }

  /**
   * Removes the persisted avatar reference for the current user and clears the
   * cached avatar in the account state used by the application shell.
   *
   * @returns a promise that resolves after the removal request finishes
   */
  async onResetPicture(): Promise<void> {
    try {
      await firstValueFrom(this.userApi.updateAvatar({}));
      this.accountService.setAvatar(undefined);
      this.toastService.showSuccessKey('settings.profilePicture.deleted');
    } catch {
      this.toastService.showErrorKey('settings.profilePicture.deleteFailed');
    }
  }

  /**
   * Crops the current image through the cropper library, uploads the generated JPEG
   * and updates the in-memory avatar shown in the app shell.
   *
   * @returns a promise that resolves after the upload flow finishes
   */
  async onSave(): Promise<void> {
    const imageCropper = this.imageCropper();
    if (!imageCropper) return;
    const cropped = await imageCropper.crop('blob');
    if (!cropped) return;
    const blob = cropped.blob;
    if (!blob) return;

    try {
      const uploadedImage = await firstValueFrom(this.imageApi.uploadProfilePicture(blob));
      const avatarUrl = normalizeOptionalString(uploadedImage.url);
      if (avatarUrl === null) {
        this.toastService.showErrorKey('settings.profilePicture.saveFailed');
        return;
      }

      this.accountService.setAvatar(avatarUrl);
      this.toastService.showSuccessKey('settings.profilePicture.saved');
      this.resetCropDialog();
    } catch {
      this.toastService.showErrorKey('settings.profilePicture.saveFailed');
    }
  }

  onImageLoaded(): void {
    this.imageLoaded.set(true);
  }

  onTransformChange(transform: ImageTransform): void {
    this.cropTransform = this.normalizeTransform(transform);
  }

  onLoadImageFailed(): void {
    this.toastService.showErrorKey('settings.profilePicture.invalidFileType');
    this.resetCropDialog();
  }

  /**
   * Validates the selected file and opens the crop dialog. The cropper library
   * handles image loading, touch gestures and crop interactions.
   *
   * @param file the image file selected by the user
   * @returns void
   */
  private loadFileForCrop(file: File): void {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      this.toastService.showErrorKey('settings.profilePicture.fileTooLarge');
      return;
    }
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      this.toastService.showErrorKey('settings.profilePicture.invalidFileType');
      return;
    }
    this.selectedFile.set(file);
    this.imageLoaded.set(false);
    this.cropTransform = this.createDefaultTransform();
    this.cropDialogVisible.set(true);
  }

  /**
   * Restores the crop dialog to its initial state after cancel, save or load failure.
   *
   * @returns void
   */
  private resetCropDialog(): void {
    this.cropDialogVisible.set(false);
    this.selectedFile.set(undefined);
    this.imageLoaded.set(false);
    this.cropTransform = this.createDefaultTransform();
  }

  /**
   * Copies the cropper transform while forcing pixel-based translation values.
   *
   * @param transform the transform emitted by the cropper component
   * @returns the normalized transform with pixel-based translation units
   */
  private normalizeTransform(transform: ImageTransform): ImageTransform {
    return {
      scale: transform.scale,
      rotate: transform.rotate,
      flipH: transform.flipH,
      flipV: transform.flipV,
      translateH: transform.translateH,
      translateV: transform.translateV,
      translateUnit: 'px',
    };
  }

  /**
   * Creates the initial cropper transform with no rotation, scaling or translation applied.
   *
   * @returns the default cropper transform
   */
  private createDefaultTransform(): ImageTransform {
    return {
      scale: 1,
      rotate: 0,
      translateH: 0,
      translateV: 0,
      translateUnit: 'px',
    };
  }
}
