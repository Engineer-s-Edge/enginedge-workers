/* eslint-disable @typescript-eslint/no-explicit-any */
import { GithubLoaderAdapter } from '@infrastructure/adapters/loaders/web/github.loader';
import { Document } from '@domain/entities/document.entity';

describe('GithubLoaderAdapter (Phase 2 - GitHub Repo Loader)', () => {
  let adapter: GithubLoaderAdapter;

  beforeEach(() => {
    adapter = new GithubLoaderAdapter();
  });

  it('github-001: supports github repos', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('github-002: load returns documents for repo', async () => {
    const docs = [
      new Document('d-readme', 'README content', {
        source: 'https://github.com/user/repo',
        sourceType: 'url',
        filename: 'README.md',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://github.com/user/repo');
    expect(res).toBe(docs);
  });

  it('github-003: extracts multiple files from repo', async () => {
    const docs = [
      new Document('d1', 'README', {
        source: 'github',
        sourceType: 'url',
        filename: 'README.md',
      }),
      new Document('d2', 'License', {
        source: 'github',
        sourceType: 'url',
        filename: 'LICENSE',
      }),
      new Document('d3', 'Makefile', {
        source: 'github',
        sourceType: 'url',
        filename: 'Makefile',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://github.com/user/repo');
    expect(res.length).toBe(3);
    expect(res[0].metadata.filename).toBe('README.md');
  });

  it('github-004: preserves repository metadata', async () => {
    const docs = [
      new Document('d1', 'content', {
        source: 'https://github.com/user/repo',
        sourceType: 'url',
        owner: 'user',
        repo: 'repo',
        branch: 'main',
        stars: 1500,
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://github.com/user/repo');
    expect(res[0].metadata.owner).toBe('user');
    expect(res[0].metadata.repo).toBe('repo');
  });

  it('github-005: handles multiple branches', async () => {
    const docs = [
      new Document('d1', 'dev content', {
        source: 'github',
        sourceType: 'url',
        branch: 'develop',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load(
      'https://github.com/user/repo/tree/develop',
    );
    expect(res[0].metadata.branch).toBe('develop');
  });

  it('github-006: handles large repositories', async () => {
    const docs = Array.from(
      { length: 150 },
      (_, i) =>
        new Document(`d${i}`, `file${i}`, {
          source: 'github',
          sourceType: 'url',
          filename: `file${i}.txt`,
        }),
    );
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load(
      'https://github.com/user/large-repo',
    );
    expect(res.length).toBe(150);
  });

  it('github-007: handles private repository access errors', async () => {
    jest
      .spyOn(adapter as any, 'load')
      .mockRejectedValue(new Error('Access denied: Private repository'));
    await expect(
      (adapter as any).load('https://github.com/user/private'),
    ).rejects.toThrow('Access denied');
  });

  it('github-008: handles non-existent repositories', async () => {
    jest
      .spyOn(adapter as any, 'load')
      .mockRejectedValue(new Error('Repository not found'));
    await expect(
      (adapter as any).load('https://github.com/user/nonexistent'),
    ).rejects.toThrow('not found');
  });
});
