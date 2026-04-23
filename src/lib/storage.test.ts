import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_BUCKET, uploadAvatar } from './storage';

const uploadMock = vi.fn();
const getPublicUrlMock = vi.fn();
const fromMock = vi.fn();
const requireSupabaseMock = vi.fn();

vi.mock('./supabase', () => ({
  requireSupabase: () => requireSupabaseMock(),
}));

describe('uploadAvatar', () => {
  beforeEach(() => {
    uploadMock.mockReset().mockResolvedValue({ error: null });
    getPublicUrlMock.mockReset().mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/user-1/avatar.png' },
    });
    fromMock.mockReset().mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
    });
    requireSupabaseMock.mockReset().mockReturnValue({
      storage: {
        from: fromMock,
      },
    });
  });

  it('uploads the avatar into the avatar bucket and returns its public URL', async () => {
    const file = new File(['avatar'], 'profile.PNG', { type: 'image/png' });

    const publicUrl = await uploadAvatar(file, 'user-1');

    expect(fromMock).toHaveBeenCalledWith(AVATAR_BUCKET);
    expect(uploadMock).toHaveBeenCalledWith('user-1/avatar.png', file, {
      upsert: true,
      contentType: 'image/png',
    });
    expect(getPublicUrlMock).toHaveBeenCalledWith('user-1/avatar.png');
    expect(publicUrl).toBe('https://cdn.example.com/user-1/avatar.png');
  });

  it('falls back to a jpg extension and omits blank content types', async () => {
    const file = new File(['avatar'], 'profile', { type: '' });

    await uploadAvatar(file, 'user-2');

    expect(uploadMock).toHaveBeenCalledWith('user-2/avatar.jpg', file, {
      upsert: true,
      contentType: undefined,
    });
    expect(getPublicUrlMock).toHaveBeenCalledWith('user-2/avatar.jpg');
  });

  it('rethrows upload errors from supabase', async () => {
    const uploadError = new Error('Upload failed');
    uploadMock.mockResolvedValue({ error: uploadError });

    await expect(uploadAvatar(new File(['x'], 'broken.webp', { type: 'image/webp' }), 'user-3'))
      .rejects.toThrow('Upload failed');
  });
});
