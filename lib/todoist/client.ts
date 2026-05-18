import { TodoistApi } from '@doist/todoist-api-typescript';

function getClient(token?: string): TodoistApi {
  const apiToken = token || process.env.TODOIST_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      'No Todoist token available. Link your Todoist account in Settings or set TODOIST_API_TOKEN in .env.local.'
    );
  }
  return new TodoistApi(apiToken);
}

/**
 * Fetch all Todoist projects and return the one matching the configured name.
 */
export async function findProjectByName(
  projectName?: string,
  token?: string
) {
  const name =
    projectName || process.env.TODOIST_PROJECT_NAME || 'groceries';

  const api = getClient(token);
  const response = await api.getProjects();
  
  // The API returns { results: [...], nextCursor: ... }
  const projects = response.results || [];
  
  return projects.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? null;
}

/**
 * Fetch all active (incomplete) tasks from a specific project.
 */
export async function getProjectTasks(projectId: string, token?: string) {
  const api = getClient(token);
  const response = await api.getTasks({ projectId });
  // The API returns { results: [...], nextCursor: ... }
  return response.results || [];
}

/**
 * Close (complete) a task in Todoist after it's been processed.
 */
export async function closeTask(taskId: string, token?: string): Promise<void> {
  const api = getClient(token);
  await api.closeTask(taskId);
}

/**
 * Reopen (uncomplete) a task in Todoist, e.g. when an item is removed from the cart.
 */
export async function reopenTask(taskId: string, token?: string): Promise<void> {
  const api = getClient(token);
  await api.reopenTask(taskId);
}

/**
 * High-level: Pull all grocery items from the configured Todoist project.
 * Returns the task contents as strings plus their Todoist task IDs.
 *
 * @param token - Per-user OAuth token (optional, falls back to env)
 * @param projectName - Project name override (optional)
 */
export async function pullGroceryItems(
  token?: string,
  projectName?: string
): Promise<
  Array<{ content: string; taskId: string }>
> {
  const project = await findProjectByName(projectName, token);
  if (!project) {
    const name = projectName || process.env.TODOIST_PROJECT_NAME || 'groceries';
    throw new Error(
      `Todoist project "${name}" not found. ` +
        'Check your project name in Settings.'
    );
  }

  const tasks = await getProjectTasks(project.id, token);

  return tasks
    .filter((t) => !t.completedAt)  // Task is incomplete if completedAt is null
    .map((t) => ({
      content: t.content,
      taskId: t.id,
    }));
}

/**
 * Create a new task in the grocery project tagged with the sgo_added label.
 * Returns the new task's ID.
 */
export async function createTask(content: string, token?: string, projectName?: string): Promise<string> {
  const project = await findProjectByName(projectName, token);
  if (!project) {
    const name = projectName || process.env.TODOIST_PROJECT_NAME || 'groceries';
    throw new Error(
      `Todoist project "${name}" not found.`
    );
  }
  const api = getClient(token);
  const task = await api.addTask({
    content,
    projectId: project.id,
    labels: ['sgo_added'],
  });
  return task.id;
}
