import { supabase } from '../main.js';
import { fetchLeaderboard } from '../content.js';

export default {
    data: () => ({
        loading: true,
        error: '',
        identity: null,
        profile: null,
        entry: null,
        rank: null,
        stats: {
            records: 0,
            completed: 0,
            progress: 0,
            firstVictories: 0,
        },
    }),

    computed: {
        username() {
            return this.profile?.username || this.identity?.username || 'Player';
        },

        avatarUrl() {
            return this.profile?.avatar_url || '';
        },

        bannerUrl() {
            return this.profile?.banner_url || '';
        },

        bio() {
            return this.profile?.bio || '';
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
        <main class="page-public-player">
            <div class="public-player-content">
                <div v-if="loading" class="player-profile-card">
                    <p class="player-stats-loading">Loading player profile...</p>
                </div>

                <div v-else-if="error" class="player-profile-card">
                    <div class="content-heading">
                        <div>
                            <h1>Player Profile</h1>
                            <p>{{ error }}</p>
                        </div>
                    </div>
                    <router-link to="/leaderboard">Return to leaderboard</router-link>
                </div>

                <template v-else>
                    <div class="content-heading public-player-page-heading">
                        <div>
                            <h1>Player Profile</h1>
                            <p>Public player profile and GVDL statistics.</p>
                        </div>
                        <span class="content-tag">PLAYER PROFILE</span>
                    </div>

                    <div class="player-profile-card">
                        <div class="player-profile-banner">
                            <img
                                v-if="bannerUrl"
                                class="player-profile-banner-image"
                                :src="bannerUrl"
                                alt="Player profile banner"
                            />
                            <div v-else class="banner-pattern"></div>
                            <span class="banner-label">GVDL PLAYER</span>
                        </div>

                        <div class="player-profile-main">
                            <div class="player-profile-avatar">
                                <img v-if="avatarUrl" :src="avatarUrl" alt="Player avatar" />
                                <span v-else>{{ username.charAt(0).toUpperCase() }}</span>
                            </div>

                            <div class="player-profile-identity">
                                <div class="player-profile-name">
                                    <h2>{{ username }}</h2>
                                    <span class="player-role">{{ profile?.role || 'Player' }}</span>
                                </div>
                                <p class="player-joined">Member since {{ registrationDate }}</p>
                            </div>

                            <div class="player-profile-bio">
                                <h3>ABOUT</h3>
                                <p v-if="bio">{{ bio }}</p>
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

                            <div class="player-profile-footer">
                                <span>GRAB VR DEMON LIST</span>
                                <span>PLAYER PROFILE</span>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </main>
    `,

    async mounted() {
        const username = String(this.$route.params.username || '').trim();

        try {
            const { data: identity, error: identityError } = await supabase
                .from('leaderboard_players')
                .select('id, username, account_id')
                .eq('username', username)
                .maybeSingle();

            if (identityError) throw identityError;
            if (!identity) {
                this.error = 'This leaderboard player does not exist.';
                return;
            }

            this.identity = identity;

            let profileQuery = supabase
                .from('profiles')
                .select('username, role, bio, avatar_url, banner_url, created_at');

            profileQuery = identity.account_id
                ? profileQuery.eq('id', identity.account_id)
                : profileQuery.ilike('username', identity.username);

            const { data: profile, error: profileError } = await profileQuery.maybeSingle();
            if (profileError) console.error('Could not load the player account profile:', profileError);
            this.profile = profile || null;

            const [leaderboard] = await fetchLeaderboard('_list.json');
            const entry = leaderboard.find(item =>
                item.user.toLowerCase() === identity.username.toLowerCase()
            );

            if (entry) {
                this.entry = entry;
                this.rank = leaderboard.indexOf(entry) + 1;
                const firstVictories = entry.completed.filter(item => item.type === 'first-victor').length;
                const normalCompletions = entry.completed.filter(item => item.type === 'completion').length;
                this.stats = {
                    records: entry.completed.length + entry.progressed.length,
                    completed: normalCompletions,
                    progress: entry.progressed.length,
                    firstVictories,
                };
            }
        } catch (error) {
            console.error('Could not load player profile:', error);
            this.error = 'The player profile could not be loaded. Please try again.';
        } finally {
            this.loading = false;
        }
    },
};
