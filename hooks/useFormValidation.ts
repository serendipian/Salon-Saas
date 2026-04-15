// hooks/useFormValidation.ts
import { useCallback, useState } from 'react';
import { ZodError, type ZodSchema } from 'zod';

interface ValidationResult<T> {
  errors: Record<string, string>;
  validate: (data: unknown) => T | null;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
}

export function useFormValidation<T>(schema: ZodSchema<T>): ValidationResult<T> {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(
    (data: unknown): T | null => {
      try {
        const result = schema.parse(data);
        setErrors({});
        return result;
      } catch (err) {
        if (err instanceof ZodError) {
          const fieldErrors: Record<string, string> = {};
          for (const issue of err.issues) {
            const key = issue.path.join('.');
            if (key && !fieldErrors[key]) {
              fieldErrors[key] = issue.message;
            }
          }
          setErrors(fieldErrors);
        }
        return null;
      }
    },
    [schema],
  );

  const clearErrors = useCallback(() => setErrors({}), []);

  const clearFieldError = useCallback(
    (field: string) =>
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }),
    [],
  );

  return { errors, validate, clearErrors, clearFieldError };
}
