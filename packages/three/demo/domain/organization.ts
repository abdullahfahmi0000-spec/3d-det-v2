import type { O2CDataset, OrgNode, Person, ProcessStep, RaciAssignment, Task } from './o2c-types';

/** Organisation and process-definition lookups over the dataset. */

export function nodeByCode(dataset: O2CDataset, code: string): OrgNode | undefined {
  return dataset.nodes.find((node) => node.code === code);
}

/** Walks the reporting line up from `code` to the department it belongs to. */
export function departmentOf(dataset: O2CDataset, code: string): OrgNode | undefined {
  for (
    let node = nodeByCode(dataset, code);
    node;
    node = node.reportsTo ? nodeByCode(dataset, node.reportsTo) : undefined
  ) {
    if (node.type === 'DEPARTMENT') return node;
  }
  return undefined;
}

export function jobsOf(dataset: O2CDataset, departmentCode: string): OrgNode[] {
  return dataset.nodes.filter(
    (node) => node.type === 'JOB' && departmentOf(dataset, node.code)?.code === departmentCode,
  );
}

export function holderOf(dataset: O2CDataset, jobCode: string): Person | undefined {
  return dataset.persons.find((person) => person.jobCode === jobCode);
}

export function personById(dataset: O2CDataset, id: string): Person | undefined {
  return dataset.persons.find((person) => person.id === id);
}

export function isAgentJob(dataset: O2CDataset, jobCode: string): boolean {
  return dataset.uncoveredJobs.some(
    (job) => job.jobCode === jobCode && job.coveredByAgent === true,
  );
}

/** The job an AI agent covers, which is where the agent sits in the twin. */
export function agentJobCode(dataset: O2CDataset): string | undefined {
  return dataset.uncoveredJobs.find((job) => job.coveredByAgent === true)?.jobCode;
}

export function taskOf(dataset: O2CDataset, step: ProcessStep): Task {
  const task = dataset.tasks.find((candidate) => candidate.code === step.taskCode);
  if (!task) throw new Error(`Step ${step.step} refers to unknown task ${step.taskCode}`);
  return task;
}

export function raciOf(dataset: O2CDataset, taskCode: string): RaciAssignment | undefined {
  return dataset.raci.find((assignment) => assignment.taskCode === taskCode);
}

export function categoryName(dataset: O2CDataset, code: string): string {
  return dataset.taskCategories.find((category) => category.code === code)?.name ?? code;
}
