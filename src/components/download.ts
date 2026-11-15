import type { ExportFile } from '../lib/exportData';

/** Save an export ({ filename, mimeType, content }) as a file download in the browser. */
export function saveFile(file: ExportFile): void {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
