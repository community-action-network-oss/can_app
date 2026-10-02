import { ApiError } from '../../api/errors';
import type { MessageId } from '../../i18n';

/** Server schema_* codes -> message id. Undefined for any other error. */
export function schemaErrorId(e: unknown): MessageId | undefined {
  if (!(e instanceof ApiError)) return undefined;
  switch (e.code) {
    case 'schema_unknown':
    case 'schema_hash_mismatch':
      return 'form.version.newer';
    case 'schema_retired':
      return 'form.version.retired';
    case 'schema_migration_required':
      return 'form.version.migrate';
    default:
      return undefined;
  }
}
