import cron from 'node-cron';
import { logger } from '../logger/Logger';

interface ScheduledJob {
  id: string;
  name: string;
  expression: string;
  task: cron.ScheduledTask;
  module?: string;
  lastRun?: Date;
  runCount: number;
}

export class Scheduler {
  private jobs = new Map<string, ScheduledJob>();

  schedule(
    id: string,
    name: string,
    expression: string,
    handler: () => Promise<void>,
    module?: string
  ): void {
    if (this.jobs.has(id)) {
      this.cancel(id);
    }

    if (!cron.validate(expression)) {
      throw new Error(`Invalid cron expression: ${expression}`);
    }

    const task = cron.schedule(expression, async () => {
      const job = this.jobs.get(id);
      if (job) {
        job.lastRun = new Date();
        job.runCount++;
      }
      try {
        await handler();
      } catch (error) {
        logger.error(`Scheduler job "${name}" failed`, { id, error });
      }
    });

    this.jobs.set(id, { id, name, expression, task, module, runCount: 0 });
    logger.debug(`Scheduled job: ${name} (${expression})`, { id, module });
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    job.task.stop();
    this.jobs.delete(id);
    logger.debug(`Cancelled job: ${job.name}`, { id });
    return true;
  }

  cancelByModule(module: string): void {
    for (const [id, job] of this.jobs) {
      if (job.module === module) this.cancel(id);
    }
  }

  runOnce(id: string, name: string, delay: number, handler: () => Promise<void>, module?: string): NodeJS.Timeout {
    logger.debug(`One-shot job in ${delay}ms: ${name}`, { module });
    return setTimeout(async () => {
      try {
        await handler();
      } catch (error) {
        logger.error(`One-shot job "${name}" failed`, { error });
      }
    }, delay);
  }

  getJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  getJobsByModule(module: string): ScheduledJob[] {
    return Array.from(this.jobs.values()).filter(j => j.module === module);
  }

  stopAll(): void {
    for (const job of this.jobs.values()) job.task.stop();
    this.jobs.clear();
    logger.info('All scheduled jobs stopped');
  }
}

export const scheduler = new Scheduler();
