type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
};

/**
 * Blocking confirm built on the <dialog> in ConfirmDialog.astro. Focus is
 * trapped by the native dialog and returned to the trigger on close.
 */
export function confirmDanger(options: ConfirmOptions): Promise<boolean> {
  const dialog = document.getElementById("confirm-dialog") as HTMLDialogElement | null;
  if (!dialog) return Promise.resolve(window.confirm(options.message));

  const title = dialog.querySelector("[data-confirm-title]");
  const message = dialog.querySelector("[data-confirm-message]");
  const accept = dialog.querySelector<HTMLButtonElement>("[data-confirm-accept]");
  if (title) title.textContent = options.title;
  if (message) message.textContent = options.message;
  if (accept) accept.textContent = options.confirmLabel ?? "Delete";

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onAccept = () => {
      settle(true);
      dialog.close();
    };
    const onCancelClick = () => dialog.close();
    const onBackdrop = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };
    const onClose = () => settle(false);

    const cancels = Array.from(dialog.querySelectorAll<HTMLButtonElement>("[data-confirm-cancel]"));
    function cleanup() {
      accept?.removeEventListener("click", onAccept);
      for (const cancel of cancels) cancel.removeEventListener("click", onCancelClick);
      dialog?.removeEventListener("click", onBackdrop);
      dialog?.removeEventListener("close", onClose);
    }

    accept?.addEventListener("click", onAccept);
    for (const cancel of cancels) cancel.addEventListener("click", onCancelClick);
    dialog.addEventListener("click", onBackdrop);
    dialog.addEventListener("close", onClose);

    dialog.showModal();
    accept?.focus();
  });
}
