import { supabase } from '../main.js';
import { fetchLeaderboard } from '../content.js';
import { localize } from '../util.js';

export default {
 data: () => ({ loading: true, error: '', identity: null, account: null, entry: null, rank: null }),
 template: `<main class="page-public-player"><section v-if="loading" class="public-player-card"><p>Loading player profile...</p></section><section v-else-if="error" class="public-player-card"><h1>Player not found</h1><p>{{ error }}</p><router-link to="/leaderboard">Return to leaderboard</router-link></section><section v-else class="public-player-card"><header class="public-player-heading"><div class="public-player-avatar"><img v-if="account && account.avatar_url" :src="account.avatar_url" alt="" /><span v-else>{{ identity.username.charAt(0).toUpperCase() }}</span></div><div><p class="public-player-eyebrow">GVDL PLAYER PROFILE</p><h1>{{ identity.username }}</h1><p v-if="account" class="public-player-linked">Linked account: {{ account.username }}</p><p v-else class="public-player-unlinked">Unclaimed leaderboard identity</p></div><div v-if="rank" class="public-player-rank"><strong>#{{ rank }}</strong><span>Leaderboard</span></div></header><p v-if="account && account.bio" class="public-player-bio">{{ account.bio }}</p><div class="public-player-stats"><div><strong>{{ entry ? localize(entry.total) : '0' }}</strong><span>Points</span></div><div><strong>{{ entry ? entry.completed.length : 0 }}</strong><span>Completions</span></div><div><strong>{{ entry ? entry.progressed.length : 0 }}</strong><span>Progressions</span></div></div><h2>Leaderboard activity</h2><div v-if="entry && entry.completed.length" class="public-player-records"><div v-for="(record, index) in entry.completed" :key="record.rank + '-' + record.level + '-' + index"><span>#{{ record.rank }} {{ record.level }}</span><strong>+{{ localize(record.score) }}</strong></div></div><p v-else class="public-player-empty">No completed levels are currently listed for this player.</p><router-link class="public-player-back" to="/leaderboard">Back to leaderboard</router-link></section></main>`,
 methods: { localize },
 async mounted() {
  const username = String(this.$route.params.username || '').trim();
  const { data: identity, error } = await supabase.from('leaderboard_players').select('id, username, account_id, claimed_at').ilike('username', username).maybeSingle();
  if (error || !identity) { this.error = 'This leaderboard identity does not exist.'; this.loading = false; return; }
  this.identity = identity;
  if (identity.account_id) { const { data } = await supabase.from('profiles').select('username, avatar_url, bio').eq('id', identity.account_id).maybeSingle(); this.account = data || null; }
  const [leaderboard] = await fetchLeaderboard('_list.json');
  const index = leaderboard.findIndex(item => item.user.toLowerCase() === identity.username.toLowerCase());
  if (index !== -1) { this.entry = leaderboard[index]; this.rank = index + 1; }
  this.loading = false;
 }
};