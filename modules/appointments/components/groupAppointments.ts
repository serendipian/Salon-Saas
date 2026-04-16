import type { Appointment } from '../../../types';

export interface ClientDayGroup {
  dayKey: string;
  dayAppts: Appointment[];
  clientGroups: Appointment[][];
}

/**
 * Bucket appointments by day (descending), then by client within each day.
 * Client groups are sorted by their earliest appointment time;
 * appointments within each group are chronological.
 */
export function groupByDayAndClient(appointments: Appointment[]): ClientDayGroup[] {
  const dayMap = new Map<string, Appointment[]>();

  for (const appt of appointments) {
    const d = new Date(appt.date);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const list = dayMap.get(dayKey) ?? [];
    list.push(appt);
    dayMap.set(dayKey, list);
  }

  const sortedDays = [...dayMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return sortedDays.map(([dayKey, dayAppts]) => {
    const clientMap = new Map<string, Appointment[]>();
    for (const appt of dayAppts) {
      const clientKey = appt.clientId || appt.id;
      const list = clientMap.get(clientKey) ?? [];
      list.push(appt);
      clientMap.set(clientKey, list);
    }

    const clientGroups = [...clientMap.values()].map((group) => {
      group.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return group;
    });

    clientGroups.sort((a, b) => new Date(a[0].date).getTime() - new Date(b[0].date).getTime());

    return { dayKey, dayAppts, clientGroups };
  });
}
