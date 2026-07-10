export type BookingStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'ACCEPTED'
  | 'IN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  /** Legacy compatibility only. New bookings must not enter this status. */
  | 'DIAGNOSTIC_DONE';

export type BookingRecipientType = 'SELF' | 'OTHER';

export interface ServiceRecipient {
  type: BookingRecipientType;
  fullName: string;
  phoneNumber: string;
  relationship?: string;
  email?: string;
  countryCode?: string;
  country?: string;
  city?: string;
  streetAddress?: string;
  notes?: string;
}

export const formatBookingStatus = (status: BookingStatus | string): string => {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'SCHEDULED':
      return 'Scheduled';
    case 'ACCEPTED':
      return 'Accepted';
    case 'IN_ROUTE':
      return 'On the way';
    case 'ARRIVED':
      return 'Arrived';
    case 'IN_PROGRESS':
    case 'DIAGNOSTIC_DONE':
      return 'In progress';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return String(status || 'Unknown');
  }
};
