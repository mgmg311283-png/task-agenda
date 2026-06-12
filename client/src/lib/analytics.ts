export interface AnalyticsEvent {
  name: string;
  timestamp: Date;
  properties?: Record<string, any>;
}

export interface Analytics {
  events: AnalyticsEvent[];
  sessionStart: Date;
  sessionEnd?: Date;
}

class AnalyticsTracker {
  private analytics: Analytics = {
    events: [],
    sessionStart: new Date(),
  };

  track(name: string, properties?: Record<string, any>): void {
    this.analytics.events.push({
      name,
      timestamp: new Date(),
      properties,
    });

    // Keep only last 100 events in memory
    if (this.analytics.events.length > 100) {
      this.analytics.events = this.analytics.events.slice(-100);
    }
  }

  trackTaskCreated(taskType: string): void {
    this.track('task_created', { taskType });
  }

  trackTaskCompleted(taskId: number, timeSpentMinutes?: number): void {
    this.track('task_completed', { taskId, timeSpentMinutes });
  }

  trackTaskDeleted(taskId: number): void {
    this.track('task_deleted', { taskId });
  }

  trackSearch(query: string, resultsCount: number): void {
    this.track('search', { query, resultsCount });
  }

  trackFilterApplied(filterType: string, filterValue: string): void {
    this.track('filter_applied', { filterType, filterValue });
  }

  trackModeEnabled(modeName: string): void {
    this.track('mode_enabled', { modeName });
  }

  getSessionStats() {
    const taskCreated = this.analytics.events.filter(e => e.name === 'task_created').length;
    const taskCompleted = this.analytics.events.filter(e => e.name === 'task_completed').length;
    const searchCount = this.analytics.events.filter(e => e.name === 'search').length;

    return {
      taskCreated,
      taskCompleted,
      searchCount,
      sessionDuration: new Date().getTime() - this.analytics.sessionStart.getTime(),
    };
  }

  getEvents() {
    return this.analytics.events;
  }
}

export const analytics = new AnalyticsTracker();
