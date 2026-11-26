import { fetchLeaderboard } from '../content.js';
import { localize } from '../util.js';
import { store, supabase } from '../main.js';
import Spinner from '../components/Spinner.js';

export default {
    components: { Spinner },

    data: () => ({
        leaderboard: [],
        loading: true,
        selectedUser: '',
        search: '',
        profile: null,
        profileLoading: false,
        profileError: '',
        profileRequest: 0,
        err: [],
        store,
    }),

    computed: {
        filteredLeaderboard() {
            const query = this.search.trim().toLowerCase();
            if (!query) return this.leaderboard;
            return this.leaderboard.filter(item =>
                item.user.toLowerCase().includes(query)
            );
        },

        entry() {
            return this.leaderboard.find(item => item.user === this.selectedUser) || null;
        },

        selectedRank() {
            return this.leaderboard.findIndex(item => item.user === this.selectedUser) + 1;
        },

        stats() {
            if (!this.entry) {
                return { records: 0, completed: 0, progress: 0, firstVictories: 0 };
            }
            const completed = this.entry.completed.filter(item => item.type === 'completion').length;
            const firstVictories = this.entry.completed.filter(item => item.type === 'first-victor').length;
            return {
                records: this.entry.completed.length + this.entry.progressed.length,
                completed,
                progress: this.entry.progressed.length,
                firstVictories,
            };
        },

        registrationDate() {
            if (!this.profile?.created_at) return 'Not available';
            return new Date(this.profile.created_at).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        },
    },

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

                <section class="board-container">
                    <div class="leaderboard-search">
                        <label for="leaderboard-player-search">Find a player</label>
                        <input
                            id="leaderboard-player-search"
                            v-model="search"
                            type="search"
                            placeholder="Search players..."
                            autocomplete="off"
                        />
                        <span>{{ filteredLeaderboard.length }} players</span>
                    </div>

                    <div v-if="filteredLeaderboard.length" class="leaderboard-list-scroll">
                        <table class="board">
                            <tbody>
                                <tr
                                    v-for="(ientry, i) in filteredLeaderboard"
                                    :key="ientry.user"
                                    :class="{ 'active': selectedUser === ientry.user }"
                                >
                                    <td class="rank">
                                        <p class="type-label-lg">#{{ leaderboard.indexOf(ientry) + 1 }}</p>
                                    </td>
                                    <td class="total">
                                        <p class="type-label-lg">{{ localize(ientry.total) }}</p>
                                    </td>
                                    <td class="user" :class="{ 'active': selectedUser === ientry.user }">
                                        <button
                                            type="button"
                                            class="leaderboard-player-link"
                                            :aria-pressed="selectedUser === ientry.user"
                                            @click="selectPlayer(ientry.user)"
                                        >
                                            <span class="type-label-lg">{{ ientry.user }}</span>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-else class="leaderboard-empty-search">
                        <strong>No players found</strong>
                        <p>Try a different search.</p>
                    </div>
                </section>

                <section class="player-container">
                    <div v-if="!entry" class="player-empty">
                        <h2>Select a player</h2>
                        <p>Choose someone from the leaderboard to view their profile and records.</p>
                    </div>

                    <div v-else class="player">
                        <div v-if="profileLoading" class="player-profile-card player-profile-loading">
                            <p class="player-stats-loading">Loading player profile...</p>
                        </div>

                        <div class="player-profile-card">
                            <div class="player-profile-banner">
                                <img
                                    v-if="profile?.banner_url"
                                    class="player-profile-banner-image"
                                    :src="profile.banner_url"
                                    alt="Player profile banner"
                                />
                                <div v-else class="banner-pattern"></div>
                                <span class="banner-label">GVDL PLAYER</span>
                            </div>

                            <div class="player-profile-main">
                                <div class="player-profile-avatar">
                                    <img v-if="profile?.avatar_url" :src="profile.avatar_url" alt="Player avatar" />
                                    <span v-else>{{ entry.user.charAt(0).toUpperCase() }}</span>
                                </div>

                                <div class="player-profile-identity">
                                    <div class="player-profile-name">
                                        <h2>{{ entry.user }}</h2>
                                        <span class="player-role">{{ profile?.role || 'Player' }}</span>
                                    </div>
                                    <p class="player-joined">Member since {{ registrationDate }}</p>
                                </div>

                                <div class="player-profile-bio">
                                    <h3>ABOUT</h3>
                                    <p v-if="profile?.bio">{{ profile.bio }}</p>
                                    <p v-else class="player-no-bio">This player hasn't written a biography yet.</p>
                                </div>

                                <div class="player-profile-divider"></div>

                                <div class="player-stats-heading">
                                    <h3>PLAYER STATISTICS</h3>
                                    <span>GVDL RECORDS</span>
                                </div>

                                <div class="player-stats-grid">
                                    <div class="player-stat">
                                        <strong>{{ stats.records }}</strong>
                                        <span>Records</span>
                                    </div>
                                    <div class="player-stat">
                                        <strong>{{ stats.completed }}</strong>
                                        <span>Completed</span>
                                    </div>
                                    <div class="player-stat">
                                        <strong>{{ stats.progress }}</strong>
                                        <span>In Progress</span>
                                    </div>
                                    <div class="player-stat">
                                        <strong>{{ stats.firstVictories }}</strong>
                                        <span>First Victories</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="profileError" class="leaderboard-profile-note">{{ profileError }}</div>

                        <section v-if="entry.completed.length" class="leaderboard-record-section">
                            <h2>Completions <span>({{ entry.completed.length }})</span></h2>
                            <table class="table records-table">
                                <tbody>
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
                                        <td class="rank"><p>#{{ item.rank }}</p></td>
                                        <td class="level">
                                            <div class="level-name-group">
                                                <a v-if="item.path" class="type-label-lg" :href="levelUrl(item)">{{ item.level }}</a>
                                                <span v-else class="type-label-lg">{{ item.level }}</span>
                                                <span v-if="item.type === 'verifier'" class="achievement-label verifier-label">Verifier</span>
                                                <span v-if="item.type === 'first-victor'" class="achievement-label first-victor-label">First Victor</span>
                                            </div>
                                        </td>
                                        <td class="score"><p>+{{ localize(item.score) }}</p></td>
                                    </tr>
                                </tbody>
                            </table>
                        </section>

                        <section v-if="entry.progressed.length" class="leaderboard-record-section">
                            <h2>Progress <span>({{ entry.progressed.length }})</span></h2>
                            <table class="table records-table">
                                <tbody>
                                    <tr
                                        v-for="item in entry.progressed"
                                        :key="item.rank + '-' + item.percent"
                                        class="record-row progress-record"
                                    >
                                        <td class="rank"><p>#{{ item.rank }}</p></td>
                                        <td class="level">
                                            <a v-if="item.path" class="type-label-lg" :href="levelUrl(item)">{{ item.percent }}% {{ item.level }}</a>
                                            <span v-else class="type-label-lg">{{ item.percent }}% {{ item.level }}</span>
                                        </td>
                                        <td class="score"><p>+{{ localize(item.score) }}</p></td>
                                    </tr>
                                </tbody>
                            </table>
                        </section>

                        <div v-if="!entry.completed.length && !entry.progressed.length" class="leaderboard-no-records">
                            <p>This player currently has no listed records.</p>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    `,

    methods: {
        localize,

        selectPlayer(username) {
            if (!this.leaderboard.some(item => item.user === username)) return;
            this.selectedUser = username;
        },

        async loadSelectedProfile() {
            const request = ++this.profileRequest;
            const username = this.selectedUser;
            this.profile = null;
            this.profileError = '';

            if (!username) return;

            this.profileLoading = true;
            try {
                const { data: identity, error: identityError } = await supabase
                    .from('leaderboard_players')
                    .select('account_id')
                    .eq('username', username)
                    .maybeSingle();

                if (identityError) throw identityError;

                let query = supabase
                    .from('profiles')
                    .select('username, role, bio, avatar_url, banner_url, created_at');

                if (identity?.account_id) {
                    query = query.eq('id', identity.account_id);
                } else {
                    query = query.ilike('username', username);
                }

                const { data: profile, error } = await query.maybeSingle();
                if (error) throw error;
                if (request !== this.profileRequest) return;
                this.profile = profile || null;
            } catch (error) {
                console.error('Failed to load selected player profile:', error);
                if (request === this.profileRequest) {
                    this.profileError = 'Account profile details are unavailable. Leaderboard records are still shown.';
                }
            } finally {
                if (request === this.profileRequest) this.profileLoading = false;
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
    },

    watch: {
        selectedUser() {
            this.loadSelectedProfile();
        },

        search() {
            if (!this.filteredLeaderboard.length) return;
            if (!this.filteredLeaderboard.some(item => item.user === this.selectedUser)) {
                this.selectedUser = this.filteredLeaderboard[0].user;
            }
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

            const requestedPlayer = String(this.$route.query.player || '');
            const requestedEntry = leaderboard.find(item =>
                item.user.toLowerCase() === requestedPlayer.toLowerCase()
            );
            this.selectedUser = requestedEntry?.user || leaderboard[0]?.user || '';
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            this.leaderboard = [];
            this.err = ['Failed to load leaderboard. Please try again.'];
        } finally {
            this.loading = false;
        }
    },
};
