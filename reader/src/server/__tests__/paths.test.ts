import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { describe, it, expect } from 'vitest';
import { getContentPath } from '../paths';

describe('Server Path Utilities (stm-035)', () => {
  it('resolves the absolute path to the repository content directory', () => {
    const resolvedContentDirectory = getContentPath();
    expect(path.isAbsolute(resolvedContentDirectory)).toBe(true);
    expect(resolvedContentDirectory.endsWith('content')).toBe(true);
    expect(fs.existsSync(resolvedContentDirectory)).toBe(true);
  });

  it('resolves specific file subpaths within the content directory', () => {
    const readingStateFilePath = getContentPath('reading_state.json');
    const annotationsFilePath = getContentPath('annotations.json');

    expect(path.isAbsolute(readingStateFilePath)).toBe(true);
    expect(path.basename(readingStateFilePath)).toBe('reading_state.json');
    expect(readingStateFilePath).toContain(path.join('content', 'reading_state.json'));

    expect(path.isAbsolute(annotationsFilePath)).toBe(true);
    expect(path.basename(annotationsFilePath)).toBe('annotations.json');
    expect(annotationsFilePath).toContain(path.join('content', 'annotations.json'));
  });

  it('resolves nested subpaths correctly', () => {
    const nestedFilePath = getContentPath('nested', 'subfolder', 'target.json');
    expect(nestedFilePath).toContain(path.join('content', 'nested', 'subfolder', 'target.json'));
  });

  it('remains invariant when process.cwd() changes', () => {
    const initialWorkingDirectory = process.cwd();
    const baselinePath = getContentPath('reading_state.json');

    try {
      // Simulate running from reader subdirectory or parent directory
      const alternativeWorkingDirectory = path.resolve(initialWorkingDirectory, 'reader');
      if (fs.existsSync(alternativeWorkingDirectory)) {
        process.chdir(alternativeWorkingDirectory);
        const resolvedUnderDifferentDirectory = getContentPath('reading_state.json');
        expect(resolvedUnderDifferentDirectory).toBe(baselinePath);
      }
    } finally {
      process.chdir(initialWorkingDirectory);
    }
  });
});

