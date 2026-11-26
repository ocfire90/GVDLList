import List from './pages/List.js';
import Leaderboard from './pages/Leaderboard.js';
import Roulette from './pages/Roulette.js';
import Account from './pages/Account.js';
import Player from './pages/Player.js';

export default [
    { path: '/', component: List },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/roulette', component: Roulette },
    { path: '/account', component: Account },
    { path: '/player/:username', component: Player },
    {
        path: '/platformer',
        component: List,
        props: { indexFile: '_platformer.json' },
    },
    {
        path: '/challenge',
        component: List,
        props: { indexFile: '_challenge.json' },
    },
    {
        path: '/created',
        component: List,
        props: { indexFile: '_created.json' },
    },
    {
        path: '/upcoming',
        component: List,
        props: { indexFile: '_upcoming.json' },
    },
];
