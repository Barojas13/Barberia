import { Component, inject } from '@angular/core';
import { ConfirmDialogService } from './confirm-dialog.service';

/**
 * Global branded confirmation modal rendered from the app shell.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (confirm.dialog(); as dialog) {
      <div class="confirm-backdrop" (click)="confirm.close(false)" role="presentation">
        <div
          class="confirm-modal"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="'confirm-title'"
          [attr.aria-describedby]="'confirm-message'"
          (click)="$event.stopPropagation()"
        >
          <span class="eyebrow">Confirmación</span>
          <h2 id="confirm-title">{{ dialog.title }}</h2>
          <p id="confirm-message">{{ dialog.message }}</p>
          <div class="confirm-actions">
            <button type="button" class="button ghost" (click)="confirm.close(false)">
              {{ dialog.cancelLabel }}
            </button>
            <button
              type="button"
              class="button"
              [class.primary]="!dialog.danger"
              [class.danger]="dialog.danger"
              (click)="confirm.close(true)"
            >
              {{ dialog.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly confirm = inject(ConfirmDialogService);
}
