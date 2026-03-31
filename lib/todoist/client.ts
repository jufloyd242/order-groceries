import { TodoistApi } from '@doist/todoist-api-typescript';

function getClient(): TodoistApi {
  const token = process.env.TODOIST_API_TOKEN;
  if (!token) {
    throw new Error(
      'TODOIST_API_TOKEN is not set. Add it to your .env.local file.'
    );
  }
  return new TodoistApi(token);
}

/**
 * Fetch all Todoist projects and return the one matching the configured name.
 */
export async function findProjectByName(
  projectName?: string
) {
  const name =
    projectName || process.env.TODOIST_PROJECT_NAME || 'groceries';

  const api = getClient();
  const response = await api.getProjects();
  
  // The API returns { results: [...], nextCursor: ... }
  const projects = response.results || [];
  
  return projects.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? null;
}

/**
 * Fetch all active (incomplete) tasks from a specific project.
 */
export async function getProjectTasks(projectId: string) {
  const api = getClient();
  const response = await api.getTasks({ projectId });
  // The API returns { results: [...], nextCursor: ... }
  return response.results || [];
}

/**
 * Close (complete) a task in Todoist after it's been processed.
 */
export async function closeTask(taskId: string): Promise<void> {
  const api = getClient();
  await api.closeTask(taskId);
}

/**
 * High-level: Pull all grocery items from the configured Todoist project.
 * Returns the task contents as strings plus their Todoist task IDs.
 */
export async function pullGroceryItems(): Promise<
  Array<{ content: string; taskId: string }>
> {
  const project = await findProjectByName();
  if (!project) {
    throw new Error(
      `Todoist project "${process.env.TODOIST_PROJECT_NAME || 'groceries'}" not found. ` +
        'Check your TODOIST_PROJECT_NAME setting.'
    );
  }

  const tasks = await getProjectTasks(project.id);

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
export async function createTask(content: string): Promise<string> {
  const project = await findProjectByName();
  if (!project) {
    throw new Error(
      `Todoist project "${process.env.TODOIST_PROJECT_NAME || 'groceries'}" not found.`
    );
  }
  const api = getClient();
  const task = await api.addTask({
    content,
    projectId: project.id,
    labels: ['sgo_added'],
  });
  return task.id;
}
