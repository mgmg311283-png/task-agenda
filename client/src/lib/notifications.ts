export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number;
  action?: {
    label: string;
    callback: () => void;
  };
}

export class NotificationManager {
  private notifications: Map<string, Notification> = new Map();

  add(notification: Omit<Notification, 'id' | 'timestamp'>): string {
    const id = crypto.randomUUID();
    const fullNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
    };
    this.notifications.set(id, fullNotification);

    if (notification.duration) {
      setTimeout(() => this.remove(id), notification.duration);
    }

    return id;
  }

  remove(id: string): void {
    this.notifications.delete(id);
  }

  getAll(): Notification[] {
    return Array.from(this.notifications.values());
  }

  success(title: string, message: string, duration = 3000): string {
    return this.add({ type: 'success', title, message, duration });
  }

  error(title: string, message: string, duration = 5000): string {
    return this.add({ type: 'error', title, message, duration });
  }

  info(title: string, message: string, duration = 3000): string {
    return this.add({ type: 'info', title, message, duration });
  }

  warning(title: string, message: string, duration = 4000): string {
    return this.add({ type: 'warning', title, message, duration });
  }
}

export const notificationManager = new NotificationManager();
