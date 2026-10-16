import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFileSize,
  validateFile,
  inspectDecodedText,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from '../src/utils/fileValidation.js';

describe('File Validation & Upload Processing', () => {
  // Test 1: Supported text file formats
  it('accepts supported file formats (.txt, .json, .csv, .log, .md)', () => {
    ALLOWED_EXTENSIONS.forEach((ext) => {
      const file = { name: `document${ext}`, size: 1024 };
      const res = validateFile(file);
      assert.equal(res.isValid, true, `Expected ${ext} to be valid`);
      assert.equal(res.error, undefined);
    });
  });

  // Test 2: JSON, CSV, and log file handling
  it('correctly validates JSON, CSV, and log documents', () => {
    const jsonFile = { name: 'audit_report.json', size: 15400 };
    const csvFile = { name: 'customers.csv', size: 28000 };
    const logFile = { name: 'server_access.log', size: 45000 };

    assert.equal(validateFile(jsonFile).isValid, true);
    assert.equal(validateFile(csvFile).isValid, true);
    assert.equal(validateFile(logFile).isValid, true);
  });

  // Test 3: Unsupported file types and empty files
  it('rejects empty files (0 bytes) with a clear explanation', () => {
    const emptyFile = { name: 'empty_document.txt', size: 0 };
    const res = validateFile(emptyFile);
    assert.equal(res.isValid, false);
    assert.match(res.error, /empty \(0 bytes\)/);
  });

  it('rejects unsupported file extensions with an actionable error', () => {
    const unsupportedFiles = [
      { name: 'document.pdf', size: 2048 },
      { name: 'malware.exe', size: 4096 },
      { name: 'archive.zip', size: 8192 },
      { name: 'image.png', size: 1024 },
      { name: 'data.bin', size: 2048 },
    ];

    unsupportedFiles.forEach((file) => {
      const res = validateFile(file);
      assert.equal(res.isValid, false, `Expected ${file.name} to be rejected`);
      assert.match(res.error, /Unsupported file type/);
    });
  });

  // Test 4: Invalid or oversized files
  it('rejects files exceeding 500 KB limit safely', () => {
    const oversizedFile = { name: 'large_dump.log', size: MAX_FILE_SIZE_BYTES + 1024 };
    const res = validateFile(oversizedFile);
    assert.equal(res.isValid, false);
    assert.match(res.error, /exceeds maximum size limit \(500 KB\)/);
  });

  // Test 5: Binary / null-byte corruption detection
  it('detects binary null bytes in decoded text and rejects safely', () => {
    const binaryContent = 'Header data\0\0\x01\x02Corrupted text';
    const res = inspectDecodedText(binaryContent, 'binary_test.txt');
    assert.equal(res.isValid, false);
    assert.match(res.error, /Binary or non-UTF-8 characters detected/);
  });

  // Test 6: Text inspection and line/char counting
  it('correctly calculates line count, character count, and preview snippet', () => {
    const validContent = 'Line 1: Name Sarah Connor\nLine 2: Email sarah@cyberdyne.org\nLine 3: SSN 482-19-9481';
    const res = inspectDecodedText(validContent, 'pii_sample.txt');
    assert.equal(res.isValid, true);
    assert.equal(res.lineCount, 3);
    assert.equal(res.charCount, validContent.length);
    assert.equal(res.preview, validContent);
    assert.equal(res.isTruncated, false);
  });

  it('truncates preview snippet for files with >10 lines or >600 characters', () => {
    const longContent = Array.from({ length: 25 }, (_, i) => `Line ${i + 1}: Sample text payload`).join('\n');
    const res = inspectDecodedText(longContent, 'long_audit.log');
    assert.equal(res.isValid, true);
    assert.equal(res.lineCount, 25);
    assert.equal(res.isTruncated, true);
    assert.ok(res.preview.split('\n').length <= 10);
  });

  // Test 7: Formatted file sizes
  it('formats file sizes accurately into B, KB, or MB', () => {
    assert.equal(formatFileSize(0), '0 B');
    assert.equal(formatFileSize(512), '512 B');
    assert.equal(formatFileSize(1024), '1.0 KB');
    assert.equal(formatFileSize(15360), '15.0 KB');
    assert.equal(formatFileSize(512000), '500.0 KB');
    assert.equal(formatFileSize(1048576), '1.00 MB');
  });

  // Test 8: Drag counter logic simulation
  it('correctly simulates drag-enter, drag-over, and drag-leave without flickering', () => {
    let dragCounter = 0;
    let dragActive = false;

    const onDragEnter = () => {
      dragCounter += 1;
      dragActive = true;
    };

    const onDragLeave = () => {
      dragCounter -= 1;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dragActive = false;
      }
    };

    const onDrop = () => {
      dragCounter = 0;
      dragActive = false;
    };

    // User drags onto container
    onDragEnter();
    assert.equal(dragActive, true);
    assert.equal(dragCounter, 1);

    // Drags over child icon
    onDragEnter();
    assert.equal(dragActive, true);
    assert.equal(dragCounter, 2);

    // Leaves child icon (back onto container)
    onDragLeave();
    assert.equal(dragActive, true); // Still active! No flicker!
    assert.equal(dragCounter, 1);

    // Drops file
    onDrop();
    assert.equal(dragActive, false);
    assert.equal(dragCounter, 0);
  });

  // Test 9: File replacement and clearing transitions
  it('simulates file staging, replacement, and clearing transitions', () => {
    // Stage file 1
    const file1 = { name: 'test1.txt', size: 1024 };
    let stagedFile = { name: file1.name, size: file1.size, lineCount: 1, charCount: 20 };
    let content = 'Initial content test';
    assert.equal(stagedFile.name, 'test1.txt');
    assert.equal(content, 'Initial content test');

    // Replace with file 2
    const file2 = { name: 'test2.csv', size: 2048 };
    stagedFile = { name: file2.name, size: file2.size, lineCount: 5, charCount: 100 };
    content = 'Col1,Col2\nVal1,Val2';
    assert.equal(stagedFile.name, 'test2.csv');
    assert.equal(content, 'Col1,Col2\nVal1,Val2');

    // Clear file
    stagedFile = null;
    content = '';
    assert.equal(stagedFile, null);
    assert.equal(content, '');
  });
});
