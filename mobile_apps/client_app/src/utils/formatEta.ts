import { EtaDisplay } from '../types/routing';

export const formatTravelTime = (durationSeconds: number): string => {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
};

export const formatEta = (durationSeconds: number, estimatedArrivalAt: string): EtaDisplay => {
  const arrival = new Date(estimatedArrivalAt);
  return {
    travelTime: formatTravelTime(durationSeconds),
    arrivalTime: Number.isNaN(arrival.getTime())
      ? ''
      : `Arriving around ${arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
  };
};
