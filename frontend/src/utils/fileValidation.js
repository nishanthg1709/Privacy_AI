/**
 * PrivacyGuard AI - File Validation & Processing Utilities
 *
 * Rules:
 * - Allowed formats: .txt, .json, .csv, .log, .md
 * - Maximum file size: 500 KB (512,000 bytes)
 * - Safe rejection of empty (0 byte) files
 * - Binary file / null-byte detection for UTF-8 integrity
 */

export const ALLOWED_EXTENSIONS = ['.txt', '.json', '.csv', '.log', '.md'];
export const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB

/**
 * Format bytes into readable string (B, KB, MB)
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Validate a File object before reading
 *
 * @param {File|Object} file
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateFile(file) {
  if (!file) {
    return { isValid: false, error: 'No file provided.' };
  }

  // 1. Reject empty files
  if (file.size === 0) {
    return {
      isValid: false,
      error: `The selected file "${file.name}" is empty (0 bytes). Please upload a file containing text to scan.`,
    };
  }

  // 2. Reject oversized files
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File "${file.name}" exceeds maximum size limit (500 KB). Selected file is ${(file.size / 1024).toFixed(1)} KB. For optimal in-memory analysis, please split or reduce the document.`,
    };
  }

  // 3. Validate supported extensions
  const fileNameLower = (file.name || '').toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext));

  if (!hasValidExt) {
    const extMatch = fileNameLower.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : 'unknown';
    return {
      isValid: false,
      error: `Unsupported file type "${ext}". PrivacyGuard AI accepts plain-text documents (.txt, .json, .csv, .log, .md).`,
    };
  }

  return { isValid: true };
}

/**
 * Inspect decoded text content for binary bytes and format preview details
 *
 * @param {string} text - Decoded UTF-8 content
 * @param {string} fileName - Original filename
 * @returns {{ isValid: boolean, error?: string, lineCount?: number, charCount?: number, preview?: string, isTruncated?: boolean }}
 */
export function inspectDecodedText(text, fileName = 'document') {
  if (typeof text !== 'string') {
    return { isValid: false, error: `Unable to read "${fileName}" as text.` };
  }

  // Check for binary null characters
  if (text.includes('\0')) {
    return {
      isValid: false,
      error: `Binary or non-UTF-8 characters detected in "${fileName}". Please provide a plain-text document (.txt, .json, .csv, .log, .md).`,
    };
  }

  const lines = text.split(/\r\n|\r|\n/);
  const previewLines = lines.slice(0, 10).join('\n');
  const isTruncated = lines.length > 10 || text.length > 600;
  const previewSnippet = isTruncated && previewLines.length > 600 ? previewLines.slice(0, 600) : previewLines;

  return {
    isValid: true,
    lineCount: lines.length,
    charCount: text.length,
    preview: previewSnippet,
    isTruncated,
  };
}
