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

    setActiveList(list) {
        this.activeList = list;
        localStorage.setItem('activeList', list);
    },

    toggleDark() {
        this.dark = !this.dark;
        localStorage.setItem('dark', JSON.stringify(this.dark));
    },
});

const app = Vue.createApp({
    data: () => ({ store }),
});

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes,
});

app.use(router);

app.mount('#app');
