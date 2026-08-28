import { runWorkspaceCommand } from './debugTools.js';
import { syncFilesToWorkspace } from './workspace.js';

/**
 * Compatibility wrapper. Execution happens only inside mission_<id> workspaces.
 */
export const runInSandbox = async (missionId, files, command) => {
  syncFilesToWorkspace(missionId, files || []);
  return runWorkspaceCommand(missionId, command);
};
