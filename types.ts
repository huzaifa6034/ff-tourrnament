
export type Screen = 'HOME' | 'WALLET' | 'PROFILE' | 'TOURNAMENT_DETAIL' | 'AUTH' | 'SIGNUP' | 'RESULT_UPLOAD' | 'ADMIN' | 'ADMIN_MATCHES';

export interface Tournament {
  id: string;
  title: string;
  type: string; // Solo, Duo, Squad
  entryFee: number;
  prizePool: number;
  perKill: number;
  startTime: string;
  slotsFull: number;
  totalSlots: number;
  map: string;
}

export interface User {
  uid: string;
  username: string;
  email?: string;
  password?: string;
  balance: number;
  matchesPlayed: number;
  totalEarnings: number;
  role?: 'admin' | 'player';
}

export interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  color: string;
}
