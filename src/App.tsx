import { useCallback, useEffect, useState } from 'react';
import { Home } from './components/Home';
import { RoomView } from './components/RoomView';
import { Solo } from './components/Solo';
import { isValidCode, loadMe, normalizeCode, saveMe, type Player } from './lib/identity';

type Route = { kind: 'home' } | { kind: 'solo' } | { kind: 'room'; code: string };

function parse(path: string): Route {
  const m = path.match(/^\/r\/([A-Za-z0-9]+)\/?$/);
  if (m) {
    const code = normalizeCode(m[1]);
    if (isValidCode(code)) return { kind: 'room', code };
  }
  if (path === '/solo') return { kind: 'solo' };
  return { kind: 'home' };
}

const CREATING_KEY = 'typerace:creating';

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.pathname));
  const [me, setMeState] = useState<Player>(() => loadMe());
  const setMe = useCallback((p: Player) => {
    setMeState(p);
    saveMe(p);
  }, []);

  const go = useCallback((path: string) => {
    window.history.pushState(null, '', path);
    setRoute(parse(path));
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(parse(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // "creating" survives only for the navigation that created the room; a
  // reload joins as a normal player (and becomes host again if alone).
  const creating = route.kind === 'room' && sessionStorage.getItem(CREATING_KEY) === route.code;
  useEffect(() => {
    if (route.kind !== 'room') sessionStorage.removeItem(CREATING_KEY);
  }, [route]);

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go('/')}>
          <span className="logo">⌨️</span> typerace
        </button>
        <div className="right">
          <span>{me.car}</span>
          <span>{me.name}</span>
        </div>
      </header>

      {route.kind === 'home' && (
        <Home
          me={me}
          setMe={setMe}
          onCreate={(code) => {
            sessionStorage.setItem(CREATING_KEY, code);
            go(`/r/${code}`);
          }}
          onJoin={(code) => go(`/r/${code}`)}
          onSolo={() => go('/solo')}
        />
      )}
      {route.kind === 'solo' && <Solo me={me} onLeave={() => go('/')} />}
      {route.kind === 'room' && (
        <RoomView key={route.code} code={route.code} creating={creating} me={me} setMe={setMe} onLeave={() => go('/')} />
      )}
    </div>
  );
}
