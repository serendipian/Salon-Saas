-- Cleanup any legacy soft-deleted packs left over from before pack deletion
-- switched from soft-delete to hard-delete. Packs have no persistent FKs
-- outside pack_items (ON DELETE CASCADE), so this is safe. Idempotent: if
-- no rows match, the DELETE is a no-op.

DELETE FROM packs WHERE deleted_at IS NOT NULL;
