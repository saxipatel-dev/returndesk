// Client-side form checks. They give quick feedback; the API validates everything again.

export const ACCEPTED_FILES = ".jpg,.jpeg,.png,.webp,.pdf";
export const MAX_FILE_MB = 5;

/** Client-side pre-check; the server re-validates type, content and size. */
export function checkFile(file) {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ACCEPTED_FILES.split(",").includes(ext)) return "Only JPG, PNG, WEBP and PDF files are allowed.";
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `Files must be ${MAX_FILE_MB} MB or smaller.`;
  return null;
}

export function validateRegistration(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = "Enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (form.password.length < 8) errors.password = "Use at least 8 characters.";
  else if (/^[a-zA-Z]+$/.test(form.password) || /^\d+$/.test(form.password))
    errors.password = "Mix letters with numbers or symbols.";
  if (form.confirm !== form.password) errors.confirm = "Passwords don't match.";
  return errors;
}

export function validateRequest(form, item, type) {
  const errors = {};
  const available = item
    ? type === "return"
      ? item.eligibility.returnable_quantity
      : item.eligibility.warranty_claimable_quantity
    : 0;
  if (!item) errors.purchase_item_id = "Choose the item you want to send back.";
  const qty = Number(form.quantity);
  if (!Number.isInteger(qty) || qty < 1) errors.quantity = "Enter a whole number of at least 1.";
  else if (item && qty > available) errors.quantity = `You can request at most ${available}.`;
  if (!form.reason) errors.reason = "Choose a reason.";
  if (!form.requested_resolution) errors.requested_resolution = "Choose what you'd like us to do.";
  if (form.description.trim().length < 10) errors.description = "Tell us a bit more (at least 10 characters).";
  return errors;
}

export function validateProduct(form, isNew) {
  const errors = {};
  if (isNew && !/^[A-Za-z0-9-]{2,40}$/.test(form.sku.trim())) errors.sku = "2–40 letters, numbers or dashes.";
  if (form.name.trim().length < 2) errors.name = "Enter a product name.";
  if (form.category.trim().length < 2) errors.category = "Enter a category.";
  const price = Number(form.price);
  if (form.price === "" || Number.isNaN(price) || price < 0) errors.price = "Enter a price of 0 or more.";
  else if (!/^\d+(\.\d{1,2})?$/.test(String(form.price))) errors.price = "Use at most two decimals.";
  const days = Number(form.warranty_days);
  if (!Number.isInteger(days) || days < 0 || days > 3650) errors.warranty_days = "Enter 0–3650 days.";
  return errors;
}

export function validateSettings(form) {
  const errors = {};
  if (form.store_name.trim().length < 2) errors.store_name = "Enter the store name.";
  if (!/^\S+@\S+\.\S+$/.test(form.support_email.trim())) errors.support_email = "Enter a valid email.";
  const days = Number(form.return_window_days);
  if (!Number.isInteger(days) || days < 1 || days > 365) errors.return_window_days = "Enter 1–365 days.";
  const files = Number(form.max_attachments_per_request);
  if (!Number.isInteger(files) || files < 0 || files > 20) errors.max_attachments_per_request = "Enter 0–20.";
  return errors;
}
