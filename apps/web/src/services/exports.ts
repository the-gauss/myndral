import type { AlbumLicenseResponse, LicenseType, TrackLicenseResponse } from '../types'
import api from './api'

export async function grantTrackLicense(
  trackId: string,
  licenseType: LicenseType,
): Promise<TrackLicenseResponse> {
  const res = await api.post(`/v1/export/track/${trackId}/license`, { licenseType })
  return res.data
}

export async function grantAlbumLicense(
  albumId: string,
  licenseType: LicenseType,
): Promise<AlbumLicenseResponse> {
  const res = await api.post(`/v1/export/album/${albumId}/license`, { licenseType })
  return res.data
}

export async function downloadTrack(trackId: string, filename: string): Promise<void> {
  const res = await api.get(`/v1/export/track/${trackId}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
