import { getAccessToken } from './googleAuth';
import { SiteReport } from '../types';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
}

export async function listDriveReports(): Promise<DriveFileItem[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please sign in with Google to access Drive.');
  }

  // Search for files created or containing LandAudit or GeoReport in properties/name
  const query = "name contains 'GeoSurvey' or name contains 'LandAudit' or mimeType = 'application/json' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink)&pageSize=30&orderBy=modifiedTime desc`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to list files from Drive (${response.status})`);
  }

  const data = await response.json();
  return data.files || [];
}

export async function saveReportToDrive(report: SiteReport): Promise<{ id: string; name: string; webViewLink?: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please sign in with Google.');
  }

  const parcelId = report.report_data.technical_parameters?.cadastral_parcel_id || 'Parcel';
  const cleanParcel = parcelId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `GeoSurvey_Report_${cleanParcel}_${new Date().toISOString().split('T')[0]}.json`;

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: `European Land Evaluation Audit for ${report.location_name} (Parcel: ${parcelId})`
  };

  const fileContent = JSON.stringify(report, null, 2);

  // Multipart upload to Google Drive v3
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to upload report to Drive (${res.status})`);
  }

  return await res.json();
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated.');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to delete file (${res.status})`);
  }
}
