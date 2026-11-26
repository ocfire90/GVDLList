import { supabase, store } from '../main.js';

const ENJOYMENT_GRADES = ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F', 'F-'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard -', 'Hard', 'Hard +', 'Extreme -', 'Extreme', 'Extreme +', 'Insane -', 'Insane', 'Insane +'];

export default {
    data: () => ({
        store,
        draft: {
            name: '',
            creators: '',
            verifier: '',
            gameId: '',
            verificationUrl: '',
            difficulty: 'Hard',
            enjoyment: 'B',
            position: 75,
        },
        submitting: false,
        errorMessage: '',
        successMessage: '',
    }),

    methods: {
        validHttpUrl(value) {
            if (!value) return true;
            try {
                const url = new URL(value);
                return url.protocol === 'https:' || url.protocol === 'http:';
            } catch {
                return false;
            }
        },

        async submitLevel() {
            if (!this.store.user || this.submitting) return;

            const creators = this.draft.creators
                .split(',')
                .map(name => name.trim())
                .filter(Boolean);

            if (!this.draft.name.trim() || !creators.length || !this.draft.verifier.trim()) {
                this.errorMessage = 'Enter a level name, at least one creator, and the verifier.';
                return;
            }

            if (!Number.isInteger(Number(this.draft.position)) ||
                Number(this.draft.position) < 1 || Number(this.draft.position) > 150) {
                this.errorMessage = 'Recommended placement must be between #1 and #150.';
                return;
            }

            if (!this.validHttpUrl(this.draft.verificationUrl.trim())) {
                this.errorMessage = 'The verification link must begin with http:// or https://.';
                return;
            }

            this.submitting = true;
            this.errorMessage = '';
            this.successMessage = '';

            try {
                const { error } = await supabase
                    .from('level_submissions')
                    .insert({
                        submitted_by: this.store.user.id,
                        name: this.draft.name.trim(),
                        creators,
                        verifier: this.draft.verifier.trim(),
                        game_id: this.draft.gameId.trim() || null,
                        verification_url: this.draft.verificationUrl.trim() || null,
                        recommended_difficulty: this.draft.difficulty,
                        recommended_enjoyment: this.draft.enjoyment,
                        suggested_position: Number(this.draft.position),
                        status: 'pending',
                    });

                if (error) throw error;

                this.successMessage = 'Your level proposal has been submitted for moderation. It will not appear on the list unless approved by the GVDL team.';
                this.draft = {
                    name: '',
                    creators: '',
                    verifier: '',
                    gameId: '',
                    verificationUrl: '',
                    difficulty: 'Hard',
                    enjoyment: 'B',
                    position: 75,
                };
            } catch (error) {
                console.error('Level proposal failed:', error);
                this.errorMessage = error.message || 'Your level proposal could not be submitted.';
            } finally {
                this.submitting = false;
            }
        },
    },

    template: `
        <main class="page-submit-record page-submit-level" :class="{ dark: store.dark }">
            <div class="submit-record-container">
                <div class="submit-record-heading">
                    <div>
                        <span class="submit-record-eyebrow">PLAYER SUBMISSION</span>
                        <h1>Propose a Level</h1>
                        <p>Suggest a new level for the GVDL Main List. Every proposal must include a verifier who has completed the level to prove it is possible.</p>
                    </div>
                    <router-link class="submit-record-back" to="/submit-record">Submit a Record</router-link>
                </div>

                <div v-if="!store.authReady" class="submit-record-card submit-record-state">
                    <div class="submit-record-loader"></div>
                    <p>Checking your account...</p>
                </div>

                <div v-else-if="!store.user" class="submit-record-card submit-record-state">
                    <h2>Login required</h2>
                    <p>You need to be logged in to propose a level.</p>
                    <router-link class="submit-record-button" to="/account">Go to Login</router-link>
                </div>

                <div v-else class="submit-record-layout">
                    <form class="submit-record-card submit-record-form" @submit.prevent="submitLevel">
                        <div class="submit-record-card-heading">
                            <div>
                                <h2>Level proposal</h2>
                                <p>Provide the level information and your recommendations.</p>
                            </div>
                            <span class="submit-record-required">REQUIRED FIELDS</span>
                        </div>

                        <label class="submit-record-field">
                            <span>Level name</span>
                            <input v-model.trim="draft.name" maxlength="120" required placeholder="Level name" />
                        </label>

                        <label class="submit-record-field">
                            <span>Creator(s)</span>
                            <input v-model="draft.creators" required placeholder="Separate multiple creators with commas" />
                            <small>Enter every creator credited for the level.</small>
                        </label>

                        <label class="submit-record-field">
                            <span>Verifier</span>
                            <input v-model.trim="draft.verifier" required placeholder="Verifier's GVDL player name" />
                            <small>The verifier must have completed the level at 100%. This is verification, not a first-victor submission.</small>
                        </label>

                        <label class="submit-record-field">
                            <span>Verification video URL <small>(optional)</small></span>
                            <input v-model.trim="draft.verificationUrl" type="url" placeholder="https://..." autocomplete="url" />
                            <small>A video link helps moderators confirm the verification.</small>
                        </label>

                        <label class="submit-record-field">
                            <span>GRAB Game ID <small>(optional)</small></span>
                            <input v-model.trim="draft.gameId" placeholder="Level ID" />
                        </label>

                        <label class="submit-record-field">
                            <span>Recommended difficulty</span>
                            <select v-model="draft.difficulty" required>
                                <option v-for="difficulty in ['Easy', 'Medium', 'Hard -', 'Hard', 'Hard +', 'Extreme -', 'Extreme', 'Extreme +', 'Insane -', 'Insane', 'Insane +']" :key="difficulty" :value="difficulty">{{ difficulty }}</option>
                            </select>
                        </label>

                        <label class="submit-record-field">
                            <span>Recommended enjoyment rating</span>
                            <select v-model="draft.enjoyment" required>
                                <option v-for="grade in ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F', 'F-']" :key="grade" :value="grade">{{ grade }}</option>
                            </select>
                        </label>

                        <label class="submit-record-field">
                            <span>Recommended Main List placement</span>
                            <div class="submit-record-percentage-input">
                                <input v-model.number="draft.position" type="number" min="1" max="150" step="1" required />
                                <span>#</span>
                            </div>
                            <small>This is your suggested rank, not a guaranteed placement. Moderators make the final decision.</small>
                        </label>

                        <div v-if="errorMessage" class="submit-record-alert error" role="alert">{{ errorMessage }}</div>
                        <div v-if="successMessage" class="submit-record-alert success" role="status">{{ successMessage }}</div>

                        <div class="submit-record-footer">
                            <p>Proposals are reviewed by the GVDL team. Approval adds the level at a moderator-confirmed position.</p>
                            <button class="submit-record-button" type="submit" :disabled="submitting">
                                {{ submitting ? 'Submitting...' : 'Submit Level Proposal' }}
                            </button>
                        </div>
                    </form>

                    <aside class="submit-record-guidelines">
                        <h2>Submission requirements</h2>
                        <ul>
                            <li>A verifier is mandatory. They must have completed the level at 100% to prove it is possible.</li>
                            <li>The verifier is not the first victor. First-victor status is earned separately by the first player to beat the level after publication.</li>
                            <li>Provide accurate creator credits and the correct level information.</li>
                            <li>Enjoyment and placement are recommendations only. The GVDL team decides the final rating and rank.</li>
                            <li>Submitting a proposal does not automatically add it to the list.</li>
                        </ul>
                        <div class="submit-record-review-note">
                            <strong>What happens next?</strong>
                            <p>Your proposal enters a separate moderation queue. If approved, moderators add it to the Main List. No first-victor record is created during this process.</p>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    `,
};
