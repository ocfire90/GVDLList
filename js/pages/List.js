import { store } from "../main.js";
import { embed } from "../util.js";
import { score } from "../score.js";
import { fetchEditors, fetchList } from "../content.js";

import Spinner from "../components/Spinner.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

const roleIconMap = {
    owner: "crown",
    admin: "user-gear",
    helper: "user-shield",
    dev: "code",
    trial: "user-lock",
};

export default {
    components: { Spinner, LevelAuthors },
    props: ['indexFile'],
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-list" :class="{ 'mobile-level-open': mobileLevelOpen }">
            <div class="list-container">
                <table class="list" v-if="list">
                    <tr v-for="([level, err], i) in list">
                        <td class="rank">
                            <p v-if="i + 1 <= 150" class="type-label-lg">#{{ i + 1 }}</p>
                            <p v-else class="type-label-lg">Legacy</p>
                        </td>
                        <td class="level" :class="{ 'active': selected == i, 'error': !level }">
                            <button @click="selectLevel(i)">
                                <span class="type-label-lg">{{ level?.name || \`Error (\${err}.json)\` }}</span>
                            </button>
                        </td>
                    </tr>
                </table>
            </div>

            <div class="level-container">
                <button
                    class="mobile-list-back"
                    type="button"
                    @click="backToList"
                    aria-label="Back to the full level list"
                >
                    <span aria-hidden="true">←</span>
                    <span>Back to list</span>
                </button>

                <div class="level" v-if="level">
                    <h1>{{ level.name }}</h1>

                    <LevelAuthors
                        :author="level.author"
                        :creators="level.creators"
                        :verifier="level.verifier"
                    ></LevelAuthors>

                    <div
                        v-if="level.difficulty || level.enjoyment"
                        class="level-rating-pills"
                    >
                        <span v-if="level.difficulty" class="level-rating-pill difficulty">
                            <strong>Difficulty</strong>
                            <span>{{ level.difficulty }}</span>
                        </span>

                        <span v-if="level.enjoyment" class="level-rating-pill enjoyment">
                            <strong>Enjoyment</strong>
                            <span>{{ level.enjoyment }}</span>
                        </span>
                    </div>

                    <iframe
                        class="video"
                        id="videoframe"
                        :src="video"
                        frameborder="0"
                    ></iframe>

                    <ul class="stats">
                        <li>
                            <div class="type-title-sm">Points when completed</div>
                            <p>{{ score(selected + 1, 100, level.percentToQualify) }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">ID</div>
                            <p>{{ level.id }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">Password</div>
                            <p>{{ level.password || 'Free to Copy' }}</p>
                        </li>
                    </ul>

                    <div class="records-heading">
                        <h2>Records</h2>

                        <p v-if="selected + 1 <= 75">
                            <strong>{{ level.percentToQualify }}%</strong> or better to qualify
                        </p>
                        <p v-else-if="selected + 1 <= 150">
                            <strong>100%</strong> or better to qualify
                        </p>
                        <p v-else>This level does not accept new records.</p>
                    </div>

                    <ul class="records">
                        <li v-if="level.firstVictor" class="record first-victor">
                            <div class="record-info">
                                <strong class="type-label-lg">First Victor</strong>
                                <a
                                    class="type-label-lg"
                                    :href="playerUrl(level.firstVictor)"
                                >{{ level.firstVictor }}</a>
                            </div>
                            <span class="record-percent type-label-lg">100%</span>
                        </li>

                        <li
                            v-for="(record, i) in level.records"
                            :key="i"
                            class="record"
                            :class="typeof record === 'string' ? 'completion' : 'progress'"
                        >
                            <div class="record-info">
                                <strong class="type-label-lg">
                                    {{ typeof record === 'string' ? 'Completion' : 'Progress' }}
                                </strong>
                                <a
                                    class="type-label-lg"
                                    :href="playerUrl(typeof record === 'string' ? record : record.user)"
                                >{{ typeof record === 'string' ? record : record.user }}</a>
                            </div>

                            <span class="record-percent type-label-lg">
                                {{ typeof record === 'string' ? '100%' : record.percent + '%' }}
                            </span>
                        </li>
                    </ul>

                    <section class="placement-history" aria-labelledby="placement-history-title">
                        <div class="placement-history-heading">
                            <h2 id="placement-history-title">Placement History</h2>
                            <span v-if="placementHistory.length" class="type-label-md">
                                {{ placementHistory.length }} {{ placementHistory.length === 1 ? 'event' : 'events' }}
                            </span>
                        </div>

                        <p v-if="!level.databaseId" class="placement-history-empty">
                            Placement history is not available for this legacy entry.
                        </p>
                        <p v-else-if="placementHistoryLoading" class="placement-history-empty">
                            Loading placement history...
                        </p>
                        <p v-else-if="placementHistoryError" class="placement-history-empty">
                            Could not load placement history. Please try again later.
                        </p>
                        <p v-else-if="placementHistory.length === 0" class="placement-history-empty">
                            No placement changes have been recorded for this level yet.
                        </p>

                        <ol v-else class="placement-history-list">
                            <li v-for="event in placementHistory" :key="event.id" class="placement-history-event">
                                <span class="placement-history-marker" :class="placementEventClass(event)"></span>
                                <div class="placement-history-event-content">
                                    <strong>{{ placementEventTitle(event) }}</strong>
                                    <span>{{ placementEventDescription(event) }}</span>
                                    <time :datetime="event.changed_at">{{ formatPlacementDate(event.changed_at) }}</time>
                                </div>
                            </li>
                        </ol>
                    </section>

                </div>

                <div
                    v-else
                    class="level"
                    style="height: 100%; justify-content: center; align-items: center;"
                >
                    <p>(ノಠ益ಠ)ノ彡┻━┻</p>
                </div>
            </div>

            <div class="meta-container">
                <div class="meta">
                    <div class="errors" v-show="errors.length > 0">
                        <p class="error" v-for="error of errors">{{ error }}</p>
                    </div>

                    <div class="og">
                        <p class="type-label-md">
                            Website layout made by
                            <a href="https://tsl.pages.dev/" target="_blank">TheShittyList</a>
                        </p>
                    </div>

                    <template v-if="editors">
                        <h3>List Editors</h3>
                        <ol class="editors">
                            <li v-for="editor in editors">
                                <img
                                    :src="\`/assets/\${roleIconMap[editor.role]}\${store.dark ? '-dark' : ''}.svg\`"
                                    :alt="editor.role"
                                >
                                <a
                                    v-if="editor.link"
                                    class="type-label-lg link"
                                    target="_blank"
                                    :href="editor.link"
                                >{{ editor.name }}</a>
                                <p v-else>{{ editor.name }}</p>
                            </li>
                        </ol>
                    </template>

                    <h3>Submission Requirements</h3>
                    <p>
                        Achieved the record without using hacks (however, FPS bypass is allowed, up to 360fps)
                    </p>
                    <p>
                        Achieved the record on the level that is listed on the site - please check the level ID before you submit a record
                    </p>
                    <p>
                        Have either source audio or clicks/taps in the video. Edited audio only does not count
                    </p>
                    <p>
                        The recording must have a previous attempt and entire death animation shown before the completion, unless the completion is on the first attempt. Everyplay records are exempt from this
                    </p>
                    <p>
                        The recording must also show the player hit the endwall, or the completion will be invalidated.
                    </p>
                    <p>
                        Do not use secret routes or bug routes
                    </p>
                    <p>
                        Do not use easy modes, only a record of the unmodified level qualifies
                    </p>
                    <p>
                        Once a level falls onto the Legacy List, we accept records for it for 24 hours after it falls off, then afterwards we never accept records for said level
                    </p>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        list: [],
        editors: [],
        loading: true,
        selected: 0,
        mobileLevelOpen: false,
        errors: [],
        placementHistory: [],
        placementHistoryLoading: false,
        placementHistoryError: false,
        placementHistoryRequestId: 0,
        roleIconMap,
        store
    }),
    computed: {
        level() {
            return this.list[this.selected]?.[0] || null;
        },
        video() {
            if (!this.level.showcase) {
                return embed(this.level.verification);
            }

            return embed(
                this.toggledShowcase
                    ? this.level.showcase
                    : this.level.verification
            );
        },
    },
    watch: {
        '$route.fullPath'() {
            if (!this.loading) {
                this.selectLevelFromRoute();
            }
        },
    },
    async mounted() {
        this.list = await fetchList(this.indexFile || '_list.json');
        this.editors = await fetchEditors();

        if (!this.list) {
            this.errors = [
                "Failed to load list. Retry in a few minutes or notify list staff.",
            ];
        } else {
            this.errors.push(
                ...this.list
                    .filter(([_, err]) => err)
                    .map(([_, err]) => {
                        return `Failed to load level. (${err}.json)`;
                    })
            );

            if (!this.editors) {
                this.errors.push("Failed to load list editors.");
            }

            this.selectLevelFromRoute();
            await this.loadPlacementHistory();
        }

        this.loading = false;
    },
    methods: {
        embed,
        score,

        playerUrl(player) {
            return `#/leaderboard?player=${encodeURIComponent(player)}`;
        },

        async selectLevel(index) {
            this.selected = index;
            this.mobileLevelOpen = true;
            await this.loadPlacementHistory();

            const path = this.list[index]?.[0]?.path;

            if (path) {
                this.$router.replace({
                    query: {
                        ...this.$route.query,
                        level: path,
                    },
                });
            }
        },

        backToList() {
            this.mobileLevelOpen = false;
            const query = { ...this.$route.query };
            delete query.level;
            this.$router.replace({ query });
        },

        async loadPlacementHistory() {
            const levelId = this.level?.databaseId;
            const requestId = ++this.placementHistoryRequestId;
            this.placementHistory = [];
            this.placementHistoryError = false;

            if (!levelId) {
                this.placementHistoryLoading = false;
                return;
            }

            this.placementHistoryLoading = true;

            try {
                const { supabase } = await import('../main.js');
                const { data, error } = await supabase
                    .from('level_placement_history')
                    .select('id, action, old_position, new_position, changed_at')
                    .eq('level_id', levelId)
                    .eq('list_key', 'main')
                    .order('changed_at', { ascending: false });

                if (error) throw error;
                if (requestId === this.placementHistoryRequestId) {
                    this.placementHistory = data || [];
                }
            } catch (error) {
                console.error('Failed to load level placement history:', error);
                if (requestId === this.placementHistoryRequestId) {
                    this.placementHistoryError = true;
                }
            } finally {
                if (requestId === this.placementHistoryRequestId) {
                    this.placementHistoryLoading = false;
                }
            }
        },

        placementEventClass(event) {
            if (event.action === 'added') return 'added';
            if (event.action === 'removed') return 'removed';
            if (event.action === 'moved' && event.new_position < event.old_position) return 'up';
            if (event.action === 'moved' && event.new_position > event.old_position) return 'down';
            return 'neutral';
        },

        placementEventTitle(event) {
            if (event.action === 'added') return 'Added to the Main List';
            if (event.action === 'removed') return 'Removed from the Main List';
            if (event.action === 'moved' && event.new_position < event.old_position) return 'Moved up';
            if (event.action === 'moved' && event.new_position > event.old_position) return 'Moved down';
            return 'Placement updated';
        },

        placementEventDescription(event) {
            if (event.action === 'added') return event.new_position ? `Entered at #${event.new_position}` : 'Added to the list';
            if (event.action === 'removed') return event.old_position ? `Removed from #${event.old_position}` : 'Removed from the list';
            if (event.action === 'moved') return `#${event.old_position} → #${event.new_position}`;
            return 'The level placement was updated';
        },

        formatPlacementDate(value) {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return 'Date unavailable';
            return new Intl.DateTimeFormat(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            }).format(date);
        },

        selectLevelFromRoute() {
            const path = this.$route.query.level;

            if (!path || !this.list?.length) {
                return;
            }

            const index = this.list.findIndex(
                ([level]) => level?.path === path,
            );

            if (index !== -1) {
                this.selected = index;
                this.mobileLevelOpen = true;
            }
        },
    },
};
