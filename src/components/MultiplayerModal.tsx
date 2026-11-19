import React, { useEffect, useState } from 'react';
import { Users, Plus, RefreshCw, X, Shield, Swords, Smartphone, Monitor, Tablet } from 'lucide-react';
import { MultiplayerSubMode, PlatformType, RoomSummary } from '../types/game';
import { platformLabel } from '../utils/platform';

interface MultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  platform: PlatformType;
  onJoinRoom: (roomCode: string) => void;
  onCreateRoom: (roomName: string, subMode: MultiplayerSubMode) => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  isOpen,
  onClose,
  playerName,
  platform,
  onJoinRoom,
  onCreateRoom,
}) => {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState(`Escuadrón de ${playerName || 'Operador'}`);
  const [subMode, setSubMode] = useState<MultiplayerSubMode>('coop');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const fetchRooms = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) throw new Error('Error al consultar salas');
      const data = await res.json();
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
    } catch {
      setError('No se pudo cargar la lista de salas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
      const iv = window.setInterval(fetchRooms, 4000);
      return () => window.clearInterval(iv);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const PlatformIcon = platform === 'mobile' ? Smartphone : platform === 'tablet' ? Tablet : Monitor;

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length < 3) {
      setError('Introduce un código de sala válido.');
      return;
    }
    onJoinRoom(cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-3xl bg-[#11161f] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d1118]">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold text-white tracking-wide">
              Salas Multijugador Multiplataforma
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
              <PlatformIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>{platformLabel(platform)}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-200 font-medium">{playerName}</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Create Room */}
          <div className="bg-[#161d28] border border-slate-800 rounded-lg p-5 flex flex-col gap-4">
            <h3 className="font-display text-base font-semibold text-white">Crear Nueva Sala</h3>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Nombre de la sala</label>
              <input
                type="text"
                maxLength={28}
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f15] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                placeholder="Ej. Fortaleza Norte"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Modalidad</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSubMode('coop')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                    subMode === 'coop'
                      ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                      : 'bg-[#0b0f15] border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Co-op Horda</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubMode('pvp')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                    subMode === 'pvp'
                      ? 'bg-red-500/15 border-red-400 text-red-300'
                      : 'bg-[#0b0f15] border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Swords className="w-4 h-4" />
                  <span>Arena PvP</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {subMode === 'coop'
                  ? 'Sobrevive junto a otros jugadores de PC y móvil contra oleadas de zombies sincronizadas.'
                  : 'Combate táctico todos contra todos con tu operador personalizado y arsenal completo.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onCreateRoom(roomName.trim() || 'Zona Cero', subMode)}
              className="mt-auto w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Crear y Entrar</span>
            </button>
          </div>

          {/* Right: Active Rooms & Join by Code */}
          <div className="bg-[#161d28] border border-slate-800 rounded-lg p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-white">Salas Activas</h3>
              <button
                type="button"
                onClick={fetchRooms}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>

            <form onSubmit={handleJoinByCode} className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Código (ej. A7K2)"
                className="flex-1 px-3.5 py-2 bg-[#0b0f15] border border-slate-700 rounded-lg text-sm font-mono-num text-white uppercase focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-600 transition-colors whitespace-nowrap"
              >
                Unirse
              </button>
            </form>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex-1 min-h-[180px] max-h-[240px] overflow-y-auto space-y-2 pr-1">
              {rooms.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-8 border border-dashed border-slate-700/80 rounded-lg">
                  <p className="text-sm text-slate-300 font-medium">No hay salas activas ahora mismo</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Crea una sala nueva y comparte el código de 4 letras con tus amigos.
                  </p>
                </div>
              ) : (
                rooms.map((r) => (
                  <div
                    key={r.code}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#0d121a] border border-slate-800 hover:border-slate-600 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-xs font-bold text-amber-400">{r.code}</span>
                        <span className="text-sm font-medium text-white truncate">{r.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>{r.subMode === 'coop' ? 'Co-op Horda' : 'Arena PvP'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">
                          {r.playerCount}/{r.maxPlayers} jugadores
                        </span>
                        {r.subMode === 'coop' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num">Oleada {r.wave}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onJoinRoom(r.code)}
                      className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      Entrar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
