/**
 * Form Validation Utilities
 * Reusable, composable validation functions for all forms.
 */

export const validators = {
  required: (value, field = 'This field') =>
    !value?.toString().trim() ? `${field} is required.` : null,

  minLength: (min) => (value, field = 'This field') =>
    value?.length < min ? `${field} must be at least ${min} characters.` : null,

  maxLength: (max) => (value, field = 'This field') =>
    value?.length > max ? `${field} must be no more than ${max} characters.` : null,

  email: (value) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !re.test(value) ? 'Please enter a valid email address.' : null;
  },

  password: (value) =>
    value?.length < 8 ? 'Password must be at least 8 characters.' : null,

  date: (value) => {
    if (!value) return 'Date is required.';
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Please enter a valid date.';
    if (d > new Date()) return 'Date cannot be in the future.';
    return null;
  },

  fileSize: (maxMB) => (file) => {
    if (!file) return null;
    const maxBytes = maxMB * 1024 * 1024;
    return file.size > maxBytes ? `Image must be smaller than ${maxMB}MB.` : null;
  },

  fileType: (file) => {
    if (!file) return null;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    return !allowed.includes(file.type) ? 'Only JPEG, PNG, WebP, or GIF images are allowed.' : null;
  },
};

/**
 * Validate a form's fields against a schema.
 * @param {object} values - { fieldName: value }
 * @param {object} schema - { fieldName: [validatorFn, ...] }
 * @returns {{ errors: object, isValid: boolean }}
 */
export const validateForm = (values, schema) => {
  const errors = {};
  for (const [field, rules] of Object.entries(schema)) {
    for (const rule of rules) {
      const error = rule(values[field], field);
      if (error) { errors[field] = error; break; }
    }
  }
  return { errors, isValid: Object.keys(errors).length === 0 };
};

/** Sanitize text to prevent XSS — strips HTML tags */
export const sanitize = (str) =>
  String(str || '').replace(/<[^>]*>/g, '').trim().slice(0, 2000);
