
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
                                <button @click="selected = i">
                                    <span class="type-label-lg">{{ ientry.user }}</span>
                                </button>
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
                        <table class="table">
                            <tr v-for="(item, index) in entry.completed"
                                :key="item.rank + '-' + item.type + '-' + index">
                                <td class="rank">
                                    <p>#{{ item.rank }}</p>
                                </td>
                                <td class="level">
                                    <a
                                        v-if="item.link"
                                        class="type-label-lg"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        :href="item.link"
                                    >{{ item.level }}</a>
                                    <span v-else class="type-label-lg">{{ item.level }}</span>
                                </td>
                                <td class="score">
                                    <span
                                        v-if="item.type === 'verifier'"
                                        class="achievement-label verifier-label"
                                    >Verifier</span>
                                    <span
                                        v-if="item.type === 'first-victor'"
                                        class="achievement-label first-victor-label"
                                    >First victor</span>
                                    <p>+{{ localize(item.score) }}</p>
                                </td>
                            </tr>
                        </table>

                        <h2 v-if="entry.progressed.length > 0">
                            Progressed ({{ entry.progressed.length }})
                        </h2>
                        <table class="table">
                            <tr v-for="item in entry.progressed" :key="item.rank + '-' + item.percent">
                                <td class="rank">
                                    <p>#{{ item.rank }}</p>
                                </td>
                                <td class="level">
                                    <a
                                        v-if="item.link"
                                        class="type-label-lg"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        :href="item.link"
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
        },
        computed: {
            entry() {
                return this.leaderboard[this.selected];
    },
},
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
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            this.leaderboard = [];
            this.err = ['Failed to load leaderboard. Please try again.'];
        } finally {
            this.loading = false;
        }
    },
};
