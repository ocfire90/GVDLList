import { fetchLeaderboard } from '../content.js';
import { localize } from '../util.js';
import { store } from '../main.js';

import Spinner from '../components/Spinner.js';

export default {
    components: {
        Spinner,
    },
    data: () => ({
        leaderboard: [],
        loading: true,
        selected: 0,
        err: [],
        store,
    }),
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-leaderboard-container">
            <div class="page-leaderboard">
                <div class="error-container">
                    <p class="error" v-if="err.length > 0">
                        Leaderboard may be incorrect, as the following levels could not be loaded: {{ err.join(', ') }}
                    </p>
                </div>
                <div class="board-container">
                    <table class="board">
                        <tr v-for="(ientry, i) in leaderboard" :key="ientry.user">
                            <td class="rank">
                                <p class="type-label-lg">#{{ i + 1 }}</p>
                            </td>
                            <td class="total">
                                <p class="type-label-lg">{{ localize(ientry.total) }}</p>
                            </td>
                            <td class="user" :class="{ 'active': selected == i }">
                                <button @click="selectPlayer(i)">
                                    <span class="type-label-lg">{{ ientry.user }}</span>
                                </button>
                                <router-link class="leaderboard-profile-link" :to="{ path: '/player/' + encodeURIComponent(ientry.user) }" @click.stop>Profile</router-link>
                            </td>
                        </tr>
                    </table>
                </div>
                <div class="player-container" v-if="entry">
                    <div class="player">
                        <h1>#{{ selected + 1 }} {{ entry.user }}</h1>
                        <h3>{{ localize(entry.total) }}</h3>

                        <h2 v-if="entry.completed.length > 0">
                            Completions ({{ entry.completed.length }})
                        </h2>
                        <table class="table records-table">
                            <tr
                                v-for="(item, index) in entry.completed"
                                :key="item.rank + '-' + item.type + '-' + index"
                                class="record-row"
                                :class="{
                                    'verification-record': item.type === 'verifier',
                                    'first-victor-record': item.type === 'first-victor',
                                    'completion-record': item.type !== 'verifier' && item.type !== 'first-victor'
                                }"
                            >
                                <td class="rank">
                                    <p>#{{ item.rank }}</p>
                                </td>
                                <td class="level">
                                    <div class="level-name-group">
                                        <a
                                            v-if="item.path"
                                            class="type-label-lg"
                                            :href="levelUrl(item)"
                                        >{{ item.level }}</a>
                                        <span v-else class="type-label-lg">
                                            {{ item.level }}
                                        </span>

                                        <span
                                            v-if="item.type === 'verifier'"
                                            class="achievement-label verifier-label"
                                        >Verifier</span>
                                        <span
                                            v-if="item.type === 'first-victor'"
                                            class="achievement-label first-victor-label"
                                        >First Victor</span>
                                    </div>
                                </td>
                                <td class="score">
                                    <p>+{{ localize(item.score) }}</p>
                                </td>
                            </tr>
                        </table>

                        <h2 v-if="entry.progressed.length > 0">
                            Progressed ({{ entry.progressed.length }})
                        </h2>
                        <table class="table records-table">
                            <tr
                                v-for="item in entry.progressed"
                                :key="item.rank + '-' + item.percent"
                                class="record-row progress-record"
                            >
                                <td class="rank">
                                    <p>#{{ item.rank }}</p>
                                </td>
                                <td class="level">
                                    <a
                                        v-if="item.path"
                                        class="type-label-lg"
                                        :href="levelUrl(item)"
                                    >{{ item.percent }}% {{ item.level }}</a>
                                    <span v-else class="type-label-lg">
                                        {{ item.percent }}% {{ item.level }}
                                    </span>
                                </td>
                                <td class="score">
                                    <p>+{{ localize(item.score) }}</p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    `,
    methods: {
        localize,

        selectPlayer(index) {
            this.selected = index;

            const user = this.leaderboard[index]?.user;

            if (user) {
                this.$router.replace({
                    query: {
                        ...this.$route.query,
                        player: user,
                    },
                });
            }
        },

        levelUrl(item) {
            const routes = {
                main: '/',
                created: '/created',
                challenge: '/challenge',
                platformer: '/platformer',
            };

            const route = routes[this.store.activeList] || '/';

            return `#${route}?level=${encodeURIComponent(item.path)}`;
        },

        selectPlayerFromRoute() {
            const player = this.$route.query.player;

            if (!player || !this.leaderboard.length) {
                return;
            }

            const index = this.leaderboard.findIndex(
                (item) => item.user.toLowerCase() === String(player).toLowerCase(),
            );

            if (index !== -1) {
                this.selected = index;
            }
        },
    },
    computed: {
        entry() {
            return this.leaderboard[this.selected];
        },
    },
    watch: {
        '$route.query.player'() {
            this.selectPlayerFromRoute();
        },
    },
    async mounted() {
        const listFiles = {
            main: '_list.json',
            created: '_created.json',
            challenge: '_challenge.json',
            platformer: '_platformer.json',
        };

        const indexFile = listFiles[store.activeList];

        if (!indexFile) {
            this.leaderboard = [];
            this.err = ['The leaderboard is unavailable for this list.'];
            this.loading = false;
            return;
        }

        try {
            const [leaderboard, err] = await fetchLeaderboard(indexFile);
            this.leaderboard = leaderboard;
            this.err = err;

            this.selectPlayerFromRoute();
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            this.leaderboard = [];
            this.err = ['Failed to load leaderboard. Please try again.'];
        } finally {
            this.loading = false;
        }
    },
};
