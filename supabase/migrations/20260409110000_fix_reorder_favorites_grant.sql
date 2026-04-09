-- Grant execute permission so PostgREST exposes the function to authenticated users
GRANT EXECUTE ON FUNCTION reorder_favorites(UUID, JSONB) TO authenticated;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
