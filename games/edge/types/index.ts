export interface Room {
  id: string;
  code: string;
  host_id: string;
  status: 'waiting' | 'playing' | 'finished';
  max_players: number;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  is_host: boolean;
  joined_at: string;
}

export interface RoomWithPlayers extends Room {
  players: Player[];
}

