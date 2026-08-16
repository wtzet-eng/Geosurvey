// Temporary compatibility shim for the Google Drive UI that was removed.
// App.tsx still contains a legacy <GoogleDriveModal /> reference. Defining
// a harmless no-op global keeps older builds from crashing at render time.
(globalThis as any).GoogleDriveModal = () => null;
