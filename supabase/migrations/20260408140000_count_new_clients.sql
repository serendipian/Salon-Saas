-- Returns the number of clients whose first-ever transaction falls within [p_from, p_to].
CREATE OR REPLACE FUNCTION count_new_clients(
  p_salon_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(new_clients bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*) AS new_clients
  FROM (
    SELECT client_id
    FROM transactions
    WHERE salon_id = p_salon_id
      AND client_id IS NOT NULL
    GROUP BY client_id
    HAVING MIN(date) >= p_from AND MIN(date) <= p_to
  ) sub;
$$;
