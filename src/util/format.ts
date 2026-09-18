import {
  QUOTAS,
  TRAVEL_CLASSES,
  type Availability,
  type FareBreakdown,
  type LiveTrainStatus,
  type PnrStatus,
  type ScheduleStop,
  type Station,
  type Train,
  type TrainBetweenStations,
} from '../types.js';
import { WEEKDAY_NAMES, formatDuration } from './dates.js';

export const rupees = (amount: number): string =>
  `Rs ${amount.toLocaleString('en-IN')}`;

export function className(code: string): string {
  return TRAVEL_CLASSES[code as keyof typeof TRAVEL_CLASSES] ?? code;
}

export function quotaName(code: string): string {
  return QUOTAS[code as keyof typeof QUOTAS] ?? code;
}

export function runDays(runsOn: boolean[]): string {
  if (runsOn.every(Boolean)) return 'Daily';
  const active = WEEKDAY_NAMES.filter((_, i) => runsOn[i]);
  return active.length === 0 ? 'No scheduled days' : active.join(', ');
}

/** Render a simple markdown table. */
export function table(headers: string[], rows: string[][]): string {
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`;
  return [
    line(headers),
    line(headers.map(() => '---')),
    ...rows.map(line),
  ].join('\n');
}

export function formatStations(stations: Station[]): string {
  if (stations.length === 0) return 'No matching stations.';
  return table(
    ['Code', 'Station', 'State', 'Zone'],
    stations.map((s) => [s.code, s.name, s.state ?? '-', s.zone ?? '-']),
  );
}

export function formatTrainsBetween(
  results: TrainBetweenStations[],
  date: string,
): string {
  if (results.length === 0) return 'No direct trains found for this pair.';

  const rows = results.map((r) => [
    r.train.number,
    r.train.name,
    r.departure,
    r.arrival + (r.arrivalDayOffset > 0 ? ` (+${r.arrivalDayOffset}d)` : ''),
    formatDuration(r.durationMinutes),
    r.train.classes.join('/'),
    r.runsOnDate ? 'Yes' : 'No',
  ]);

  const header = table(
    ['Train', 'Name', 'Dep', 'Arr', 'Duration', 'Classes', `Runs ${date}`],
    rows,
  );

  const notRunning = results.filter((r) => !r.runsOnDate);
  const footer =
    notRunning.length > 0
      ? `\n\n${notRunning.length} of these do not run on ${date}. Weekly patterns: ${notRunning
          .map((r) => `${r.train.number} (${runDays(r.train.runsOn)})`)
          .join('; ')}.`
      : '';

  return header + footer;
}

export function formatSchedule(train: Train, stops: ScheduleStop[]): string {
  const head = [
    `**${train.number} ${train.name}** (${train.type})`,
    `${train.fromStationName} -> ${train.toStationName}`,
    `Runs: ${runDays(train.runsOn)}`,
    `Classes: ${train.classes.map((c) => `${c} (${className(c)})`).join(', ')}`,
    train.hasPantry === undefined ? null : `Pantry car: ${train.hasPantry ? 'yes' : 'no'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const body = table(
    ['#', 'Station', 'Arr', 'Dep', 'Halt', 'Km', 'Day', 'PF'],
    stops.map((s, i) => [
      String(i + 1),
      `${s.stationName} (${s.stationCode})`,
      s.arrival ?? '-',
      s.departure ?? '-',
      s.haltMinutes > 0 ? `${s.haltMinutes}m` : '-',
      String(s.distanceKm),
      String(s.day),
      s.platform ?? '-',
    ]),
  );

  return `${head}\n\n${body}`;
}

export function formatAvailability(a: Availability): string {
  const chance =
    a.confirmationChance === undefined
      ? ''
      : `\nEstimated chance of confirmation: ${Math.round(a.confirmationChance * 100)}%`;
  return [
    `**Train ${a.trainNumber} — ${className(a.travelClass)} (${a.travelClass}), ${quotaName(a.quota)} quota**`,
    `Journey date: ${a.date}`,
    `Status: **${a.statusText}**${a.count !== undefined ? ` (${a.count})` : ''}${chance}`,
  ].join('\n');
}

export function formatFare(f: FareBreakdown): string {
  const header = [
    `**Train ${f.trainNumber}, ${f.fromStationCode} -> ${f.toStationCode}**`,
    `${className(f.travelClass)} (${f.travelClass}), ${quotaName(f.quota)} quota${f.distanceKm ? `, ${f.distanceKm} km` : ''}`,
  ].join('\n');

  // Live providers quote one all-in fare with no component breakdown.
  const hasBreakdown =
    f.baseFare > 0 || f.reservationCharge > 0 || f.superfastCharge > 0 || f.gst > 0;
  if (!hasBreakdown) {
    return [
      header,
      '',
      `**Total per passenger: ${rupees(f.totalFare)}** (all-in fare as quoted upstream; component breakdown not provided).`,
    ].join('\n');
  }

  const rows: string[][] = [
    ['Base fare', rupees(f.baseFare)],
    ['Reservation charge', rupees(f.reservationCharge)],
  ];
  if (f.superfastCharge > 0) rows.push(['Superfast charge', rupees(f.superfastCharge)]);
  if (f.cateringCharge > 0) rows.push(['Catering', rupees(f.cateringCharge)]);
  if (f.dynamicSurcharge > 0) rows.push(['Dynamic/flexi surcharge', rupees(f.dynamicSurcharge)]);
  if (f.gst > 0) rows.push(['GST (5%)', rupees(f.gst)]);
  rows.push(['**Total per passenger**', `**${rupees(f.totalFare)}**`]);

  return [header, '', table(['Component', 'Amount'], rows)].join('\n');
}

export function formatPnr(p: PnrStatus): string {
  const head = [
    `**PNR ${p.pnr}** — ${p.trainNumber} ${p.trainName}`,
    `${p.fromStationName || p.fromStationCode} (${p.fromStationCode}) -> ${p.toStationName || p.toStationCode} (${p.toStationCode})`,
    `Journey date: ${p.journeyDate} | Class: ${p.travelClass} (${className(p.travelClass)}) | Quota: ${quotaName(p.quota)}`,
    `Chart: ${p.chartPrepared ? 'prepared' : 'not prepared yet'}`,
  ].join('\n');

  const body = table(
    ['Pax', 'Booking status', 'Current status'],
    p.passengers.map((pax) => [
      String(pax.serial),
      pax.bookingStatus,
      pax.currentStatus,
    ]),
  );

  const fare = p.ticketFare ? `\n\nTicket fare: ${rupees(p.ticketFare)}` : '';
  return `${head}\n\n${body}${fare}`;
}

export function formatLiveStatus(s: LiveTrainStatus, upcomingLimit = 8): string {
  const delay =
    s.delayMinutes > 0
      ? `Running **${formatDuration(s.delayMinutes)} late**`
      : s.delayMinutes < 0
        ? `Running ${formatDuration(-s.delayMinutes)} early`
        : 'Running **on time**';

  const head = [
    `**${s.trainNumber} ${s.trainName}** (started ${s.startDate})`,
    s.position,
    delay,
  ].join('\n');

  if (s.upcomingStations.length === 0) {
    return `${head}\n\nNo upcoming halts — the run has finished.`;
  }

  const body = table(
    ['Station', 'Sch. arr', 'Exp. arr', 'Delay', 'PF'],
    s.upcomingStations.slice(0, upcomingLimit).map((u) => [
      `${u.stationName} (${u.stationCode})`,
      u.scheduledArrival ?? '-',
      u.actualArrival ?? '-',
      u.delayMinutes > 0 ? `+${u.delayMinutes}m` : 'on time',
      u.platform ?? '-',
    ]),
  );

  const more =
    s.upcomingStations.length > upcomingLimit
      ? `\n\n${s.upcomingStations.length - upcomingLimit} further halts not shown.`
      : '';

  return `${head}\n\n**Upcoming halts**\n\n${body}${more}`;
}
