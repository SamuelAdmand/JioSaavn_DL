
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Music, Download, Play, Pause, SkipBack, SkipForward, Settings2, Loader2, X, Volume2, VolumeX, Volume1, Shuffle, Repeat, ListMusic } from 'lucide-react';
import { SaavnSong, Bitrate, DownloadItem } from './types';
import { searchSongs, formatDuration, downloadSong } from './services/saavnService';

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SaavnSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [bitrate, setBitrate] = useState<Bitrate>(Bitrate.B320);
  const [currentSong, setCurrentSong] = useState<SaavnSong | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloads, setDownloads] = useState<Record<string, DownloadItem>>({});
  const [showDownloads, setShowDownloads] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const performSearch = useCallback(async (searchQuery: string, searchPage: number = 1, append: boolean = false) => {
    if (!searchQuery) return;
    setLoading(true);
    setError(null);
    try {
      const songs = await searchSongs(searchQuery, searchPage);
      if (append) {
        setResults(prev => [...prev, ...songs]);
      } else {
        setResults(songs);
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load - removed hash check to prevent security errors
    performSearch('New Hits');
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    // Removed window.location.hash update
    setPage(1);
    performSearch(query, 1, false);
  };

  const handlePlay = (song: SaavnSong) => {
    if (currentSong?.id === song.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      setCurrentSong(song);
      setIsPlaying(true);
    }
  };

  const startDownload = async (song: SaavnSong) => {
    if (downloads[song.id] && downloads[song.id].status === 'Downloading') {
      return;
    }

    const downloadData = song.downloadUrl[bitrate] ||
      song.downloadUrl[Bitrate.B320] ||
      song.downloadUrl[Bitrate.B160] ||
      song.downloadUrl[song.downloadUrl.length - 1];

    if (!downloadData || !downloadData.link) {
      console.error("No download link found for song:", song.name);
      return;
    }

    // Set initial state
    setDownloads(prev => ({
      ...prev,
      [song.id]: {
        id: song.id,
        name: song.name,
        album: song.album,
        image: song.image[2]?.link || song.image[1]?.link,
        status: 'Downloading',
        size: downloadData.quality.toUpperCase(),
      }
    }));

    setShowDownloads(true);

    try {
      const { blobUrl, filename } = await downloadSong(song, downloadData.link);

      // Update state to done
      setDownloads(prev => ({
        ...prev,
        [song.id]: {
          ...prev[song.id],
          status: 'Done',
          downloadUrl: blobUrl
        }
      }));

      // Trigger automatic download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.warn("Enhanced download failed (likely CORS), falling back to direct link", err);
      // Fallback: Just try to open the link directly
      window.open(downloadData.link, '_blank');

      setDownloads(prev => ({
        ...prev,
        [song.id]: {
          ...prev[song.id],
          status: 'Done', // Mark as done since we handed it off to browser
          size: 'Direct',
        }
      }));
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-zinc-100 selection:bg-indigo-500/30">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/40 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
              <Music className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">JioSaavn DL</h1>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-lg group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What do you want to listen to?"
              className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-4 focus:outline-none focus:bg-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm font-medium placeholder:text-zinc-600"
            />
          </form>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 hover:bg-white/10 transition-colors">
              <Settings2 className="w-4 h-4 text-zinc-400" />
              <select
                value={bitrate}
                onChange={(e) => setBitrate(Number(e.target.value))}
                className="bg-transparent text-xs focus:outline-none cursor-pointer font-semibold text-zinc-300 uppercase tracking-wide"
              >
                <option value={Bitrate.B160} className="bg-zinc-900">160 kbps</option>
                <option value={Bitrate.B320} className="bg-zinc-900">320 kbps</option>
              </select>
            </div>
            <button
              onClick={() => setShowDownloads(true)}
              className="relative p-2.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:text-indigo-400 transition-colors group"
            >
              <Download className="w-5 h-5 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
              {Object.keys(downloads).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-500 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#09090b]">
                  {Object.keys(downloads).length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 pb-40">
        {loading && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
              <Loader2 className="relative w-16 h-16 text-indigo-500 animate-spin" />
            </div>
            <p className="text-zinc-400 font-medium tracking-wide animate-pulse">Searching the universe...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-red-500/10 rounded-full mb-4">
              <Music className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Search Results</h2>
                <p className="text-sm text-zinc-500">Found {results.length} songs for "{query || 'New Hits'}"</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {results.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  bitrate={bitrate}
                  isPlaying={currentSong?.id === song.id && isPlaying}
                  onPlay={() => handlePlay(song)}
                  onDownload={() => startDownload(song)}
                />
              ))}
            </div>
          </>
        )}

        {results.length > 0 && (
          <div className="mt-16 flex justify-center">
            <button
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                performSearch(query, nextPage, true);
              }}
              disabled={loading}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-semibold transition-all flex items-center gap-2 group disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListMusic className="w-4 h-4 text-zinc-400 group-hover:text-white" />}
              <span>Load More Songs</span>
            </button>
          </div>
        )}
      </main>

      {/* Persistent Player */}
      {currentSong && (
        <Player
          song={currentSong}
          bitrate={bitrate}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          audioRef={audioRef}
        />
      )}

      {/* Downloads Panel Overlay */}
      {showDownloads && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowDownloads(false)} />
          <div className="relative w-full max-w-md bg-[#121215] h-full shadow-2xl flex flex-col border-l border-white/5 animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <Download className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Downloads</h2>
                  <p className="text-xs text-zinc-500">Manage your offline tracks</p>
                </div>
              </div>
              <button onClick={() => setShowDownloads(false)} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {Object.keys(downloads).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
                  <div className="p-6 bg-white/5 rounded-full">
                    <Download className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="text-sm">No downloads yet</p>
                </div>
              ) : (
                (Object.values(downloads) as DownloadItem[]).map((item) => (
                  <div key={item.id} className="group bg-white/5 p-3 rounded-xl border border-white/5 flex items-center gap-4 hover:border-white/10 transition-colors">
                    <img src={item.image} alt="" className="w-14 h-14 rounded-lg object-cover shadow-lg" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate text-zinc-200">{item.name}</h3>
                      <p className="text-xs text-zinc-500 truncate">{item.album}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${item.status === 'Done' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          item.status === 'Downloading' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse' :
                            'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                          {item.status}
                        </span>
                        <span className="text-[10px] text-zinc-500">{item.size}</span>
                      </div>
                    </div>
                    {item.downloadUrl && (
                      <a
                        href={item.downloadUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                        title="Save to Device"
                      >
                        <Download className="w-4 h-4 text-white" />
                      </a>
                    )}
                    {item.status === 'Downloading' && (
                      <div className="p-2.5">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponents

interface SongCardProps {
  song: SaavnSong;
  bitrate: Bitrate;
  isPlaying: boolean;
  onPlay: () => void;
  onDownload: () => void;
}

const SongCard: React.FC<SongCardProps> = ({ song, bitrate, isPlaying, onPlay, onDownload }) => {
  const thumbnail = song.image[2]?.link || song.image[1]?.link;
  const artists = song.primaryArtists;

  return (
    <div className="group relative p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1">
      <div className="relative aspect-square mb-3 overflow-hidden rounded-xl shadow-lg bg-zinc-900">
        <img
          src={thumbnail}
          alt={song.name}
          loading="lazy"
          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500 ease-out"
        />
        {/* Hover Overlay */}
        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 flex items-center justify-center gap-3 ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(); }}
            className="w-12 h-12 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full flex items-center justify-center shadow-xl transform transition-transform hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause className="fill-current w-5 h-5" /> : <Play className="fill-current w-5 h-5 ml-1" />}
          </button>
        </div>

        {/* Top Right Duration Badge */}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-white/90">
          {formatDuration(song.duration)}
        </div>
      </div>

      <div className="space-y-1 px-1">
        <h3 className={`font-semibold truncate text-base ${isPlaying ? 'text-indigo-400' : 'text-zinc-100 group-hover:text-white'}`} title={song.name}>
          {song.name}
        </h3>
        <p className="text-sm text-zinc-400 truncate hover:text-zinc-300 transition-colors" title={artists}>
          {artists}
        </p>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
          <p className="text-xs text-zinc-500 truncate max-w-[70%]">{song.album}</p>
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            className="text-zinc-500 hover:text-indigo-400 transition-colors p-1"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface PlayerProps {
  song: SaavnSong;
  bitrate: Bitrate;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
}

const Player: React.FC<PlayerProps> = ({ song, bitrate, isPlaying, setIsPlaying, audioRef }) => {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioUrl = song.downloadUrl[bitrate]?.link || song.downloadUrl[4]?.link || song.downloadUrl[song.downloadUrl.length - 1]?.link;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      // Reset volume
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [song, bitrate, audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const curr = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      setCurrentTime(curr);
      setDuration(dur);
      setProgress((curr / dur) * 100 || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const seekTo = (Number(e.target.value) / 100) * audioRef.current.duration;
      audioRef.current.currentTime = seekTo;
      setProgress(Number(e.target.value));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = Number(e.target.value);
    setVolume(newVol);
    if (newVol > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#09090b]/90 backdrop-blur-2xl border-t border-white/10 px-4 py-3 md:px-6 md:py-4 transition-all duration-300">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">

        {/* Left: Song Info */}
        <div className="flex items-center gap-4 w-1/3 min-w-[140px]">
          <div className="relative group shrink-0">
            <img src={song.image[1].link} className="w-14 h-14 rounded-md object-cover shadow-lg border border-white/10 group-hover:opacity-80 transition-opacity" alt="" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <Music className="w-6 h-6 text-white drop-shadow-md" />
            </div>
          </div>
          <div className="min-w-0 overflow-hidden">
            <h4 className="font-bold text-sm text-white truncate hover:underline cursor-pointer">{song.name}</h4>
            <p className="text-xs text-zinc-400 truncate hover:text-zinc-300 cursor-pointer">{song.primaryArtists}</p>
          </div>
        </div>

        {/* Center: Controls & Progress */}
        <div className="flex flex-col items-center justify-center gap-2 flex-1 max-w-2xl">
          <div className="flex items-center gap-6">
            <button className="text-zinc-400 hover:text-white transition-colors" title="Shuffle">
              <Shuffle className="w-4 h-4" />
            </button>
            <button className="text-zinc-300 hover:text-white transition-colors active:scale-95" title="Previous">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button
              onClick={() => {
                if (isPlaying) {
                  audioRef.current?.pause();
                  setIsPlaying(false);
                } else {
                  audioRef.current?.play();
                  setIsPlaying(true);
                }
              }}
              className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
            >
              {isPlaying ? <Pause className="fill-current w-5 h-5" /> : <Play className="fill-current w-5 h-5 ml-1" />}
            </button>
            <button className="text-zinc-300 hover:text-white transition-colors active:scale-95" title="Next">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
            <button className="text-zinc-400 hover:text-white transition-colors" title="Repeat">
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full flex items-center gap-3 text-xs font-medium text-zinc-500">
            <span className="min-w-[40px] text-right text-zinc-300">{formatTime(currentTime)}</span>
            <div className="relative group flex-1 h-4 flex items-center cursor-pointer">
              {/* Track Background */}
              <div className="absolute left-0 right-0 h-1 bg-white/10 rounded-full group-hover:h-1.5 transition-all"></div>
              {/* Progress Fill */}
              <div
                className="absolute left-0 top-1.5 h-1 bg-indigo-500 rounded-full group-hover:h-1.5 transition-all"
                style={{ width: `${progress}%`, top: '50%', transform: 'translateY(-50%)' }}
              ></div>
              {/* Thumb (only on hover) */}
              <div
                className="absolute w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                style={{ left: `${progress}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
              ></div>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            </div>
            <span className="min-w-[40px] text-left">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Volume & Options */}
        <div className="flex items-center justify-end gap-3 w-1/3 min-w-[140px]">
          <div className="flex items-center gap-2 group/vol">
            <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : volume < 0.5 ? <Volume1 className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <div className="w-24 h-1 bg-white/10 rounded-full relative cursor-pointer overflow-hidden group-hover/vol:bg-white/20 transition-colors">
              <div
                className="absolute inset-y-0 left-0 bg-zinc-300 group-hover/vol:bg-indigo-400 transition-colors"
                style={{ width: `${isMuted ? 0 : volume * 100}%` }}
              ></div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="hidden lg:block w-px h-6 bg-white/10 mx-1"></div>

          <div className="text-[10px] font-bold text-indigo-400 px-2 py-1 bg-indigo-500/10 rounded border border-indigo-500/20 uppercase tracking-wider">
            {bitrate === Bitrate.B320 ? 'HQ' : 'SQ'}
          </div>
        </div>
      </div>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
};
