import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function useAvatarUpload() {
  const { user, updateProfile } = useAuth();
  const { addToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const uploadAvatar = async (file: File) => {
    if (!user) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      addToast({ type: 'error', message: 'Format accepté : JPEG, PNG ou WebP' });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      addToast({ type: 'error', message: 'La photo ne doit pas dépasser 2 Mo' });
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path);

      // Append timestamp to bust cache
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: profileError } = await updateProfile({ avatar_url: avatarUrl });

      if (profileError) throw new Error(profileError);

      addToast({ type: 'success', message: 'Photo mise à jour' });
    } catch (_err) {
      addToast({ type: 'error', message: 'Impossible de mettre à jour la photo' });
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadAvatar, isUploading };
}
