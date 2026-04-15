import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { StaffActivityEvent } from '../../../types';

const PAGE_SIZE = 20;

export const useStaffActivity = (staffId: string) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['staff_activity', salonId, staffId],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase.rpc('get_staff_activity', {
        p_staff_id: staffId,
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return (data || []).map(
        (row: any): StaffActivityEvent => ({
          eventType: row.event_type,
          eventDate: row.event_date,
          description: row.description,
          clientName: row.client_name,
          metadata: row.metadata,
        }),
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    enabled: !!salonId && !!staffId,
  });

  return {
    events: data?.pages.flat() || [],
    isLoading,
    loadMore: fetchNextPage,
    hasMore: !!hasNextPage,
    isLoadingMore: isFetchingNextPage,
  };
};
