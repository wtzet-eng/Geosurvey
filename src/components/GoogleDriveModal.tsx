import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout, getAccessToken } from '../services/googleAuth';
import { listDriveReports, saveReportToDrive, deleteDriveFile, DriveFileItem } from '../services/googleDriveService';
import { SiteReport } from '../types';
import {
  HardDrive,
  CloudUpload,
  Trash2,
  ExternalLink,
  Loader2,
  LogOut,
  LogIn,
  CheckCircle2,
  AlertCircle,
  FileJson,
  X,
  RefreshCw
} from 'lucide-react';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentReport?: SiteReport | null;
  onLoadReport?: (report: SiteReport) => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  currentReport,
  onLoadReport
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen && user && token) {
      fetchFiles();
    }
  }, [isOpen, user, token]);

  const handleSignIn = async () => {
    setIsLoadingAuth(true);
    setStatusMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        setStatusMessage({ type: 'success', text: `Signed in as ${res.user.email}` });
        setTimeout(() => fetchFiles(), 300);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to sign in to Google Drive.' });
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setFiles([]);
    setStatusMessage(null);
  };

  const fetchFiles = async () => {
    setLoadingFiles(true);
    setStatusMessage(null);
    try {
      const list = await listDriveReports();
      setFiles(list);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to list reports from Drive.' });
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSaveCurrentReport = async () => {
    if (!currentReport) return;
    setSavingFile(true);
    setStatusMessage(null);
    try {
      const uploaded = await saveReportToDrive(currentReport);
      setStatusMessage({
        type: 'success',
        text: `Report "${uploaded.name}" saved to Google Drive!`
      });
      await fetchFiles();
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save report to Google Drive.' });
    } finally {
      setSavingFile(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await deleteDriveFile(fileId);
      setDeleteConfirmId(null);
      setStatusMessage({ type: 'success', text: 'File deleted from Google Drive.' });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete file from Google Drive.' });
    }
  };

  const handleDownloadAndLoad = async (file: DriveFileItem) => {
    if (!token) return;
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Could not download file content from Drive.');
      const data = await res.json();
      if (onLoadReport && data.report_data) {
        onLoadReport(data);
        onClose();
      } else {
        setStatusMessage({ type: 'error', text: 'Downloaded file is not a valid GeoSurvey report JSON.' });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Failed to parse report file from Drive.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>Google Drive Integration</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Cloud Sync
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Save & load evidence-based site audit reports directly from your Google Drive
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition hover:bg-slate-200/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-center gap-2 border font-medium ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span className="flex-1">{statusMessage.text}</span>
            </div>
          )}

          {/* User Auth Section */}
          {!user ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
              <div className="h-12 w-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto shadow-2xs text-slate-700">
                <HardDrive className="h-6 w-6 text-blue-600" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">Connect Your Google Account</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Sign in with Google to enable automatic cloud backup and sync for your site evaluation reports.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignIn}
                disabled={isLoadingAuth}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs transition active:scale-98"
              >
                {isLoadingAuth ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Sign in with Google</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'User'} className="h-9 w-9 rounded-full border border-blue-200" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                      {user.email?.[0].toUpperCase() || 'U'}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-900">{user.displayName || user.email}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{user.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchFiles}
                    disabled={loadingFiles}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition"
                    title="Refresh files"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingFiles ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-xs px-2.5 py-1 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 rounded-lg transition flex items-center gap-1 font-semibold"
                  >
                    <LogOut className="h-3 w-3" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

              {/* Upload Current Report Button */}
              {currentReport && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="space-y-0.5 text-center sm:text-left">
                    <span className="text-xs font-bold text-slate-900 block">Backup Active Site Report</span>
                    <span className="text-[11px] text-slate-500">
                      Save current parcel audit ({currentReport.location_name}) as JSON to your Google Drive
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveCurrentReport}
                    disabled={savingFile}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 shrink-0 active:scale-98"
                  >
                    {savingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
                    <span>{savingFile ? 'Uploading...' : 'Save Report to Drive'}</span>
                  </button>
                </div>
              )}

              {/* Files in Google Drive */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Saved Reports on Google Drive ({files.length})
                  </h4>
                  {loadingFiles && <span className="text-[10px] text-slate-400 font-mono animate-pulse">Syncing...</span>}
                </div>

                {files.length === 0 && !loadingFiles ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                    No GeoSurvey reports found in your Google Drive. Click &quot;Save Report to Drive&quot; to upload your first audit!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="p-3 bg-white rounded-xl border border-slate-200/80 hover:border-blue-300 transition flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileJson className="h-4 w-4 text-blue-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 block truncate" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(file.modifiedTime).toLocaleDateString()} · {file.size ? `${Math.round(Number(file.size) / 1024)} KB` : 'JSON'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {onLoadReport && (
                            <button
                              type="button"
                              onClick={() => handleDownloadAndLoad(file)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-semibold transition"
                            >
                              Load
                            </button>
                          )}
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
                              title="Open in Drive"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {deleteConfirmId === file.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDelete(file.id)}
                                className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-1.5 py-0.5 text-slate-500 text-[10px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(file.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Delete from Drive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Google Drive API v3 (REST)</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
