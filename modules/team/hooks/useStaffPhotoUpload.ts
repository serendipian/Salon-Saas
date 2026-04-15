import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useQueryClient } from '@tanstack/react-query';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function useStaffPhotoUpload() {
  const { activeSalon } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const uploadPhoto = async (staffId: string, file: File): Promise<string | null> => {
    if (!activeSalon) return null;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      addToast({ type: 'error', message: 'Format accepté : JPEG, PNG ou WebP' });
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      addToast({ type: 'error', message: 'La photo ne doit pas dépasser 2 Mo' });
      return null;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `staff/${staffId}/photo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path);

      const photoUrl = `${publicUrl}?t=${Date.now()}`;

      // Update the staff member record
      const { error: updateError } = await supabase
        .from('staff_members')
        .update({ photo_url: photoUrl })
        .eq('id', staffId)
        .eq('salon_id', activeSalon.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['staff_members', activeSalon.id] });
      addToast({ type: 'success', message: 'Photo mise à jour' });
      return photoUrl;
    } catch {
      addToast({ type: 'error', message: 'Impossible de mettre à jour la photo' });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadPhoto, isUploading };
}
