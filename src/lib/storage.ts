import { requireSupabase } from './supabase';

export const AVATAR_BUCKET = 'avatars';

function getFileExtension(filename: string) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'jpg';
}

export async function uploadAvatar(file: File, userId: string) {
  const supabase = requireSupabase();
  const extension = getFileExtension(file.name);
  const path = `${userId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
