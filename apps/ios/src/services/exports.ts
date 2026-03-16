import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { zipSync } from 'fflate';
import { authedRequest } from '@/src/lib/authedRequest';
import { resolveApiUrl } from '@/src/lib/media';
import { sanitizeFileName } from '@/src/lib/format';
import api from '@/src/lib/api';
import { useAuthStore } from '@/src/stores/authStore';
import type { AlbumLicenseResponse, LicenseType, TrackLicenseResponse } from '@/src/types/domain';

function downloadHeaders() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function ensureExportsDirectory(folderName = 'myndral-exports') {
  const directory = new Directory(Paths.cache, folderName);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

async function shareFile(file: File, mimeType?: string) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, mimeType ? { mimeType } : undefined);
  }
}

async function downloadProtectedFile(url: string, fileName: string, directory: Directory) {
  const file = new File(directory, fileName);
  await File.downloadFileAsync(resolveApiUrl(url), file, {
    idempotent: true,
    headers: downloadHeaders(),
  });
  return file;
}

export async function grantTrackLicense(trackId: string, licenseType: LicenseType) {
  const response = await api.post<TrackLicenseResponse>(
    `/v1/export/track/${trackId}/license`,
    { licenseType },
    authedRequest(),
  );

  return response.data;
}

export async function grantAlbumLicense(albumId: string, licenseType: LicenseType) {
  const response = await api.post<AlbumLicenseResponse>(
    `/v1/export/album/${albumId}/license`,
    { licenseType },
    authedRequest(),
  );

  return response.data;
}

export async function shareTrackExport(trackId: string, title: string) {
  const license = await grantTrackLicense(trackId, 'personal');
  const directory = ensureExportsDirectory();
  const file = await downloadProtectedFile(
    license.downloadUrl,
    `${sanitizeFileName(title)}.mp3`,
    directory,
  );

  await shareFile(file, 'audio/mpeg');
}

export async function shareAlbumExport(albumId: string, title: string) {
  const license = await grantAlbumLicense(albumId, 'personal');
  const directory = ensureExportsDirectory(`myndral-export-${Date.now()}`);

  const archiveEntries: Record<string, Uint8Array> = {};
  for (const track of license.tracks) {
    const fileName = `${String(track.trackNumber).padStart(2, '0')} - ${sanitizeFileName(track.trackTitle)}.mp3`;
    const file = await downloadProtectedFile(track.downloadUrl, fileName, directory);
    archiveEntries[fileName] = await file.bytes();
  }

  const zipBytes = zipSync(archiveEntries);
  const zipFile = new File(directory, `${sanitizeFileName(title)}.zip`);
  zipFile.create({ overwrite: true, intermediates: true });
  zipFile.write(zipBytes);

  await shareFile(zipFile, 'application/zip');
}
