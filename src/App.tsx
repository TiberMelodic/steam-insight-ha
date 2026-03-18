import React, { useState, useEffect } from 'react';
import { Search, User, Clock, Gamepad2, AlertCircle, X, Trophy, Info, Loader2, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface SteamProfile {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatarfull: string;
  personastate: number;
  realname?: string;
  loccountrycode?: string;
  timecreated?: number;
}

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  playtime_2weeks?: number;
}

interface GameDetails {
  name: string;
  short_description: string;
  header_image: string;
  genres?: { description: string }[];
  release_date?: { date: string };
}

interface AchievementDetail {
  apiname: string;
  achieved: number;
  name: string;
  description: string;
  icon: string;
  icongray: string;
}

interface AchievementStats {
  achieved: number;
  total: number;
  list?: AchievementDetail[];
}

interface SearchRecord {
  steamid: string;
  personaname: string;
  avatar: string;
}

export default function App() {
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SteamProfile | null>(null);
  const [games, setGames] = useState<SteamGame[]>([]);
  const [allGames, setAllGames] = useState<SteamGame[]>([]);
  const [visibleGamesCount, setVisibleGamesCount] = useState(12);
  const [recentGames, setRecentGames] = useState<SteamGame[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchRecord[]>([]);

  // Modal State
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);
  const [gameDetails, setGameDetails] = useState<GameDetails | null>(null);
  const [achievements, setAchievements] = useState<AchievementStats | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const savedId = localStorage.getItem('steamId');
    if (savedId) {
      setSearchInput(savedId);
      fetchSteamData(savedId);
    }

    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse search history", e);
      }
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    await fetchSteamData(searchInput.trim());
  };

  const fetchSteamData = async (queryId: string) => {
    setLoading(true);
    setError(null);
    setProfile(null);
    setGames([]);
    setAllGames([]);
    setVisibleGamesCount(12);
    setRecentGames([]);

    try {
      let steamId = queryId;

      // Extract from URL if the user pasted a full link
      if (steamId.includes('steamcommunity.com/profiles/')) {
        const match = steamId.match(/profiles\/(\d{17})/);
        if (match) steamId = match[1];
      } else if (steamId.includes('steamcommunity.com/id/')) {
        const match = steamId.match(/id\/([^\/]+)/);
        if (match) steamId = match[1];
      }
      
      // Remove any trailing slashes just in case
      steamId = steamId.replace(/\/$/, '');

      // Check if it's a vanity URL or 64-bit ID
      if (!/^\d{17}$/.test(steamId)) {
        // Resolve vanity URL
        const resolveRes = await fetch(`/api/steam/resolve/${steamId}`);
        const resolveData = await resolveRes.json();
        
        if (resolveData.response?.success === 1) {
          steamId = resolveData.response.steamid;
        } else {
          throw new Error('无法解析 Steam ID。请检查您的自定义 URL 或 64 位 ID。');
        }
      }

      // Fetch Profile
      const profileRes = await fetch(`/api/steam/profile/${steamId}`);
      const profileData = await profileRes.json();
      
      if (!profileData.response?.players || profileData.response.players.length === 0) {
        throw new Error('未找到个人资料或资料已隐藏。');
      }
      
      setProfile(profileData.response.players[0]);
      
      // Save successful search to localStorage
      localStorage.setItem('steamId', queryId);

      // Update Search History
      const newRecord: SearchRecord = {
        steamid: profileData.response.players[0].steamid,
        personaname: profileData.response.players[0].personaname,
        avatar: profileData.response.players[0].avatarfull
      };
      setSearchHistory(prev => {
        const filtered = prev.filter(r => r.steamid !== newRecord.steamid);
        const updated = [newRecord, ...filtered].slice(0, 5); // Keep top 5
        localStorage.setItem('searchHistory', JSON.stringify(updated));
        return updated;
      });

      // Fetch Games
      const gamesRes = await fetch(`/api/steam/games/${steamId}`);
      const gamesData = await gamesRes.json();
      
      if (gamesData.response?.games) {
        const sortedGames = gamesData.response.games
          .sort((a: SteamGame, b: SteamGame) => b.playtime_forever - a.playtime_forever);
        setAllGames(sortedGames);
        setVisibleGamesCount(12);
        setGames(sortedGames.slice(0, 12));
      }

      // Fetch Recent Games
      const recentRes = await fetch(`/api/steam/recent/${steamId}`);
      const recentData = await recentRes.json();
      
      if (recentData.response?.games) {
        setRecentGames(recentData.response.games);
      }

    } catch (err: any) {
      setError(err.message || '获取数据时发生错误。');
    } finally {
      setLoading(false);
    }
  };

  const formatPlaytime = (minutes: number) => {
    const hours = (minutes / 60).toFixed(1);
    return `${hours} 小时`;
  };

  const getStatusColor = (state: number) => {
    switch (state) {
      case 1: return 'text-emerald-500'; // Online
      case 2: return 'text-amber-500'; // Busy
      case 3: return 'text-amber-500'; // Away
      case 4: return 'text-blue-500'; // Snooze
      case 5: return 'text-emerald-500'; // looking to trade
      case 6: return 'text-emerald-500'; // looking to play
      default: return 'text-zinc-400'; // Offline
    }
  };

  const getStatusText = (state: number) => {
    switch (state) {
      case 1: return '在线';
      case 2: return '忙碌';
      case 3: return '离开';
      case 4: return '打盹';
      case 5: return '寻求交易';
      case 6: return '寻求游戏';
      default: return '离线';
    }
  };

  const handleGameClick = async (game: SteamGame) => {
    setSelectedGame(game);
    setModalLoading(true);
    setGameDetails(null);
    setAchievements(null);

    try {
      // Fetch store details
      const detailsRes = await fetch(`/api/steam/game-details/${game.appid}`);
      const detailsData = await detailsRes.json();
      if (detailsData[game.appid]?.success) {
        setGameDetails(detailsData[game.appid].data);
      }

      // Fetch achievements
      if (profile?.steamid) {
        try {
          // Fetch schema for icons and descriptions
          const schemaRes = await fetch(`/api/steam/game-schema/${game.appid}`);
          const schemaData = await schemaRes.json();
          const schemaAchievements = schemaData.game?.availableGameStats?.achievements || [];

          const achRes = await fetch(`/api/steam/achievements/${profile.steamid}/${game.appid}`);
          const achData = await achRes.json();
          
          let playerAchievements: any[] = [];
          if (achData.playerstats?.success && achData.playerstats.achievements) {
            playerAchievements = achData.playerstats.achievements;
          }

          if (schemaAchievements.length > 0) {
            const total = schemaAchievements.length;
            let achievedCount = 0;
            
            const mergedList = schemaAchievements.map((schemaAch: any) => {
              const playerAch = playerAchievements.find((pa: any) => pa.apiname === schemaAch.name);
              const isAchieved = playerAch?.achieved === 1;
              if (isAchieved) achievedCount++;
              
              return {
                apiname: schemaAch.name,
                achieved: isAchieved ? 1 : 0,
                name: schemaAch.displayName,
                description: schemaAch.description,
                icon: schemaAch.icon,
                icongray: schemaAch.icongray
              };
            });

            // Sort: unlocked first
            mergedList.sort((a: any, b: any) => b.achieved - a.achieved);

            setAchievements({ total, achieved: achievedCount, list: mergedList });
          } else if (playerAchievements.length > 0) {
            // Fallback if schema fails but we have player stats
            const total = playerAchievements.length;
            const achieved = playerAchievements.filter((a: any) => a.achieved === 1).length;
            setAchievements({ total, achieved });
          }
        } catch (err) {
          console.error("Failed to fetch achievements", err);
        }
      }
    } catch (err) {
      console.error("Failed to fetch game details", err);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-50/80 dark:bg-zinc-950/80 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800 overflow-hidden transition-colors duration-300">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-blue-200/30 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
            x: [0, -60, 0],
            y: [0, 40, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-purple-200/30 blur-3xl"
        />
      </div>

      <main className="relative max-w-5xl mx-auto px-6 py-12 md:py-20 z-10">
        
        {/* Theme Toggle */}
        <div className="absolute top-6 right-6 md:top-8 md:right-8">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all hover:scale-105"
            aria-label="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent drop-shadow-sm">Steam 个人资料查看器</h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto text-lg">
            输入您的 Steam 自定义 URL 或 64 位 ID，查看您的个人资料统计、常玩游戏和近期活动。
          </p>
        </header>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-16 relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-zinc-400 w-5 h-5 z-10" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="例如：gaben 或 76561197960287930"
              className="w-full pl-12 pr-32 py-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-2 bottom-2 w-24 flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-medium shadow-md disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '搜索'}
            </button>
          </div>
        </form>

        {/* Search History */}
        {searchHistory.length > 0 && (
          <div className="max-w-xl mx-auto mb-12 flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">最近搜索:</span>
            {searchHistory.map((record) => (
              <button
                key={record.steamid}
                onClick={() => {
                  setSearchInput(record.steamid);
                  fetchSteamData(record.steamid);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm text-zinc-700 dark:text-zinc-300 shadow-sm"
              >
                <img src={record.avatar} alt={record.personaname} className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                <span>{record.personaname}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setSearchHistory([]);
                localStorage.removeItem('searchHistory');
              }}
              className="text-sm text-zinc-400 hover:text-red-500 transition-colors ml-2 px-2 py-1"
            >
              清空
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl mx-auto mb-12 p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl flex items-start gap-3 border border-red-100 dark:border-red-900/50"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </motion.div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-12 animate-pulse"
          >
            {/* Profile Skeleton */}
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700 rounded-[2rem] blur opacity-20"></div>
              <div className="relative bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-3xl p-6 md:p-10 shadow-xl border border-white/20 dark:border-zinc-800/50 flex flex-col md:flex-row items-center md:items-start gap-8">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-zinc-200 dark:bg-zinc-800 shrink-0"></div>
                <div className="flex-1 w-full flex flex-col items-center md:items-start">
                  <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-4"></div>
                  <div className="flex gap-4 mb-8">
                    <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md"></div>
                    <div className="h-5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-md"></div>
                  </div>
                  <div className="h-12 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
                </div>
              </div>
            </div>

            {/* Games Skeleton */}
            <div className="space-y-12">
              {/* Recent Games Skeleton */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800"></div>
                  <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white/40 dark:bg-zinc-900/40 p-5 rounded-3xl border border-white/20 dark:border-zinc-800/40 flex items-center gap-5">
                      <div className="w-16 h-16 rounded-xl bg-zinc-200 dark:bg-zinc-800 shrink-0"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-5 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-md"></div>
                        <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded-md"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Games Skeleton */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800"></div>
                  <div className="h-7 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="bg-white/30 dark:bg-zinc-900/30 p-4 rounded-2xl border border-white/20 dark:border-zinc-800/30 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded-md"></div>
                        <div className="h-3 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded-md"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Profile Content */}
        {profile && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            {/* Profile Card */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-[2rem] blur opacity-20 group-hover:opacity-30 transition duration-500"></div>
              <div className="relative bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl p-6 md:p-10 shadow-xl border border-white/20 dark:border-zinc-800/50 flex flex-col md:flex-row items-center md:items-start gap-8 transition-all">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-30"></div>
                  <img 
                    src={profile.avatarfull} 
                    alt={profile.personaname} 
                    className="relative w-32 h-32 md:w-40 md:h-40 rounded-2xl shadow-lg object-cover border-2 border-white/10"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-4xl font-bold tracking-tight mb-3 text-zinc-900 dark:text-zinc-100">{profile.personaname}</h2>
                  <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 md:gap-6 text-zinc-500 dark:text-zinc-400 mb-8">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full shadow-sm ${getStatusColor(profile.personastate).replace('text-', 'bg-')}`} />
                      <span className={`font-medium ${getStatusColor(profile.personastate)}`}>
                        {getStatusText(profile.personastate)}
                      </span>
                    </div>
                    {profile.realname && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{profile.realname}</span>
                      </div>
                    )}
                    {profile.loccountrycode && (
                      <div className="flex items-center gap-2">
                        <span>📍 {profile.loccountrycode}</span>
                      </div>
                    )}
                  </div>
                  
                  <a 
                    href={profile.profileurl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 dark:from-zinc-100 dark:to-zinc-200 dark:hover:from-white dark:hover:to-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl shadow-md transition-all hover:scale-105 hover:shadow-lg"
                  >
                    在 Steam 上查看
                  </a>
                </div>
              </div>
            </div>

            {/* Games Layout */}
            <div className="space-y-12">
              
              {/* Recent Games (Emphasized) */}
              {recentGames.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Clock className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                    <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">近期活动</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recentGames.map((game) => (
                      <div 
                        key={game.appid} 
                        onClick={() => handleGameClick(game)}
                        className="relative group cursor-pointer"
                      >
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl blur opacity-0 group-hover:opacity-20 transition duration-300"></div>
                        <div className="relative bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 dark:border-zinc-800/60 shadow-sm flex items-center gap-5 hover:-translate-y-1 transition-all">
                          <img 
                            src={`http://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`}
                            alt={game.name}
                            className="w-16 h-16 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-800 shadow-sm"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/game/64/64';
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{game.name}</h4>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{formatPlaytime(game.playtime_2weeks || 0)} 近期</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Games */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <Gamepad2 className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">常玩游戏</h3>
                </div>

                {allGames.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {allGames.slice(0, visibleGamesCount).map((game) => (
                        <div 
                          key={game.appid} 
                          onClick={() => handleGameClick(game)}
                          className="relative group cursor-pointer"
                        >
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-0 group-hover:opacity-15 transition duration-300"></div>
                          <div className="relative bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm p-4 rounded-2xl border border-white/40 dark:border-zinc-800/40 shadow-sm flex items-center gap-4 hover:bg-white/90 dark:hover:bg-zinc-800/90 hover:border-indigo-300/50 dark:hover:border-indigo-700/50 hover:shadow transition-all">
                            <img 
                              src={`http://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`}
                              alt={game.name}
                              className="w-12 h-12 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/game/64/64';
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{game.name}</h4>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{formatPlaytime(game.playtime_forever)} 总计</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {visibleGamesCount < allGames.length && (
                      <div className="mt-8 flex justify-center">
                        <button
                          onClick={() => setVisibleGamesCount(prev => prev + 12)}
                          className="px-6 py-2.5 bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shadow-sm"
                        >
                          显示更多 ({allGames.length - visibleGamesCount})
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm p-8 rounded-2xl border border-white/40 dark:border-zinc-800/40 text-center text-zinc-500 dark:text-zinc-400">
                    未找到游戏或个人资料已隐藏。
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </main>

      {/* Game Details Modal */}
      <AnimatePresence>
        {selectedGame && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedGame(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-zinc-100 dark:border-zinc-800"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedGame(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/20 dark:bg-white/20 hover:bg-black/40 dark:hover:bg-white/40 text-white dark:text-zinc-900 rounded-full backdrop-blur-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {modalLoading && !gameDetails ? (
                <div className="p-20 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500 dark:text-indigo-400 mb-4" />
                  <p className="font-medium">加载详细信息中...</p>
                </div>
              ) : (
                <div className="overflow-y-auto">
                  {/* Header Image */}
                  {gameDetails?.header_image ? (
                    <img 
                      src={gameDetails.header_image} 
                      alt={selectedGame.name} 
                      className="w-full h-48 sm:h-64 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 sm:h-64 bg-zinc-200 flex items-center justify-center">
                      <Gamepad2 className="w-12 h-12 text-zinc-400" />
                    </div>
                  )}

                  <div className="p-6 sm:p-8 space-y-8">
                    {/* Title & Playtime */}
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">
                        {gameDetails?.name || selectedGame.name}
                      </h2>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium">
                          <Clock className="w-4 h-4" />
                          总游玩时间: {formatPlaytime(selectedGame.playtime_forever)}
                        </span>
                        {gameDetails?.release_date?.date && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium">
                            发行日期: {gameDetails.release_date.date}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Achievements */}
                    {achievements && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400">
                            <Trophy className="w-5 h-5" />
                          </div>
                          <h3 className="font-semibold text-emerald-900 dark:text-emerald-400">成就进度</h3>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm font-medium text-emerald-800 dark:text-emerald-500">
                            <span>已解锁 {achievements.achieved} / {achievements.total}</span>
                            <span>{Math.round((achievements.achieved / achievements.total) * 100)}%</span>
                          </div>
                          <div className="w-full h-2 bg-emerald-200 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${(achievements.achieved / achievements.total) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Achievement Icons */}
                        {achievements.list && achievements.list.length > 0 && (
                          <div className="mt-6 grid grid-cols-5 sm:grid-cols-8 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {achievements.list.map((ach) => (
                              <div 
                                key={ach.apiname} 
                                className="group relative" 
                                title={`${ach.name}${ach.description ? `\n${ach.description}` : ''}`}
                              >
                                <img 
                                  src={ach.achieved ? ach.icon : ach.icongray} 
                                  alt={ach.name}
                                  className={`w-full aspect-square rounded-lg shadow-sm transition-all duration-300 ${ach.achieved ? 'hover:scale-110 hover:shadow-md' : 'opacity-40 grayscale dark:opacity-30'}`}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    {gameDetails?.short_description && (
                      <div>
                        <div className="flex items-center gap-2 mb-3 text-zinc-900 dark:text-zinc-100 font-semibold">
                          <Info className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                          <h3>关于游戏</h3>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: gameDetails.short_description }} />
                      </div>
                    )}

                    {/* Genres */}
                    {gameDetails?.genres && (
                      <div className="flex flex-wrap gap-2">
                        {gameDetails.genres.map((genre, idx) => (
                          <span key={idx} className="px-3 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full">
                            {genre.description}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
