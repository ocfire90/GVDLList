import Home from './pages/Home.js';
import List from './pages/List.js';
import Leaderboard from './pages/Leaderboard.js';
import Roulette from './pages/Roulette.js';
import Account from './pages/Account.js';
import Player from './pages/Player.js';
import SubmitRecord from './pages/SubmitRecord.js';
import SubmitLevel from './pages/SubmitLevel.js';

export default [
    { path: '/', component: Home },
    { path: '/list', component: List },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/roulette', component: Roulette },
    { path: '/account', component: Account },
    { path: '/submit-record', component: SubmitRecord },
    { path: '/submit-level', component: SubmitLevel },
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
