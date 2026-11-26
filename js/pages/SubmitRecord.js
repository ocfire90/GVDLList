import { supabase, store } from '../main.js';

const DRAFT_KEY_PREFIX = 'gvdl-record-submission-draft:';

export default {
    data: () => ({
        store,
        levels: [],
        levelsLoading: true,
        levelsError: '',
        draft: {
            levelId: '',
            percentage: '',
            videoUrl: '',
        },
        submitting: false,
        errorMessage: '',
        successMessage: '',
        draftStorageAvailable: true,
    }),

    computed: {
        selectedLevel() {
            return this.levels.find(level => level.id === this.draft.levelId) || null;
        },

        qualifyingPercentage() {
            if (!this.selectedLevel) return 100;
            return this.selectedLevel.position <= 75
                ? Number(this.selectedLevel.percentToQualify || 100)
                : 100;
        },

        isCompletion() {
            const percentage = Number(this.draft.percentage);
            return Number.isFinite(percentage) &&
                percentage >= this.qualifyingPercentage;
        },
    },

    watch: {
        draft: {
            deep: true,
            handler() {
                this.saveDraft();
                this.errorMessage = '';
                this.successMessage = '';
            },
        },

        'store.user': {
            immediate: true,
            handler(user) {
                if (user) {
                    this.loadDraft();
                    this.loadLevels();
                } else {
                    this.levels = [];
                    this.levelsLoading = false;
                }
            },
        },
    },

    methods: {
        draftStorageKey() {
            return this.store.user?.id
                ? `${DRAFT_KEY_PREFIX}${this.store.user.id}`
                : null;
        },

        loadDraft() {
            const key = this.draftStorageKey();
            if (!key) return;

            try {
                const saved = localStorage.getItem(key);
                if (!saved) return;

                const parsed = JSON.parse(saved);
                this.draft = {
                    levelId: typeof parsed.levelId === 'string' ? parsed.levelId : '',
                    percentage: parsed.percentage ?? '',
                    videoUrl: typeof parsed.videoUrl === 'string' ? parsed.videoUrl : '',
                };
            } catch (error) {
                console.warn('Could not restore the record submission draft:', error);
                this.draftStorageAvailable = false;
            }
        },

        saveDraft() {
            const key = this.draftStorageKey();
            if (!key) return;

            const hasDraft = this.draft.levelId ||
                String(this.draft.percentage ?? '').trim() ||
                this.draft.videoUrl.trim();

            try {
                if (!hasDraft) {
                    localStorage.removeItem(key);
                    return;
                }

                localStorage.setItem(key, JSON.stringify(this.draft));
                this.draftStorageAvailable = true;
            } catch (error) {
                console.warn('Could not save the record submission draft:', error);
                this.draftStorageAvailable = false;
            }
        },

        async loadLevels() {
            if (!this.store.user) return;

            this.levelsLoading = true;
            this.levelsError = '';

            try {
                const { data, error } = await supabase
                    .from('level_list_entries')
                    .select('position, levels!inner(id, name, percent_to_qualify)')
                    .eq('list_key', 'main')
                    .lte('position', 150)
                    .order('position', { ascending: true });

                if (error) throw error;

                this.levels = (data || [])
                    .filter(entry => entry.levels)
                    .map(entry => ({
                        id: entry.levels.id,
                        name: entry.levels.name,
                        position: Number(entry.position),
                        percentToQualify: Number(entry.levels.percent_to_qualify || 100),
                    }));
            } catch (error) {
                console.error('Failed to load levels for record submission:', error);
                this.levelsError = 'The Main List could not be loaded. Please refresh and try again.';
            } finally {
                this.levelsLoading = false;
            }
        },

        validateVideoUrl(value) {
            try {
                const url = new URL(value);
                return url.protocol === 'https:' || url.protocol === 'http:';
            } catch {
                return false;
            }
        },

        async submitRecord() {
            if (!this.store.user) {
                this.errorMessage = 'Please log in before submitting a record.';
                return;
            }

            if (this.submitting) return;

            const level = this.selectedLevel;
            const percentage = Number(this.draft.percentage);
            const videoUrl = this.draft.videoUrl.trim();

            if (!level) {
                this.errorMessage = 'Please select a level.';
                return;
            }

            if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
                this.errorMessage = 'Enter a percentage greater than 0 and no higher than 100.';
                return;
            }

            if (!videoUrl || !this.validateVideoUrl(videoUrl)) {
                this.errorMessage = 'Enter a valid video URL beginning with http:// or https://.';
                return;
            }

            this.submitting = true;
            this.errorMessage = '';
            this.successMessage = '';

            try {
                const { error } = await supabase
                    .from('record_submissions')
                    .insert({
                        submitted_by: this.store.user.id,
                        level_id: level.id,
                        percentage,
                        video_url: videoUrl,
                        status: 'pending',
                    });

                if (error) throw error;

                const key = this.draftStorageKey();
                if (key) {
                    try {
                        localStorage.removeItem(key);
                    } catch (storageError) {
                        console.warn('Could not clear the submitted record draft:', storageError);
                    }
                }

                this.draft = {
                    levelId: '',
                    percentage: '',
                    videoUrl: '',
                };

                this.successMessage = `Your ${percentage}% record on ${level.name} has been submitted for review.`;
            } catch (error) {
                console.error('Record submission failed:', error);
                this.errorMessage = error.message || 'Your record could not be submitted. Your draft has been kept.';
            } finally {
                this.submitting = false;
            }
        },
    },

    template: `
        <main class="page-submit-record" :class="{ dark: store.dark }">
            <div class="submit-record-container">
                <div class="submit-record-heading">
                    <div>
                        <span class="submit-record-eyebrow">PLAYER SUBMISSION</span>
                        <h1>Submit a Record</h1>
                        <p>Send a completion or progress record to the GVDL moderators for review.</p>
                    </div>
                    <router-link class="submit-record-back" to="/account">My Account</router-link>
                </div>

                <div v-if="!store.authReady" class="submit-record-card submit-record-state">
                    <div class="submit-record-loader"></div>
                    <p>Checking your account...</p>
                </div>

                <div v-else-if="!store.user" class="submit-record-card submit-record-state">
                    <h2>Login required</h2>
                    <p>You need to be logged in to submit a record. Your submission history will be available in My Account.</p>
                    <router-link class="submit-record-button" to="/account">Go to Login</router-link>
                </div>

                <div v-else class="submit-record-layout">
                    <form class="submit-record-card submit-record-form" @submit.prevent="submitRecord">
                        <div class="submit-record-card-heading">
                            <div>
                                <h2>Record details</h2>
                                <p>Complete all three fields to submit your record.</p>
                            </div>
                            <span class="submit-record-required">REQUIRED</span>
                        </div>

                        <div v-if="levelsLoading" class="submit-record-loading">
                            Loading eligible Main List levels...
                        </div>
                        <div v-else-if="levelsError" class="submit-record-alert error">
                            {{ levelsError }}
                        </div>
                        <template v-else>
                            <label class="submit-record-field">
                                <span>Level</span>
                                <select v-model="draft.levelId" required>
                                    <option value="" disabled>Select a level</option>
                                    <option v-for="level in levels" :key="level.id" :value="level.id">
                                        #{{ level.position }} · {{ level.name }}
                                    </option>
                                </select>
                            </label>

                            <div class="submit-record-field">
                                <label for="record-percentage">Percentage</label>
                                <div class="submit-record-percentage-input">
                                    <input
                                        id="record-percentage"
                                        v-model="draft.percentage"
                                        type="number"
                                        min="0.01"
                                        max="100"
                                        step="0.01"
                                        placeholder="100"
                                        required
                                    />
                                    <span>%</span>
                                </div>
                                <small v-if="selectedLevel">
                                    {{ isCompletion ? 'This meets the completion requirement.' : `A completion requires ${qualifyingPercentage}%. Lower percentages are submitted as progress.` }}
                                </small>
                                <small v-else>Enter the highest percentage you achieved.</small>
                            </div>

                            <label class="submit-record-field">
                                <span>Video URL</span>
                                <input
                                    v-model.trim="draft.videoUrl"
                                    type="url"
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    autocomplete="url"
                                    required
                                />
                                <small>Include a video that shows the full run and meets the GVDL submission requirements.</small>
                            </label>

                            <div v-if="selectedLevel" class="submit-record-preview">
                                <div>
                                    <span>SELECTED LEVEL</span>
                                    <strong>#{{ selectedLevel.position }} · {{ selectedLevel.name }}</strong>
                                </div>
                                <div>
                                    <span>RECORD TYPE</span>
                                    <strong>{{ isCompletion ? 'Completion' : 'Progress' }}</strong>
                                </div>
                            </div>
                        </template>

                        <div v-if="errorMessage" class="submit-record-alert error" role="alert">
                            {{ errorMessage }}
                        </div>
                        <div v-if="successMessage" class="submit-record-alert success" role="status">
                            {{ successMessage }}
                        </div>

                        <div class="submit-record-footer">
                            <p v-if="draftStorageAvailable">Your draft is saved automatically on this device until you submit it.</p>
                            <p v-else>Your browser could not save this draft. Keep this page open to avoid losing your entries.</p>
                            <button
                                class="submit-record-button"
                                type="submit"
                                :disabled="submitting || levelsLoading || !!levelsError || !levels.length"
                            >
                                {{ submitting ? 'Submitting...' : 'Submit Record' }}
                            </button>
                        </div>
                    </form>

                    <aside class="submit-record-guidelines">
                        <h2>Submission requirements</h2>
                        <p>Your video must clearly demonstrate the submitted record and follow the GVDL rules.</p>
                        <ul>
                            <li>No hacks. FPS bypass is allowed up to 360 FPS.</li>
                            <li>The run must be on the exact level listed on the site. Check the level ID before submitting.</li>
                            <li>Include source audio or clicks/taps in the video. Edited audio alone is not accepted.</li>
                            <li>Show a previous attempt and its full death animation before the completion, unless it was completed on the first attempt. Everyplay recordings are exempt.</li>
                            <li>Show your character reaching the end wall.</li>
                            <li>Do not use secret routes, bug routes or easy modes.</li>
                        </ul>
                        <div class="submit-record-review-note">
                            <strong>What happens next?</strong>
                            <p>Your submission enters the moderation queue. You can track its status and any moderator feedback from the Record Submissions section in My Account.</p>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    `,
};
