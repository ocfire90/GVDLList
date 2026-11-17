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

        message: '',
        messageType: '',
    }),

    computed: {
        loggedIn() {
            return !!this.store.user;
        },

        profile() {
            return this.store.profile;
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
    },

    methods: {
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

        showMessage(message, type) {
            this.message = message;
            this.messageType = type;
        },
    },

    template: `
        <main class="page-account">
            <div class="account-container">

                <template v-if="!store.authReady">
                    <div class="account-card">
                        <p class="account-loading">Loading account...</p>
                    </div>
                </template>

                <template v-else-if="loggedIn">
                    <div class="account-card">

                        <div class="account-heading">
                            <h1>Your Account</h1>
                            <p>Manage your GVDL player profile.</p>
                        </div>

                        <template v-if="!profile">
                            <p class="account-loading">
                                Loading your profile...
                            </p>
                        </template>

                        <template v-else>

                            <div class="account-profile">
                                <div class="account-avatar">
                                    <img
                                        v-if="avatarUrl"
                                        :src="avatarUrl"
                                        alt="Profile avatar"
                                    />

                                    <span v-else>
                                        {{ (profile.username || store.user.email || '?').charAt(0).toUpperCase() }}
                                    </span>
                                </div>

                                <div class="account-profile-info">
                                    <h2>{{ profile.username }}</h2>
                                    <p>{{ store.user.email }}</p>
                                </div>
                            </div>

                            <div class="account-avatar-controls">
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
                                    Images only. Maximum size: 2 MB.
                                </p>
                            </div>

                            <div class="account-bio">
                                <span>Biography</span>

                                <p v-if="profile.bio">
                                    {{ profile.bio }}
                                </p>

                                <p v-else class="account-empty-bio">
                                    This player hasn't written a biography yet.
                                </p>
                            </div>

                            <div class="account-details">
                                <div class="account-detail">
                                    <span>Username</span>
                                    <strong>{{ profile.username }}</strong>
                                </div>

                                <div class="account-detail">
                                    <span>Account role</span>
                                    <strong>{{ profile.role || 'Player' }}</strong>
                                </div>

                                <div class="account-detail">
                                    <span>Joined GVDL</span>
                                    <strong>{{ registrationDate }}</strong>
                                </div>

                                <div class="account-detail">
                                    <span>Account status</span>
                                    <strong>Logged in</strong>
                                </div>
                            </div>

                            <template v-if="editingProfile">
                                <form
                                    class="account-form account-edit-form"
                                    @submit.prevent="saveProfile"
                                >
                                    <h2>Edit Profile</h2>

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
                                        placeholder="Tell the GVDL community a little about yourself..."
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

                            <p
                                v-if="message"
                                class="account-message"
                                :class="messageType"
                            >
                                {{ message }}
                            </p>

                            <button
                                class="account-submit account-logout"
                                type="button"
                                :disabled="loading || uploadingAvatar"
                                @click="logout"
                            >
                                {{ loading ? 'Please wait...' : 'Log Out' }}
                            </button>

                        </template>
                    </div>
                </template>

                <template v-else>
                    <div class="account-card">

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
