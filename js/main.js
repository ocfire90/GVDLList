import routes from './routes.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase configuration
const SUPABASE_URL = 'https://ggmbzscnyypytjpdjidh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_XY9DcRvz6iVnckqEMUgyPA_f9V-uxdi';

// Initialise Supabase
export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// Global website state
export const store = Vue.reactive({
    dark: JSON.parse(localStorage.getItem('dark')) || false,
    activeList: localStorage.getItem('activeList') || 'main',

    user: null,
    profile: null,
    authReady: false,

    // Current user's permission level
    get role() {
        return this.profile?.role || 'player';
    },

    // Permission checks
    get isAdmin() {
        return this.role === 'admin' || this.role === 'owner';
    },

    get isOwner() {
        return this.role === 'owner';
    },

    get canManageLists() {
        return this.isAdmin;
    },

    get canModerateUsers() {
        return this.isAdmin;
    },

    get canReviewSubmissions() {
        return this.isAdmin;
    },

    get canSubmitForOthers() {
        return this.isAdmin;
    },

    setActiveList(list) {
        this.activeList = list;
        localStorage.setItem('activeList', list);
    },

    toggleDark() {
        this.dark = !this.dark;
        localStorage.setItem('dark', JSON.stringify(this.dark));
    },
});

// Load a user's GVDL profile
async function loadProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error('Failed to load player profile:', error);
        store.profile = null;
        return;
    }

    store.profile = data;
}

// Restore an existing login session
async function restoreSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Failed to restore login session:', error);
    }

    store.user = data?.session?.user || null;

    if (store.user) {
        await loadProfile(store.user.id);
    }

    store.authReady = true;
}

restoreSession();

// Listen for login, logout and session changes
supabase.auth.onAuthStateChange((_event, session) => {
    store.user = session?.user || null;
    store.profile = null;

    if (store.user) {
        const userId = store.user.id;

        // Defer the profile request until the auth callback completes.
        Promise.resolve().then(() => loadProfile(userId));
    }

    store.authReady = true;
});

// Create Vue application
const app = Vue.createApp({
    data: () => ({ store }),
});

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes,
});

app.use(router);

app.mount('#app');
