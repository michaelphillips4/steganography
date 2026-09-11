function setupDialog(triggerId, dialogId) {
    const trigger = document.getElementById(triggerId);
    const dialog = document.getElementById(dialogId);

    trigger.addEventListener("click", () => dialog.showModal());

    dialog.querySelectorAll("[data-close]").forEach(button => {
        button.addEventListener("click", () => dialog.close());
    });

    // Close when the backdrop (the dialog element itself) is clicked.
    dialog.addEventListener("click", event => {
        if (event.target === dialog) {
            dialog.close();
        }
    });
}

setupDialog("openHideDialog", "hideDialog");
setupDialog("openReadDialog", "readDialog");
