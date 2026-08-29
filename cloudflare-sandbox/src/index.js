import { getSandbox } from '@cloudflare/sandbox';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Only POST is supported', { status: 405 });
    }

    try {
      const { language, code } = await request.json();
      if (!code) {
        return new Response(JSON.stringify({ error: 'Code is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Simple runtime security validation
      const lang = (language || '').toLowerCase();
      if (lang !== 'javascript' && lang !== 'js' && lang !== 'node' && lang !== 'python' && lang !== 'py') {
        return new Response(JSON.stringify({ error: 'Unsupported language runtime' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Initialize the isolated container sandbox session
      const sessionId = `sb-${Date.now()}`;
      const sandbox = getSandbox(env.Sandbox, sessionId);

      // Write code block to the sandbox workspace file
      const filename = (lang === 'python' || lang === 'py') ? 'run.py' : 'run.js';
      const filepath = `/workspace/${filename}`;
      await sandbox.writeFile(filepath, code);

      // Execute code command with isolated resource limit controls and execution timeouts
      let runCmd = '';
      if (lang === 'python' || lang === 'py') {
        runCmd = `python3 ${filepath}`;
      } else {
        runCmd = `node ${filepath}`;
      }

      // Run execution with a timeout (e.g. 5000ms)
      const executionResult = await Promise.race([
        sandbox.exec(runCmd),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timed out')), 5000))
      ]);

      // Clean up sandbox workspace files
      try {
        await sandbox.exec(`rm -f ${filepath}`);
      } catch (e) {
        console.warn('Failed to clean up file:', e);
      }

      return new Response(JSON.stringify({
        success: executionResult.exitCode === 0,
        stdout: executionResult.stdout,
        stderr: executionResult.stderr,
        exitCode: executionResult.exitCode
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (err) {
      console.error('Sandbox Worker execution error:', err);
      return new Response(JSON.stringify({
        success: false,
        error: err.message || 'Sandbox execution error occurred',
        stdout: '',
        stderr: err.message || 'Execution error occurred',
        exitCode: -1
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
