import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const SANDBOX_ROOT = path.join(process.cwd(), 'sandbox');

// Ensure Sandbox root exists
if (!fs.existsSync(SANDBOX_ROOT)) {
  fs.mkdirSync(SANDBOX_ROOT, { recursive: true });
}

/**
 * Prepares the sandbox directory with files and runs a test/build command.
 * @param {string|number} missionId 
 * @param {Array<{filename: string, file_content: string}>} files 
 * @param {string} command 
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, success: boolean}>}
 */
export const runInSandbox = async (missionId, files, command) => {
  const missionDir = path.join(SANDBOX_ROOT, String(missionId));

  try {
    // 1. Recreate clean sandbox dir for this run
    if (fs.existsSync(missionDir)) {
      fs.rmSync(missionDir, { recursive: true, force: true });
    }
    fs.mkdirSync(missionDir, { recursive: true });

    // 2. Write files
    for (const file of files) {
      const filePath = path.join(missionDir, file.filename);
      const dirPath = path.dirname(filePath);
      
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(filePath, file.file_content, 'utf8');
    }

    // 3. Write a mock node_modules or standard package setup if it doesn't exist
    // If it's javascript and lacks package.json, we can run raw node.
    // If there is package.json, we can install dependencies (or mock them to speed up).
    // Let's check if the project has a package.json.
    const hasPackageJson = files.some(f => f.filename === 'package.json');
    
    // To speed up executions and make them self-contained without npm install during the demo,
    // we can bundle simple assertions or provide pre-installed node_modules in sandbox or write a mock script.
    // Let's support executing the command.
    
    return new Promise((resolve) => {
      // Set a 6-second timeout to prevent execution lockups
      const child = exec(command, { cwd: missionDir, timeout: 6000 }, (error, stdout, stderr) => {
        const exitCode = error ? (error.code || 1) : 0;
        
        resolve({
          stdout: stdout || '',
          stderr: stderr || (error ? error.message : ''),
          exitCode,
          success: exitCode === 0
        });
      });
    });

  } catch (error) {
    return {
      stdout: '',
      stderr: `Sandbox Setup Failure: ${error.message}`,
      exitCode: -1,
      success: false
    };
  }
};
