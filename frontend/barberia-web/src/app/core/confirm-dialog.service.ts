import { Injectable, signal } from '@angular/core';

/** Options for the shared confirmation modal. */
export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/**
 * Opens a branded confirmation dialog and resolves with the user choice.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly dialog = signal<ConfirmDialogOptions | null>(null);
  private resolveChoice: ((confirmed: boolean) => void) | null = null;

  /**
   * Shows the confirmation dialog.
   * @param options Dialog copy and style.
   */
  ask(options: ConfirmDialogOptions): Promise<boolean> {
    this.dialog.set({
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      danger: false,
      ...options,
    });

    return new Promise<boolean>((resolve) => {
      this.resolveChoice = resolve;
    });
  }

  /**
   * Closes the dialog with the selected result.
   * @param confirmed Whether the user confirmed the action.
   */
  close(confirmed: boolean): void {
    this.dialog.set(null);
    this.resolveChoice?.(confirmed);
    this.resolveChoice = null;
  }
}
