import { supabase, store } from '../main.js';

export default {
    data: () => ({
        store,

        activeTab: 'login',

        username: '',
        email: '',
        password: '',

        editUsername: '',
        editBio: '',
        editingProfile: false,

        loading: false,
        uploadingAvatar: false,
        uploadingBanner: false,
        bannerPreview: '',

        message: '',
        messageType: '',

        stats: {
            records: 0,
            completed: 0,
            progress: 0,
            firstVictories: 0,
        },
        statsLoading: true,
    }),

    computed: {
        loggedIn() {
            return !!this.store.user;
        },

        profile() {
            return this.store.profile;
        },

        previewUsername() {
            if (this.editingProfile) {
                return this.editUsername.trim() || 'Username';
            }

            return this.profile?.username || 'Username';
        },

        previewBio() {
            if (this.editingProfile) {
                return this.editBio.trim();
            }

            return this.profile?.bio || '';
        },

        usernameCooldown() {
            const changedAt = this.profile?.username_changed_at;

            if (!changedAt) return 0;

            const elapsed = Date.now() - new Date(changedAt).getTime();
            const remaining = 7 * 24 * 60 * 60 * 1000 - elapsed;

            return Math.max(0, remaining);
        },

        canChangeUsername() {
            return this.usernameCooldown === 0;
        },

        usernameCooldownText() {
            if (this.canChangeUsername) {
                return 'You can change your username.';
            }

            const days = Math.floor(
                this.usernameCooldown / (24 * 60 * 60 * 1000)
            );

            const hours = Math.floor(
                (this.usernameCooldown % (24 * 60 * 60 * 1000)) /
                (60 * 60 * 1000)
            );

            if (days > 0) {
                return `You can change your username again in ${days} day${days === 1 ? '' : 's'} and ${hours} hour${hours === 1 ? '' : 's'}.`;
            }

            return `You can change your username again in ${hours} hour${hours === 1 ? '' : 's'}.`;
        },

        registrationDate() {
            if (!this.profile?.created_at) return 'Not available';

            return new Date(this.profile.created_at).toLocaleDateString(
                'en-AU',
                {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                }
            );
        },

        avatarUrl() {
            return this.profile?.avatar_url || '';
        },

        bannerUrl() {
            return this.bannerPreview || this.profile?.banner_url || '';
        },
    },

    watch: {
        profile: {
            immediate: true,
            handler(profile) {
                if (!profile) return;

                this.editUsername = profile.username || '';
                this.editBio = profile.bio || '';
            },
        },

        'store.user': {
            immediate: true,
            handler(user) {
                if (user) {
                    this.loadPlayerStats(user.id);
                } else {
                    this.stats = {
                        records: 0,
                        completed: 0,
                        progress: 0,
                        firstVictories: 0,
                    };
                    this.statsLoading = false;
                }
            },
        },
    },

    beforeUnmount() {
        if (this.bannerPreview) {
            URL.revokeObjectURL(this.bannerPreview);
        }
    },

    methods: {
        async loadPlayerStats(userId) {
            this.statsLoading = true;

            const { data, error } = await supabase
                .from('player_records')
                .select('id, level_id, percentage, is_first_victor')
                .eq('player_id', userId);

            if (error) {
                console.error('Failed to load player statistics:', error);
                this.statsLoading = false;
                return;
            }

            const records = data || [];

            const completedLevels = new Set(
                records
                    .filter(record => Number(record.percentage) >= 100)
                    .map(record => record.level_id)
                    .filter(Boolean)
            );

            const progressLevels = new Set(
                records
                    .filter(record => Number(record.percentage) < 100)
                    .map(record => record.level_id)
                    .filter(Boolean)
            );

            this.stats = {
                records: records.length,
                completed: completedLevels.size,
                progress: progressLevels.size,
                firstVictories: records.filter(
                    record => record.is_first_victor
                ).length,
            };

            this.statsLoading = false;
        },

        switchTab(tab) {
            this.activeTab = tab;
            this.message = '';
            this.messageType = '';
            this.password = '';
        },

        async register() {
            this.message = '';
            this.messageType = '';

            const username = this.username.trim();
            const email = this.email.trim();

            if (!username || !email || !this.password) {
                this.showMessage('Please fill in every field.', 'error');
                return;
            }

            if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
                this.showMessage(
                    'Usernames must be 3–20 characters and can only contain letters, numbers and underscores.',
                    'error'
                );
                return;
            }

            if (this.password.length < 8) {
                this.showMessage(
                    'Your password must be at least 8 characters long.',
                    'error'
                );
                return;
            }

            this.loading = true;

            const { data, error } = await supabase.auth.signUp({
                email,
                password: this.password,
                options: {
                    data: {
                        username,
                    },
                },
            });

            this.loading = false;

            if (error) {
                this.showMessage(error.message, 'error');
                return;
            }

            this.password = '';

            if (data.session) {
                this.showMessage(
                    'Your account has been created successfully!',
                    'success'
                );
            } else {
                this.showMessage(
                    'Registration successful! Please check your email for a verification link before logging in.',
                    'success'
                );

                this.activeTab = 'login';
            }
        },

        async login() {
            this.message = '';
            this.messageType = '';

            if (!this.email.trim() || !this.password) {
                this.showMessage(
                    'Please enter your email and password.',
                    'error'
                );
                return;
            }

            this.loading = true;

            const { error } = await supabase.auth.signInWithPassword({
                email: this.email.trim(),
                password: this.password,
            });

            this.loading = false;

            if (error) {
                this.showMessage(error.message, 'error');
                return;
            }

            this.password = '';

            this.showMessage('Successfully logged in!', 'success');
        },

        async logout() {
            this.loading = true;

            const { error } = await supabase.auth.signOut();

            this.loading = false;

            if (error) {
                this.showMessage(error.message, 'error');
                return;
            }

            this.editingProfile = false;
            this.showMessage('You have been logged out.', 'success');
        },

        startEditingProfile() {
            this.editUsername = this.profile?.username || '';
            this.editBio = this.profile?.bio || '';
            this.editingProfile = true;

            this.message = '';
            this.messageType = '';
        },

        cancelEditingProfile() {
            this.editUsername = this.profile?.username || '';
            this.editBio = this.profile?.bio || '';
            this.editingProfile = false;
        },

        async saveProfile() {
            this.message = '';
            this.messageType = '';

            const username = this.editUsername.trim();
            const bio = this.editBio.trim();

            if (!username) {
                this.showMessage('Please enter a username.', 'error');
                return;
            }

            if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
                this.showMessage(
                    'Usernames must be 3–20 characters and can only contain letters, numbers and underscores.',
                    'error'
                );
                return;
            }

            if (bio.length > 160) {
                this.showMessage(
                    'Your biography cannot exceed 160 characters.',
                    'error'
                );
                return;
            }

            const usernameChanged = username !== this.profile.username;
            const bioChanged = bio !== (this.profile.bio || '');

            if (!usernameChanged && !bioChanged) {
                this.editingProfile = false;
                this.showMessage('No changes to save.', 'success');
                return;
            }

            if (usernameChanged && !this.canChangeUsername) {
                this.showMessage(this.usernameCooldownText, 'error');
                return;
            }

            const updates = {
                bio: bio || null,
            };

            if (usernameChanged) {
                updates.username = username;
            }

            this.loading = true;

            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', this.store.user.id)
                .select()
                .single();

            this.loading = false;

            if (error) {
                if (error.message.includes('7 days')) {
                    this.showMessage(
                        'You can only change your username once every 7 days.',
                        'error'
                    );
                } else if (
                    error.code === '23505' ||
                    error.message.toLowerCase().includes('unique')
                ) {
                    this.showMessage(
                        'That username is already taken.',
                        'error'
                    );
                } else {
                    this.showMessage(error.message, 'error');
                }

                return;
            }

            this.store.profile = data;
            this.editingProfile = false;

            this.showMessage('Your profile has been updated!', 'success');
        },

        async uploadAvatar(event) {
            const file = event.target.files?.[0];

            if (!file) return;

            event.target.value = '';

            if (!file.type.startsWith('image/')) {
                this.showMessage(
                    'Please select a valid image file.',
                    'error'
                );
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                this.showMessage(
                    'Your avatar must be smaller than 2 MB.',
                    'error'
                );
                return;
            }

            this.uploadingAvatar = true;
            this.message = '';

            const filePath = `${this.store.user.id}/avatar`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    upsert: true,
                    contentType: file.type,
                    cacheControl: '3600',
                });

            if (uploadError) {
                this.uploadingAvatar = false;
                this.showMessage(uploadError.message, 'error');
                return;
            }

            const { data: publicData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;

            const { data, error: updateError } = await supabase
                .from('profiles')
                .update({
                    avatar_url: avatarUrl,
                })
                .eq('id', this.store.user.id)
                .select()
                .single();

            this.uploadingAvatar = false;

            if (updateError) {
                this.showMessage(updateError.message, 'error');
                return;
            }

            this.store.profile = data;

            this.showMessage('Your avatar has been updated!', 'success');
        },

        async uploadBanner(event) {
            const file = event.target.files?.[0];

            if (!file) return;

            event.target.value = '';

            if (!file.type.startsWith('image/')) {
                this.showMessage(
                    'Please select a valid image file.',
                    'error'
                );
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                this.showMessage(
                    'Your banner must be smaller than 5 MB.',
                    'error'
                );
                return;
            }

            if (this.bannerPreview) {
                URL.revokeObjectURL(this.bannerPreview);
            }

            this.bannerPreview = URL.createObjectURL(file);
            this.uploadingBanner = true;
            this.message = '';

            const filePath = `${this.store.user.id}/banner`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    upsert: true,
                    contentType: file.type,
                    cacheControl: '3600',
                });

            if (uploadError) {
                this.uploadingBanner = false;

                if (this.bannerPreview) {
                    URL.revokeObjectURL(this.bannerPreview);
                    this.bannerPreview = '';
                }

                this.showMessage(uploadError.message, 'error');
                return;
            }

            const { data: publicData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const bannerUrl = `${publicData.publicUrl}?v=${Date.now()}`;

            const { data, error: updateError } = await supabase
                .from('profiles')
                .update({
                    banner_url: bannerUrl,
                })
                .eq('id', this.store.user.id)
                .select()
                .single();

            this.uploadingBanner = false;

            if (updateError) {
                if (this.bannerPreview) {
                    URL.revokeObjectURL(this.bannerPreview);
                    this.bannerPreview = '';
                }

                this.showMessage(updateError.message, 'error');
                return;
            }

            this.store.profile = data;

            if (this.bannerPreview) {
                URL.revokeObjectURL(this.bannerPreview);
                this.bannerPreview = '';
            }

            this.showMessage('Your profile banner has been updated!', 'success');
        },

        showMessage(message, type) {
            this.message = message;
            this.messageType = type;
        },
    },

    template: `
        <main class="page-account">
            <div class="account-dashboard">

                <template v-if="!store.authReady">
                    <div class="account-card">
                        <p class="account-loading">Loading account...</p>
                    </div>
                </template>

                <template v-else-if="loggedIn">

                    <template v-if="!profile">
                        <div class="account-card">
                            <p class="account-loading">
                                Loading your profile...
                            </p>
                        </div>
                    </template>

                    <template v-else>

                        <!-- LEFT: ACCOUNT SETTINGS -->
                        <section class="account-settings">

                            <div class="dashboard-heading">
                                <div>
                                    <h1>Account Settings</h1>
                                    <p>Manage your GVDL account.</p>
                                </div>
                            </div>

                            <div class="settings-section">
                                <div class="settings-section-heading">
                                    <div class="settings-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24">
                                            <circle cx="12" cy="8" r="3.5"></circle>
                                            <path d="M5 20c.5-3.7 3.2-5.5 7-5.5s6.5 1.8 7 5.5"></path>
                                        </svg>
                                    </div>
                                    <div>
                                        <h2>Profile</h2>
                                        <p>Your public player information.</p>
                                    </div>
                                </div>

                                <div class="account-avatar-editor">
                                    <div class="account-avatar">
                                        <img
                                            v-if="avatarUrl"
                                            :src="avatarUrl"
                                            alt="Profile avatar"
                                        />
                                        <span v-else>
                                            {{ profile.username.charAt(0).toUpperCase() }}
                                        </span>
                                    </div>

                                    <div>
                                        <label
                                            class="account-avatar-button"
                                            for="account-avatar-input"
                                        >
                                            {{ uploadingAvatar ? 'Uploading...' : 'Change Avatar' }}
                                        </label>

                                        <input
                                            id="account-avatar-input"
                                            class="account-file-input"
                                            type="file"
                                            accept="image/*"
                                            :disabled="uploadingAvatar"
                                            @change="uploadAvatar"
                                        />

                                        <p class="account-hint">
                                            Maximum size: 2 MB
                                        </p>
                                    </div>
                                </div>

                                <div class="account-banner-editor">
                                    <div class="account-banner-editor-heading">
                                        <strong>Profile Banner</strong>
                                        <span>Maximum size: 5 MB</span>
                                    </div>

                                    <label
                                        class="account-banner-button"
                                        for="account-banner-input"
                                    >
                                        {{ uploadingBanner ? 'Uploading...' : 'Change Banner' }}
                                    </label>

                                    <input
                                        id="account-banner-input"
                                        class="account-file-input"
                                        type="file"
                                        accept="image/*"
                                        :disabled="uploadingBanner"
                                        @change="uploadBanner"
                                    />

                                    <p class="account-hint">
                                        Choose an image to personalise the banner on your player profile.
                                    </p>
                                </div>

                                <template v-if="editingProfile">
                                    <form
                                        class="account-form account-edit-form"
                                        @submit.prevent="saveProfile"
                                    >
                                        <label for="edit-username">
                                            Username
                                        </label>

                                        <input
                                            id="edit-username"
                                            v-model="editUsername"
                                            type="text"
                                            minlength="3"
                                            maxlength="20"
                                            autocomplete="username"
                                            required
                                        />

                                        <p class="account-hint">
                                            {{ usernameCooldownText }}
                                        </p>

                                        <label for="edit-bio">
                                            Biography
                                        </label>

                                        <textarea
                                            id="edit-bio"
                                            v-model="editBio"
                                            maxlength="160"
                                            rows="4"
                                            placeholder="Tell the GVDL community about yourself..."
                                        ></textarea>

                                        <p class="account-hint account-character-count">
                                            {{ editBio.length }}/160 characters
                                        </p>

                                        <button
                                            class="account-submit"
                                            type="submit"
                                            :disabled="loading"
                                        >
                                            {{ loading ? 'Saving...' : 'Save Changes' }}
                                        </button>

                                        <button
                                            class="account-secondary"
                                            type="button"
                                            :disabled="loading"
                                            @click="cancelEditingProfile"
                                        >
                                            Cancel
                                        </button>
                                    </form>
                                </template>

                                <button
                                    v-else
                                    class="account-submit"
                                    type="button"
                                    @click="startEditingProfile"
                                >
                                    Edit Profile
                                </button>
                            </div>

                            <div class="settings-section">
                                <div class="settings-section-heading">
                                    <div class="settings-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24">
                                            <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                                            <path d="m4 7 8 6 8-6"></path>
                                        </svg>
                                    </div>
                                    <div>
                                        <h2>Account Information</h2>
                                        <p>Your login details.</p>
                                    </div>
                                </div>

                                <div class="settings-info">
                                    <span>Email address</span>
                                    <strong>{{ store.user.email }}</strong>
                                </div>
                            </div>

                            <div class="settings-section settings-security">
                                <div class="settings-section-heading">
                                    <div class="settings-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M12 3 19 6v5c0 4.8-2.8 8-7 10-4.2-2-7-5.2-7-10V6l7-3Z"></path>
                                            <path d="m9 12 2 2 4-4"></path>
                                        </svg>
                                    </div>
                                    <div>
                                        <h2>Security</h2>
                                        <p>Password and account protection.</p>
                                    </div>
                                </div>

                                <p class="settings-coming-soon">
                                    Password management and account deletion
                                    will be available here.
                                </p>
                            </div>

                            <div class="settings-bottom">
                                <p
                                    v-if="message"
                                    class="account-message"
                                    :class="messageType"
                                >
                                    {{ message }}
                                </p>

                                <button
                                    class="account-logout"
                                    type="button"
                                    :disabled="loading || uploadingAvatar || uploadingBanner"
                                    @click="logout"
                                >
                                    Log Out
                                </button>
                            </div>

                        </section>

                        <!-- RIGHT: PUBLIC PLAYER PROFILE -->
                        <section class="account-preview">

                            <div class="preview-heading">
                                <div>
                                    <h1>Player Profile</h1>
                                    <p>This is how your profile appears on GVDL.</p>
                                </div>

                                <span class="preview-public-label">
                                    <span></span>
                                    PLAYER PROFILE
                                </span>
                            </div>

                            <div class="player-profile-card">

                                <div class="player-profile-banner">
                                    <img
                                        v-if="bannerUrl"
                                        class="player-profile-banner-image"
                                        :src="bannerUrl"
                                        alt="Player profile banner"
                                    />
                                    <div
                                        v-else
                                        class="banner-pattern"
                                    ></div>
                                    <span class="banner-label">GVDL PLAYER</span>
                                </div>

                                <div class="player-profile-main">

                                    <div class="player-profile-avatar">
                                        <img
                                            v-if="avatarUrl"
                                            :src="avatarUrl"
                                            alt="Player avatar"
                                        />
                                        <span v-else>
                                            {{ previewUsername.charAt(0).toUpperCase() }}
                                        </span>
                                    </div>

                                    <div class="player-profile-identity">
                                        <div class="player-profile-name">
                                            <h2>{{ previewUsername }}</h2>
                                            <span class="player-role">
                                                {{ profile.role || 'Player' }}
                                            </span>
                                        </div>

                                        <p class="player-joined">
                                            Member since {{ registrationDate }}
                                        </p>
                                    </div>

                                    <div class="player-profile-bio">
                                        <h3>ABOUT</h3>

                                        <p v-if="previewBio">
                                            {{ previewBio }}
                                        </p>

                                        <p v-else class="player-no-bio">
                                            This player hasn't written a biography yet.
                                        </p>
                                    </div>

                                    <div class="player-profile-divider"></div>

                                    <div class="player-stats-heading">
                                        <h3>PLAYER STATISTICS</h3>
                                        <span>GVDL RECORDS</span>
                                    </div>

                                    <div
                                        v-if="statsLoading"
                                        class="player-stats-loading"
                                    >
                                        Loading statistics...
                                    </div>

                                    <div v-else class="player-stats-grid">

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

                            <div class="preview-note">
                                <span class="preview-note-icon">i</span>
                                <p>
                                    Your public profile will be accessible to
                                    other GVDL players once public player pages
                                    are implemented.
                                </p>
                            </div>

                        </section>

                    </template>
                </template>

                <!-- LOGIN AND REGISTRATION -->
                <template v-else>
                    <div class="account-card account-login-card">

                        <div class="account-heading">
                            <h1>GVDL Account</h1>
                            <p>Access your GVDL player account.</p>
                        </div>

                        <div class="account-tabs">
                            <button
                                type="button"
                                :class="{ active: activeTab === 'login' }"
                                @click="switchTab('login')"
                            >
                                Login
                            </button>

                            <button
                                type="button"
                                :class="{ active: activeTab === 'register' }"
                                @click="switchTab('register')"
                            >
                                Register
                            </button>
                        </div>

                        <form
                            v-if="activeTab === 'login'"
                            class="account-form"
                            @submit.prevent="login"
                        >
                            <h2>Welcome back!</h2>

                            <label for="account-email">
                                Email Address
                            </label>

                            <input
                                id="account-email"
                                v-model="email"
                                type="email"
                                placeholder="Enter your email"
                                autocomplete="email"
                                required
                            />

                            <label for="account-password">
                                Password
                            </label>

                            <input
                                id="account-password"
                                v-model="password"
                                type="password"
                                placeholder="Enter your password"
                                autocomplete="current-password"
                                required
                            />

                            <button
                                class="account-submit"
                                type="submit"
                                :disabled="loading"
                            >
                                {{ loading ? 'Logging in...' : 'Login' }}
                            </button>
                        </form>

                        <form
                            v-else
                            class="account-form"
                            @submit.prevent="register"
                        >
                            <h2>Create an account</h2>

                            <label for="account-username">
                                Username
                            </label>

                            <input
                                id="account-username"
                                v-model="username"
                                type="text"
                                placeholder="Choose a username"
                                autocomplete="username"
                                minlength="3"
                                maxlength="20"
                                required
                            />

                            <p class="account-hint">
                                3–20 characters. Letters, numbers and underscores only.
                            </p>

                            <label for="register-email">
                                Email Address
                            </label>

                            <input
                                id="register-email"
                                v-model="email"
                                type="email"
                                placeholder="Enter your email"
                                autocomplete="email"
                                required
                            />

                            <label for="register-password">
                                Password
                            </label>

                            <input
                                id="register-password"
                                v-model="password"
                                type="password"
                                placeholder="Create a password"
                                autocomplete="new-password"
                                minlength="8"
                                required
                            />

                            <p class="account-hint">
                                Your password must be at least 8 characters long.
                            </p>

                            <button
                                class="account-submit"
                                type="submit"
                                :disabled="loading"
                            >
                                {{ loading ? 'Creating account...' : 'Register' }}
                            </button>
                        </form>

                        <p
                            v-if="message"
                            class="account-message"
                            :class="messageType"
                        >
                            {{ message }}
                        </p>

                        <p class="account-footer">
                            GRAB VR Demon List
                        </p>
                    </div>
                </template>

            </div>
        </main>
    `,
};
