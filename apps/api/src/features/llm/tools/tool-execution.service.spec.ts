import { ToolExecutionService } from './tool-execution.service';

describe('ToolExecutionService', () => {
  let service: ToolExecutionService;

  beforeEach(() => {
    service = new ToolExecutionService();
  });

  it('executes allowlisted get_current_time with default UTC and valid timezone', () => {
    const utcResult = service.execute('get_current_time', {});
    expect(utcResult.status).toBe('completed');
    expect(utcResult.result?.timezone).toBe('UTC');
    expect(typeof utcResult.result?.iso).toBe('string');

    const vnResult = service.execute('get_current_time', {
      timezone: 'Asia/Ho_Chi_Minh',
    });
    expect(vnResult.status).toBe('completed');
    expect(vnResult.result?.timezone).toBe('Asia/Ho_Chi_Minh');
  });

  it('rejects invalid timezone or unexpected arguments for get_current_time', () => {
    const badTz = service.execute('get_current_time', {
      timezone: 'Mars/Olympus',
    });
    expect(badTz.status).toBe('rejected');
    expect(badTz.error).toContain('Invalid IANA timezone');

    const extraArg = service.execute('get_current_time', {
      timezone: 'UTC',
      shellCmd: 'whoami',
    });
    expect(extraArg.status).toBe('rejected');
    expect(extraArg.error).toContain('Unexpected argument');
  });

  it('executes allowlisted count_words accurately and rejects invalid arguments', () => {
    const ok = service.execute('count_words', {
      text: 'Nexa Chat\nhọc LLM Engineering',
    });
    expect(ok.status).toBe('completed');
    expect(ok.result).toEqual({
      wordCount: 5,
      charCount: 29,
      lineCount: 2,
    });

    const missing = service.execute('count_words', {});
    expect(missing.status).toBe('rejected');
    expect(missing.error).toContain('must be a string');
  });

  it('strictly rejects non-allowlisted tools', () => {
    const rejected = service.execute('delete_database', { confirm: true });
    expect(rejected.status).toBe('rejected');
    expect(rejected.error).toContain('not in the backend allowlist');
  });
});
