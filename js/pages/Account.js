import { supabase, store } from '../main.js';

export default {
    data: () => ({
        store,

        activeTab: 'login',

        username: '',
        email: '',
        password: '',

        loading: false,
        message: '',
        messageType: '',
    }),

    computed: {
        loggedIn() {
            return !!this.store.user;
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

            this.showMessage('You have been logged out.', 'success');
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
                            <p>Welcome to GVDL.</p>
                        </div>

                        <div class="account-profile">
                            <div class="account-avatar">
                                {{ (store.profile?.username || store.user.email || '?').charAt(0).toUpperCase() }}
                            </div>

                            <div class="account-profile-info">
                                <h2>
                                    {{ store.profile?.username || 'Loading profile...' }}
                                </h2>
                                <p>{{ store.user.email }}</p>
                            </div>
                        </div>

                        <div class="account-details">
                            <div class="account-detail">
                                <span>Username</span>
                                <strong>
                                    {{ store.profile?.username || 'Not available' }}
                                </strong>
                            </div>

                            <div class="account-detail">
                                <span>Account role</span>
                                <strong>
                                    {{ store.profile?.role || 'Player' }}
                                </strong>
                            </div>

                            <div class="account-detail">
                                <span>Account status</span>
                                <strong>Logged in</strong>
                            </div>
                        </div>

                        <p
                            v-if="message"
                            class="account-message"
                            :class="messageType"
                        >
                            {{ message }}
                        </p>

                        <button
                            class="account-submit"
                            type="button"
                            :disabled="loading"
                            @click="logout"
                        >
                            {{ loading ? 'Logging out...' : 'Log Out' }}
                        </button>
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
