import { supabase } from '../main.js';
import { fetchList, fetchLeaderboard } from '../content.js';
import Spinner from '../components/Spinner.js';

const dateLabel = value => {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

const changeLabel = action => ({
    added: 'Added to the Main List',
    removed: 'Removed from the Main List',
    moved: 'Position changed',
}[action] || 'Main List updated');

export default {
    components: { Spinner },

    data: () => ({
        loading: true,
        error: '',
        hardest: null,
        bestPlayer: null,
        latestVictory: null,
        updates: [],
        mainListCount: 0,
    }),

    template: `
        <main class="page-home" :class="{ dark: $root.store?.dark }">
            <div class="home-shell">
                <section class="home-intro">
                    <div class="home-intro-copy">
                        <p class="home-eyebrow">GRAB VR DEMON LIST</p>
                        <h1>The GVDL<br><span>Dashboard.</span></h1>
                        <p class="home-description">
                            The latest rankings, player achievements, and changes across the Main List.
                        </p>
                        <div class="home-actions">
                            <router-link to="/list" class="home-primary-link">Explore the Main List <span>↗</span></router-link>
                            <router-link to="/leaderboard" class="home-secondary-link">View leaderboard</router-link>
                        </div>
                    </div>
                    <div class="home-intro-mark" aria-hidden="true">
                        <div class="home-mark-ring"></div>
                        <div class="home-mark-core">GVDL</div>
                        <span class="home-mark-caption">EST. GRAB VR</span>
                    </div>
                </section>

                <div v-if="loading" class="home-loading"><Spinner /></div>
                <div v-else class="home-content">
                    <section class="home-feature-grid">
                        <article class="home-feature-card home-hardest">
                            <div class="home-card-topline"><span class="home-kicker">CURRENT HARDEST</span><span class="home-index">01 / MAIN LIST</span></div>
                            <template v-if="hardest">
                                <div class="home-feature-body">
                                    <p class="home-feature-rank">#1</p>
                                    <h2>{{ hardest.name }}</h2>
                                    <p class="home-feature-meta">by {{ hardest.author || 'Unknown creator' }}</p>
                                </div>
                                <div class="home-feature-bottom">
                                    <span class="home-difficulty">{{ hardest.difficulty || 'Main List #1' }}</span>
                                    <router-link :to="{ path: '/list', query: { level: hardest.path } }">View level <span>↗</span></router-link>
                                </div>
                            </template>
                            <p v-else class="home-muted">The Main List is currently unavailable.</p>
                        </article>

                        <article class="home-feature-card home-best-player">
                            <div class="home-card-topline"><span class="home-kicker">TOP PLAYER</span><span class="home-index">02 / LEADERBOARD</span></div>
                            <template v-if="bestPlayer">
                                <div class="home-feature-body">
                                    <p class="home-feature-rank">#1</p>
                                    <h2>{{ bestPlayer.user }}</h2>
                                    <p class="home-feature-meta">Highest-ranked player on the Main List</p>
                                </div>
                                <div class="home-feature-bottom">
                                    <span class="home-player-score">{{ formatScore(bestPlayer.total) }} points</span>
                                    <router-link :to="{ path: '/leaderboard', query: { player: bestPlayer.user } }">View profile <span>↗</span></router-link>
                                </div>
                            </template>
                            <p v-else class="home-muted">No leaderboard players are currently listed.</p>
                        </article>
                    </section>

                    <section class="home-lower-grid">
                        <article class="home-panel home-updates">
                            <div class="home-section-heading">
                                <div><p class="home-kicker">WHAT'S CHANGING</p><h2>Latest list updates</h2></div>
                                <router-link to="/list">Full list <span>↗</span></router-link>
                            </div>
                            <div v-if="updates.length" class="home-update-list">
                                <div v-for="(update, index) in updates" :key="update.id" class="home-update-item">
                                    <span class="home-update-marker" :class="'is-' + update.change.action"></span>
                                    <div class="home-update-content">
                                        <div class="home-update-title">
                                            <strong>{{ update.levelName }}</strong>
                                            <span class="home-update-type">{{ changeText(update.change.action) }}</span>
                                        </div>
                                        <p>{{ positionText(update.change) }}</p>
                                        <time>{{ formatDate(update.change.changed_at) }}</time>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="home-empty-state">
                                <strong>No recent list changes yet</strong>
                                <p>New additions, removals, and rank changes will appear here automatically.</p>
                            </div>
                        </article>

                        <article class="home-panel home-victory">
                            <div class="home-section-heading">
                                <div><p class="home-kicker">LATEST ACHIEVEMENT</p><h2>Top 10 victory</h2></div>
                                <span class="home-trophy" aria-hidden="true">✦</span>
                            </div>
                            <template v-if="latestVictory">
                                <p class="home-victory-label">{{ latestVictory.is_first_victor ? 'FIRST VICTORY' : 'NEW COMPLETION' }}</p>
                                <h3>{{ latestVictory.player_name }}</h3>
                                <p class="home-victory-description">completed <strong>{{ latestVictory.levelName }}</strong></p>
                                <div class="home-victory-rank">
                                    <span>MAIN LIST POSITION</span>
                                    <strong>#{{ latestVictory.position }}</strong>
                                </div>
                                <div class="home-victory-footer">
                                    <time>{{ latestVictory.achieved_at ? 'Achieved ' : 'Record logged ' }}{{ formatDate(latestVictory.achieved_at || latestVictory.created_at) }}</time>
                                    <router-link :to="{ path: '/list', query: { level: latestVictory.levelPath } }">View level <span>↗</span></router-link>
                                </div>
                            </template>
                            <div v-else class="home-empty-state">
                                <strong>No tracked Top 10 victories yet</strong>
                                <p>Verified Top 10 completions will be featured here as they enter the records database.</p>
                            </div>
                        </article>
                    </section>

                    <footer class="home-footer">
                        <span>GRAB VR DEMON LIST</span>
                        <span>{{ mainListCount }} LEVELS · MAIN LIST</span>
                    </footer>
                </div>
                <p v-if="error" class="home-error">{{ error }}</p>
            </div>
        </main>
    `,

    methods: {
        formatDate: dateLabel,
        changeText: changeLabel,
        formatScore(value) {
            return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
        },
        positionText(change) {
            if (change.action === 'added') return change.new_position ? `Entered at #${change.new_position}` : 'Added to the list';
            if (change.action === 'removed') return change.old_position ? `Removed from #${change.old_position}` : 'Removed from the list';
            if (change.action === 'moved') return `Moved from #${change.old_position} to #${change.new_position}`;
            return 'Main List updated';
        },
    },

    async mounted() {
        try {
            const [list, leaderboard] = await Promise.all([
                fetchList('_list.json'),
                fetchLeaderboard('_list.json'),
            ]);

            if (list) {
                this.mainListCount = list.filter(([level]) => !!level).length;
                this.hardest = list[0]?.[0] || null;
            }

            if (leaderboard?.[0]?.length) {
                this.bestPlayer = leaderboard[0][0];
            }

            const { data: changedLevels, error: changesError } = await supabase
                .from('levels')
                .select('id, name, main_list_change')
                .not('main_list_change', 'is', null);

            if (changesError) throw changesError;

            this.updates = (changedLevels || [])
                .filter(item => item.main_list_change?.changed_at)
                .sort((a, b) => new Date(b.main_list_change.changed_at) - new Date(a.main_list_change.changed_at))
                .slice(0, 6)
                .map(item => ({
                    id: item.id,
                    levelName: item.name,
                    change: item.main_list_change,
                }));

            const topTen = (list || [])
                .slice(0, 10)
                .map(([level], index) => level ? { id: level.databaseId, position: index + 1, name: level.name, path: level.path } : null)
                .filter(Boolean);

            const levelIds = topTen.map(level => level.id).filter(Boolean);
            if (levelIds.length) {
                const { data: records, error: recordsError } = await supabase
                    .from('player_records')
                    .select('player_name, percentage, is_first_victor, achieved_at, created_at, level_id')
                    .in('level_id', levelIds)
                    .eq('percentage', 100)
                    .order('achieved_at', { ascending: false, nullsFirst: false })
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (recordsError) throw recordsError;
                if (records?.length) {
                    const record = records[0];
                    const level = topTen.find(item => item.id === record.level_id);
                    if (level) {
                        this.latestVictory = {
                            ...record,
                            levelName: level.name,
                            levelPath: level.path,
                            position: level.position,
                        };
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load GVDL homepage:', error);
            this.error = 'Some homepage information could not be loaded. Please refresh to try again.';
        } finally {
            this.loading = false;
        }
    },
};
