import { NavLink } from 'react-router-dom';
import { routeLabels } from '../appRoutes';
import type { AppRoute } from '../appRoutes';
import './styles/AppHeader.scss';

export function AppHeader() {
  return (
    <header className="top-strip">
      <div className="brand-lockup">
        <img
          src="https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=320&q=80"
          alt="医院走廊"
          className="brand-image"
        />
        <div>
          <p className="eyebrow">HIS Nursing Record</p>
          <h1>住院患者体温单</h1>
          <p className="subtitle">10天体温、脉搏、血压趋势与床旁录入</p>
        </div>
      </div>
      <nav className="route-tabs" aria-label="页面路由">
        {(Object.keys(routeLabels) as AppRoute[]).map((item) => (
          <NavLink
            className={({ isActive }) => (isActive ? 'route-tab active' : 'route-tab')}
            key={item}
            to={item}
          >
            {routeLabels[item]}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
