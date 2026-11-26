import { supabase, store } from '../main.js';
import { fetchLeaderboard } from '../content.js';

export default {
    data: () => ({
        store,

        activeTab: 'login',
        activeSection: 'profile',
        activeAdminTab: 'overview',

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

        submissions: [],
        submissionsLoading: false,

        adminLoading: false,
        adminError: '',

        adminSubmissions: [],
        adminLevels: [],
        adminPlayers: [],
        adminLogs: [],
        adminRecords: [],
        importingLevels: false,
        importProgress: 0,
        importMessage: '',
        importMessageType: '',

        levelPositionDrafts: {},
        savingLevelPosition: null,

        adminListEntries: [],
        levelEditorOpen: false,
        levelEditorSaving: false,
        levelEditorRecordsLoading: false,
        levelEditorError: '',
        levelEditorMessage: '',
        levelEditorDraft: null,
        levelEditorRecords: [],
        levelEditorListOptions: [
            { key: 'main', label: 'Main List' },
            { key: 'platformer', label: 'Platformer List' },
            { key: 'challenge', label: 'Challenge List' },
            { key: 'created', label: 'Created List' },
            { key: 'upcoming', label: 'Upcoming List' },
        ],

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

        isAdmin() {
            return ['admin', 'owner'].includes(
                this.profile?.role?.toLowerCase()
            );
        },

        isOwner() {
            return this.profile?.role?.toLowerCase() === 'owner';
        },

        adminStats() {
            return {
                players: this.adminPlayers.length,
                levels: this.adminLevels.length,
                submissions: this.adminSubmissions.length,
                pending: this.adminSubmissions.filter(
                    item => item.status === 'pending'
                ).length,
                approved: this.adminSubmissions.filter(
                    item => item.status === 'approved'
                ).length,
                rejected: this.adminSubmissions.filter(
                    item => item.status === 'rejected'
                ).length,
                records: this.adminRecords.length,
            };
        },

        pendingSubmissions() {
            return this.adminSubmissions.filter(
                item => item.status === 'pending'
            );
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

                if (['admin', 'owner'].includes(profile.role?.toLowerCase())) {
                    this.loadAdminData();
                } else {
                    this.clearAdminData();
                }
            },
        },

        'store.user': {
            immediate: true,
            handler(user) {
                if (user) {
                    this.loadPlayerStats(user.id);
                    this.loadSubmissions(user.id);
                } else {
                    this.stats = {
                        records: 0,
                        completed: 0,
                        progress: 0,
                        firstVictories: 0,
                    };

                    this.submissions = [];
                    this.clearAdminData();

                    this.statsLoading = false;
                    this.submissionsLoading = false;
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
        setSection(section) {
            if (section === 'admin' && !this.isAdmin) return;

            this.activeSection = section;
            this.message = '';
            this.messageType = '';

            if (section !== 'admin') {
                this.editingProfile = false;
            }

            if (section === 'admin') {
                this.loadAdminData();
            }
        },

        setAdminTab(tab) {
            const allowedTabs = [
                'overview',
                'submissions',
                'levels',
                'players',
                'admins',
                'logs',
            ];

            if (!allowedTabs.includes(tab)) return;
            if (tab === 'admins' && !this.isOwner) return;

            this.activeAdminTab = tab;
        },

        clearAdminData() {
            this.adminSubmissions = [];
            this.adminLevels = [];
            this.adminPlayers = [];
            this.adminLogs = [];
            this.adminRecords = [];
            this.adminListEntries = [];
            this.levelEditorOpen = false;
            this.levelEditorDraft = null;
            this.levelEditorRecords = [];
            this.levelEditorRecordsLoading = false;
            this.levelPositionDrafts = {};
            this.adminError = '';
            this.adminLoading = false;

            if (this.activeSection === 'admin') {
                this.activeSection = 'profile';
            }
        },

        async loadAdminData() {
            if (!this.isAdmin || !this.store.user) return;

            this.adminLoading = true;
            this.adminError = '';

            const [
                submissionsResult,
                levelsResult,
                playersResult,
                logsResult,
                recordsResult,
                listEntriesResult,
            ] = await Promise.all([
                supabase
                    .from('record_submissions')
                    .select('id, submitted_by, level_id, percentage, video_url, status, moderator_note, submitted_at, reviewed_at')
                    .order('submitted_at', { ascending: false }),

                supabase
                    .from('levels')
                    .select('id, legacy_path, name, author, creators, verifier, game_id, verification_url, percent_to_qualify, password, first_victor_name, spreadsheet_rank, difficulty, enjoyment, points_reward, created_at')
                    .order('spreadsheet_rank', { ascending: true, nullsFirst: false }),

                supabase
                    .from('profiles')
                    .select('id, username, role, created_at')
                    .order('username', { ascending: true }),

                supabase
                    .from('moderation_logs')
                    .select('action, target_type, target_id, details, created_at')
                    .order('created_at', { ascending: false })
                    .limit(30),

                supabase
                    .from('player_records')
                    .select('id, level_id, player_id, player_name, percentage, video_url, is_first_victor, source, achieved_at')
                    .order('created_at', { ascending: true }),

                supabase
                    .from('level_list_entries')
                    .select('id, level_id, list_key, position')
                    .order('list_key', { ascending: true })
                    .order('position', { ascending: true }),

            ]);

            const errors = [
                submissionsResult.error,
                levelsResult.error,
                playersResult.error,
                logsResult.error,
                recordsResult.error,
                listEntriesResult.error,
            ].filter(Boolean);

            this.adminSubmissions = submissionsResult.data || [];

            this.adminLevels = (levelsResult.data || []).sort((a, b) => {
                const rankA = a.spreadsheet_rank ?? Infinity;
                const rankB = b.spreadsheet_rank ?? Infinity;

                return rankA - rankB;
            });

            this.levelPositionDrafts = {};

            this.adminLevels.forEach(level => {
                if (level.legacy_path && level.spreadsheet_rank != null) {
                    this.levelPositionDrafts[level.id] =
                        Number(level.spreadsheet_rank);
                }
            });

            this.adminPlayers = playersResult.data || [];
            this.adminLogs = logsResult.data || [];
            this.adminRecords = recordsResult.data || [];
            this.adminListEntries = listEntriesResult.data || [];

            if (errors.length) {
                console.error('Some Admin Panel data could not be loaded:', errors);

                this.adminError =
                    'Some dashboard information could not be loaded. Check your Supabase permissions and browser console.';
            }

            this.adminLoading = false;
        },

        createEmptyLevelDraft() {
            return {
                id: null,
                name: '',
                author: '',
                creators: [],
                verifier: '',
                game_id: '',
                legacy_path: '',
                verification_url: '',
                showcase_url: '',
                percent_to_qualify: 100,
                password: '',
                difficulty: '',
                enjoyment: '',
                points_reward: 0,
                // New levels join the Main List by default; admins can uncheck it
                // or add the level to other lists before saving.
                listKeys: ['main'],
                listPositions: {},
            };
        },

        async openLevelEditor(level = null) {
            const draft = this.createEmptyLevelDraft();

            if (level) {
                const memberships = this.adminListEntries.filter(
                    entry => entry.level_id === level.id
                );

                draft.id = level.id;
                draft.name = level.name || '';
                draft.author = level.author || '';
                // Preserve legacy database fields without exposing them as editor controls.
                draft.creators = Array.isArray(level.creators) ? level.creators : [];
                draft.verifier = level.verifier || '';
                draft.game_id = level.game_id || '';
                draft.legacy_path = level.legacy_path || '';
                draft.verification_url = level.verification_url || '';
                draft.showcase_url = level.showcase_url || '';
                draft.percent_to_qualify = Number(level.percent_to_qualify ?? 100);
                draft.password = level.password || '';
                draft.difficulty = level.difficulty || '';
                draft.enjoyment = level.enjoyment || '';
                draft.points_reward = Number(level.points_reward ?? 0);
                draft.listKeys = memberships.map(entry => entry.list_key);
                memberships.forEach(entry => {
                    draft.listPositions[entry.list_key] = Number(entry.position);
                });
            }

            this.levelEditorDraft = draft;
            this.levelEditorRecords = [];
            this.levelEditorError = '';
            this.levelEditorMessage = '';
            this.levelEditorOpen = true;
            this.levelEditorRecordsLoading = !!level;

            if (!level) return;

            try {
                const { data, error } = await supabase
                    .from('player_records')
                    .select('id, level_id, player_id, player_name, percentage, video_url, is_first_victor, source, achieved_at, created_at')
                    .eq('level_id', level.id)
                    .order('created_at', { ascending: true });

                if (!this.levelEditorOpen || this.levelEditorDraft?.id !== level.id) return;
                if (error) throw error;

                const records = data || [];
                this.levelEditorRecords = records.map(record => {
                    return {
                        id: record.id,
                        player_name: record.player_name || '',
                        percentage: Number(record.percentage),
                        // Keep existing metadata intact even though it is not editable in the panel.
                        video_url: record.video_url || '',
                        is_first_victor: !!record.is_first_victor,
                        achieved_at: record.achieved_at || null,
                        source: record.source || 'submission',
                    };
                });

                this.adminRecords = [
                    ...this.adminRecords.filter(record => record.level_id !== level.id),
                    ...records,
                ];
            } catch (error) {
                console.error('Could not load level records:', error);
                if (this.levelEditorOpen && this.levelEditorDraft?.id === level.id) {
                    this.levelEditorError = error.message || 'Could not load this level’s player records.';
                }
            } finally {
                if (this.levelEditorOpen && this.levelEditorDraft?.id === level.id) {
                    this.levelEditorRecordsLoading = false;
                }
            }
        },

        closeLevelEditor() {
            if (this.levelEditorSaving) return;
            this.levelEditorOpen = false;
            this.levelEditorDraft = null;
            this.levelEditorRecords = [];
            this.levelEditorRecordsLoading = false;
            this.levelEditorError = '';
            this.levelEditorMessage = '';
        },

        addLevelEditorRecord() {
            this.levelEditorRecords.push({
                id: null,
                player_name: '',
                percentage: 100,
                video_url: '',
                is_first_victor: false,
                achieved_at: '',
                source: 'submission',
            });
        },

        removeLevelEditorRecord(index) {
            this.levelEditorRecords.splice(index, 1);
        },

        setFirstVictorRecord(index, checked) {
            if (checked) {
                this.levelEditorRecords.forEach((record, recordIndex) => {
                    record.is_first_victor = recordIndex === index;
                });
                return;
            }

            if (this.levelEditorRecords[index]) {
                this.levelEditorRecords[index].is_first_victor = false;
            }
        },

        async saveLevelEditor() {
            if (!this.isAdmin || !this.store.user || !this.levelEditorDraft) return;
            if (this.levelEditorSaving || this.levelEditorRecordsLoading) return;

            const draft = this.levelEditorDraft;
            const name = String(draft.name || '').trim();
            const listKeys = [...new Set(draft.listKeys || [])];

            if (!name) {
                this.levelEditorError = 'A level name is required.';
                return;
            }

            const validKeys = this.levelEditorListOptions.map(option => option.key);
            if (listKeys.some(key => !validKeys.includes(key))) {
                this.levelEditorError = 'One or more selected lists are invalid.';
                return;
            }

            const records = this.levelEditorRecords.map(record => ({
                id: record.id || null,
                player_name: String(record.player_name || '').trim(),
                percentage: Number(record.percentage),
                video_url: String(record.video_url || '').trim() || null,
                is_first_victor: !!record.is_first_victor,
                achieved_at: record.achieved_at
                    ? new Date(record.achieved_at).toISOString()
                    : null,
                source: record.source === 'legacy_import' ? 'legacy_import' : 'submission',
            }));

            if (records.some(record => !record.player_name || !Number.isFinite(record.percentage) || record.percentage <= 0 || record.percentage > 100)) {
                this.levelEditorError = 'Every record needs a player name and a percentage greater than 0 and no higher than 100.';
                return;
            }

            if (records.filter(record => record.is_first_victor).length > 1) {
                this.levelEditorError = 'A level can only have one first victor.';
                return;
            }

            const firstVictor = records.find(record => record.is_first_victor);
            const listPositions = {};

            for (const key of listKeys) {
                const existingCount = this.adminListEntries.filter(
                    entry => entry.list_key === key && entry.level_id !== draft.id
                ).length;
                const requested = Number(draft.listPositions?.[key]);
                listPositions[key] = Number.isInteger(requested) && requested >= 1
                    ? requested
                    : existingCount + 1;
            }

            this.levelEditorSaving = true;
            this.levelEditorError = '';
            this.levelEditorMessage = '';

            try {
                const { data: savedLevelId, error: saveError } = await supabase.rpc(
                    'admin_save_complete_level',
                    {
                        p_level_id: draft.id || null,
                        p_name: name,
                        p_author: String(draft.author || '').trim() || null,
                        p_creators: Array.isArray(draft.creators) ? draft.creators : [],
                        p_verifier: String(draft.verifier || '').trim() || null,
                        p_game_id: String(draft.game_id || '').trim() || null,
                        p_legacy_path: String(draft.legacy_path || '').trim() || null,
                        p_verification_url: String(draft.verification_url || '').trim() || null,
                        p_showcase_url: String(draft.showcase_url || '').trim() || null,
                        p_percent_to_qualify: Number(draft.percent_to_qualify || 100),
                        p_password: String(draft.password || '').trim() || null,
                        p_first_victor_name: firstVictor?.player_name || null,
                        p_difficulty: String(draft.difficulty || '').trim() || null,
                        p_enjoyment: String(draft.enjoyment || '').trim() || null,
                        p_points_reward: Number(draft.points_reward || 0),
                        p_list_keys: listKeys,
                        p_list_positions: listPositions,
                        p_records: records,
                    }
                );

                if (saveError) throw saveError;
                if (!savedLevelId) throw new Error('The database did not return the saved level ID.');

                await this.loadAdminData();
                this.levelEditorOpen = false;
                this.levelEditorDraft = null;
                this.levelEditorRecords = [];
                this.showImportMessage(
                    `${name} was ${draft.id ? 'updated' : 'created'} successfully.`,
                    'success'
                );
            } catch (error) {
                console.error('Level save failed:', error);
                this.levelEditorError = error.message || 'Could not save this level.';
            } finally {
                this.levelEditorSaving = false;
            }
        },

        async deleteLevel(level) {
            if (!this.isAdmin || !level?.id) return;
            if (!window.confirm(`Delete "${level.name}" and all of its records and list placements? This cannot be undone.`)) return;

            try {
                const { error } = await supabase.rpc('admin_delete_level', {
                    p_level_id: level.id,
                });
                if (error) throw error;

                await this.loadAdminData();
                this.closeLevelEditor();
                this.showImportMessage(`${level.name} was deleted.`, 'success');
            } catch (error) {
                console.error('Level deletion failed:', error);
                this.levelEditorError = error.message || 'Could not delete this level.';
            }
        },

        async saveLevelPosition(level) {
            if (!this.isAdmin || !this.store.user || !level?.id) return;
            if (this.savingLevelPosition) return;

            const targetPosition = Number(this.levelPositionDrafts[level.id]);
            const mainListCount = this.adminListEntries.filter(
                entry => entry.list_key === 'main'
            ).length;

            if (!Number.isInteger(targetPosition) || targetPosition < 1 || targetPosition > mainListCount) {
                this.showImportMessage(
                    `Enter a valid Main List position between 1 and ${mainListCount}.`,
                    'error'
                );
                return;
            }

            this.savingLevelPosition = level.id;
            this.importMessage = '';
            this.importMessageType = '';

            try {
                const { error } = await supabase.rpc(
                    'admin_set_level_list_position',
                    {
                        p_level_id: level.id,
                        p_list_key: 'main',
                        p_position: targetPosition,
                    }
                );

                if (error) throw error;

                await this.loadAdminData();
                this.showImportMessage(
                    `${level.name} moved to Main List position #${targetPosition}.`,
                    'success'
                );
            } catch (error) {
                console.error('Level position update failed:', error);
                this.showImportMessage(
                    error.message || 'Could not update the level position.',
                    'error'
                );
                await this.loadAdminData();
            } finally {
                this.savingLevelPosition = null;
            }
        },

        async importMainList() {
            if (!this.isAdmin || !this.store.user) {
                this.showImportMessage(
                    'You must be logged in as an administrator to import levels.',
                    'error'
                );
                return;
            }

            if (this.importingLevels) return;

            this.importingLevels = true;
            this.importProgress = 0;
            this.importMessage = '';
            this.importMessageType = '';

            try {
                this.showImportMessage(
                    'Reading the Main List...',
                    'info'
                );

                const listResponse = await fetch('./data/_list.json', {
                    cache: 'no-store',
                });

                if (!listResponse.ok) {
                    throw new Error(
                        `Could not load data/_list.json. HTTP ${listResponse.status}.`
                    );
                }

                const paths = await listResponse.json();

                if (!Array.isArray(paths)) {
                    throw new Error('The Main List index is not a valid array.');
                }

                if (paths.length !== 150) {
                    throw new Error(
                        `Expected 150 Main List levels, but found ${paths.length}. No data was imported.`
                    );
                }

                this.showImportMessage(
                    'Loading all 150 level files...',
                    'info'
                );

                const levelRows = [];
                const leaderboardNames = new Map();
                const legacyRecordDrafts = [];

                for (let i = 0; i < paths.length; i += 1) {
                    const path = paths[i];

                    if (
                        typeof path !== 'string' ||
                        !/^[a-zA-Z0-9_-]+$/.test(path)
                    ) {
                        throw new Error(
                            `Invalid level path at Main List position ${i + 1}.`
                        );
                    }

                    const response = await fetch(`./data/${path}.json`, {
                        cache: 'no-store',
                    });

                    if (!response.ok) {
                        throw new Error(
                            `Could not load ${path}.json. HTTP ${response.status}. No data was imported.`
                        );
                    }

                    let level;

                    try {
                        level = await response.json();
                    } catch {
                        throw new Error(
                            `The file ${path}.json does not contain valid JSON. No data was imported.`
                        );
                    }

                    if (!level || typeof level !== 'object' || !level.name) {
                        throw new Error(
                            `The file ${path}.json is missing required level information. No data was imported.`
                        );
                    }

                    const percentToQualify =
                        level.percentToQualify == null
                            ? 100
                            : Number(level.percentToQualify);

                    if (
                        !Number.isFinite(percentToQualify) ||
                        percentToQualify <= 0 ||
                        percentToQualify > 100
                    ) {
                        throw new Error(
                            `${level.name} has an invalid qualification percentage. No data was imported.`
                        );
                    }

                    const pointsReward =
                        level.pointsReward == null
                            ? null
                            : Number(level.pointsReward);

                    if (
                        pointsReward !== null &&
                        (!Number.isFinite(pointsReward) || pointsReward < 0)
                    ) {
                        throw new Error(
                            `${level.name} has an invalid points reward. No data was imported.`
                        );
                    }

                    levelRows.push({
                        legacy_path: path,
                        game_id:
                            level.id == null
                                ? null
                                : String(level.id),
                        name: String(level.name),
                        author: level.author || null,
                        creators: Array.isArray(level.creators)
                            ? level.creators
                            : [],
                        verifier: level.verifier || null,
                        verification_url: level.verification || null,
                        showcase_url: level.showcase || null,
                        percent_to_qualify: percentToQualify,
                        password: level.password || null,
                        first_victor_name: level.firstVictor || null,

                        // The position in _list.json is the canonical rank.
                        spreadsheet_rank: i + 1,

                        difficulty: level.difficulty || null,
                        enjoyment: level.enjoyment || null,
                        points_reward: pointsReward,
                    });

                    const addLeaderboardName = name => {
                        if (typeof name !== 'string') return;

                        const cleanName = name.trim();

                        if (!cleanName) return;

                        const key = cleanName.toLowerCase();

                        if (!leaderboardNames.has(key)) {
                            leaderboardNames.set(key, cleanName);
                        }
                    };

                    addLeaderboardName(level.verifier);
                    addLeaderboardName(level.firstVictor);

                    if (Array.isArray(level.records)) {
                        level.records.forEach(record => {
                            const playerName = typeof record === 'string'
                                ? record.trim()
                                : String(record?.user || '').trim();
                            const percentage = typeof record === 'string'
                                ? 100
                                : Number(record?.percent);

                            if (!playerName) return;
                            addLeaderboardName(playerName);

                            if (Number.isFinite(percentage) && percentage > 0 && percentage <= 100) {
                                legacyRecordDrafts.push({
                                    legacy_path: path,
                                    player_name: playerName,
                                    percentage,
                                    video_url: typeof record === 'object' ? (record.link || null) : null,
                                });
                            }
                        });
                    }

                    this.importProgress = Math.round(
                        ((i + 1) / paths.length) * 30
                    );
                }

                this.showImportMessage(
                    'All 150 files loaded. Checking existing database entries...',
                    'info'
                );

                const { data: existingLevels, error: existingLevelsError } =
                    await supabase
                        .from('levels')
                        .select('id, legacy_path');

                if (existingLevelsError) {
                    throw new Error(
                        `Could not check existing levels: ${existingLevelsError.message}`
                    );
                }

                const existingLevelMap = new Map(
                    (existingLevels || [])
                        .filter(level => level.legacy_path)
                        .map(level => [level.legacy_path, level])
                );

                const levelsToInsert = [];
                const levelsToUpdate = [];

                for (const row of levelRows) {
                    const existing = existingLevelMap.get(row.legacy_path);

                    if (existing) {
                        levelsToUpdate.push({
                            id: existing.id,
                            values: row,
                        });
                    } else {
                        levelsToInsert.push(row);
                    }
                }

                let insertedLevels = 0;
                let updatedLevels = 0;

                if (levelsToInsert.length) {
                    const { data, error } = await supabase
                        .from('levels')
                        .insert(levelsToInsert)
                        .select('id');

                    if (error) {
                        throw new Error(
                            `Could not insert new levels: ${error.message}`
                        );
                    }

                    insertedLevels = data?.length || levelsToInsert.length;
                }

                for (
                    let i = 0;
                    i < levelsToUpdate.length;
                    i += 10
                ) {
                    const batch = levelsToUpdate.slice(i, i + 10);

                    const results = await Promise.all(
                        batch.map(item =>
                            supabase
                                .from('levels')
                                .update(item.values)
                                .eq('id', item.id)
                        )
                    );

                    const failedUpdate = results.find(result => result.error);

                    if (failedUpdate) {
                        throw new Error(
                            `Could not update an existing level: ${failedUpdate.error.message}`
                        );
                    }

                    updatedLevels += batch.length;

                    this.importProgress = 30 + Math.round(
                        (updatedLevels / Math.max(levelsToUpdate.length, 1)) * 35
                    );
                }

                const { data: resolvedLevels, error: resolvedLevelsError } = await supabase
                    .from('levels')
                    .select('id, legacy_path')
                    .in('legacy_path', paths);

                if (resolvedLevelsError) {
                    throw new Error('Levels were imported, but legacy records could not be mapped: ' + resolvedLevelsError.message);
                }

                const levelIdByPath = new Map((resolvedLevels || []).map(level => [level.legacy_path, level.id]));
                const { data: existingRecords, error: existingRecordsError } = await supabase
                    .from('player_records')
                    .select('level_id, player_name, percentage');

                if (existingRecordsError) {
                    throw new Error('Levels were imported, but existing records could not be checked: ' + existingRecordsError.message);
                }

                const existingRecordKeys = new Set((existingRecords || []).map(record =>
                    String(record.level_id) + '|' + record.player_name.trim().toLowerCase() + '|' + Number(record.percentage)
                ));

                const legacyRecordsToInsert = [];
                for (const record of legacyRecordDrafts) {
                    const levelId = levelIdByPath.get(record.legacy_path);
                    if (!levelId) continue;

                    const key = String(levelId) + '|' + record.player_name.toLowerCase() + '|' + record.percentage;
                    if (existingRecordKeys.has(key)) continue;
                    existingRecordKeys.add(key);

                    legacyRecordsToInsert.push({
                        level_id: levelId,
                        player_id: null,
                        player_name: record.player_name,
                        percentage: record.percentage,
                        video_url: record.video_url,
                        is_first_victor: false,
                        source: 'legacy_import',
                    });
                }

                let insertedLegacyRecords = 0;
                for (let i = 0; i < legacyRecordsToInsert.length; i += 100) {
                    const batch = legacyRecordsToInsert.slice(i, i + 100);
                    const { data, error } = await supabase
                        .from('player_records')
                        .insert(batch)
                        .select('id');
                    if (error) {
                        throw new Error('Leaderboard identities were prepared, but legacy records could not be imported: ' + error.message);
                    }
                    insertedLegacyRecords += data?.length || batch.length;
                }

                this.showImportMessage(
                    'Levels imported. Checking leaderboard player identities...',
                    'info'
                );

                const { data: existingPlayers, error: existingPlayersError } =
                    await supabase
                        .from('leaderboard_players')
                        .select('username');

                if (existingPlayersError) {
                    throw new Error(
                        `Levels were imported, but existing leaderboard identities could not be checked: ${existingPlayersError.message}`
                    );
                }

                const existingNames = new Set(
                    (existingPlayers || []).map(player =>
                        String(player.username).toLowerCase()
                    )
                );

                const namesToInsert = [];

                for (const [key, username] of leaderboardNames.entries()) {
                    if (!existingNames.has(key)) {
                        namesToInsert.push({ username });
                    }
                }

                let insertedPlayers = 0;

                for (let i = 0; i < namesToInsert.length; i += 100) {
                    const batch = namesToInsert.slice(i, i + 100);

                    const { data, error } = await supabase
                        .from('leaderboard_players')
                        .insert(batch)
                        .select('id');

                    if (error) {
                        throw new Error(
                            `Levels were imported, but leaderboard identities could not be created: ${error.message}`
                        );
                    }

                    insertedPlayers += data?.length || batch.length;
                }

                this.importProgress = 100;

                await this.loadAdminData();

                this.showImportMessage(
                    `Import complete! ${insertedLevels} levels added, ${updatedLevels} levels updated, ${insertedPlayers} new leaderboard identities created, and ${insertedLegacyRecords} historical records imported. Existing identities were preserved.`,
                    'success'
                );
            } catch (error) {
                console.error('Main List import failed:', error);

                this.showImportMessage(
                    error.message || 'The Main List import failed.',
                    'error'
                );

                await this.loadAdminData();
            } finally {
                this.importingLevels = false;
            }
        },

        showImportMessage(message, type) {
            this.importMessage = message;
            this.importMessageType = type;
        },

        formatDate(date) {
            if (!date) return 'Not available';

            return new Date(date).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        },

        formatDateTime(date) {
            if (!date) return 'Not available';

            return new Date(date).toLocaleString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        },

        shortId(id) {
            if (!id) return 'Unknown';

            return `${id.slice(0, 8)}...`;
        },

        async loadPlayerStats(userId) {
            this.statsLoading = true;
            try {
                const { data: account, error: accountError } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', userId)
                    .maybeSingle();

                if (accountError) throw accountError;

                if (!account?.username) {
                    this.stats = { records: 0, completed: 0, progress: 0, firstVictories: 0 };
                    return;
                }

                const [leaderboard] = await fetchLeaderboard('_list.json');
                const entry = leaderboard.find(item =>
                    item.user.toLowerCase() === account.username.toLowerCase()
                );

                if (!entry) {
                    this.stats = { records: 0, completed: 0, progress: 0, firstVictories: 0 };
                    return;
                }

                const firstVictories = entry.completed.filter(item => item.type === 'first-victor').length;
                const normalCompletions = entry.completed.filter(item => item.type === 'completion').length;
                this.stats = {
                    records: entry.completed.length + entry.progressed.length,
                    completed: normalCompletions,
                    progress: entry.progressed.length,
                    firstVictories,
                };
            } catch (error) {
                console.error('Failed to load player statistics:', error);
                this.stats = { records: 0, completed: 0, progress: 0, firstVictories: 0 };
            } finally {
                this.statsLoading = false;
            }
        },

        async loadSubmissions(userId) {
            this.submissionsLoading = true;

            const { data, error } = await supabase
                .from('record_submissions')
                .select('id, level_id, percentage, status, moderator_note, submitted_at, reviewed_at, levels(name)')
                .eq('submitted_by', userId)
                .order('submitted_at', { ascending: false });

            if (error) {
                console.error('Failed to load record submissions:', error);
                this.submissions = [];
                this.submissionsLoading = false;
                return;
            }

            this.submissions = data || [];
            this.submissionsLoading = false;
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
                            <p class="account-loading">Loading your profile...</p>
                        </div>
                    </template>

                    <template v-else>

                        <aside class="account-sidebar">
                            <div class="account-sidebar-heading">
                                <h1>My Account</h1>
                                <p>Manage your GVDL account.</p>
                            </div>

                            <nav class="account-navigation">

                                <button
                                    type="button"
                                    :class="{ active: activeSection === 'profile' }"
                                    @click="setSection('profile')"
                                >
                                    <span class="account-nav-icon">
                                        <svg viewBox="0 0 24 24">
                                            <circle cx="12" cy="8" r="3.5"></circle>
                                            <path d="M5 20c.5-3.7 3.2-5.5 7-5.5s6.5 1.8 7 5.5"></path>
                                        </svg>
                                    </span>
                                    <span class="account-nav-text">
                                        <strong>Player Profile</strong>
                                        <small>Your public profile</small>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    :class="{ active: activeSection === 'settings' }"
                                    @click="setSection('settings')"
                                >
                                    <span class="account-nav-icon">
                                        <svg viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="3"></circle>
                                            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.8.1l-.2.1h-3.4l-.1-.2a1.7 1.7 0 0 0-1.7-.9l-.2.1-2.9-1.7.1-.2a1.7 1.7 0 0 0-.1-1.8l-.1-.2v-3.4l.2-.1a1.7 1.7 0 0 0 .9-1.7l-.1-.2 1.7-2.9.2.1a1.7 1.7 0 0 0 1.8-.1l.2-.1h3.4l.1.2a1.7 1.7 0 0 0 1.7.9l.2-.1 2.9 1.7-.1.2a1.7 1.7 0 0 0 .1 1.8l.1.2z"></path>
                                        </svg>
                                    </span>
                                    <span class="account-nav-text">
                                        <strong>Account Settings</strong>
                                        <small>Personal information</small>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    :class="{ active: activeSection === 'submissions' }"
                                    @click="setSection('submissions')"
                                >
                                    <span class="account-nav-icon">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M8 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"></path>
                                            <rect x="8" y="2" width="8" height="5" rx="1"></rect>
                                            <path d="m8 13 2.5 2.5L16 10"></path>
                                        </svg>
                                    </span>
                                    <span class="account-nav-text">
                                        <strong>Record Submissions</strong>
                                        <small>Track your submissions</small>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    :class="{ active: activeSection === 'customization' }"
                                    @click="setSection('customization')"
                                >
                                    <span class="account-nav-icon">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.5-3.3 1.8 1.8 0 0 1 1.4-3h.6A4 4 0 0 0 21 10.6C21 6.4 17 3 12 3Z"></path>
                                            <circle cx="7.5" cy="10" r="1"></circle>
                                            <circle cx="11" cy="7" r="1"></circle>
                                            <circle cx="15.5" cy="8" r="1"></circle>
                                        </svg>
                                    </span>
                                    <span class="account-nav-text">
                                        <strong>Website Customization</strong>
                                        <small>Personalise your experience</small>
                                    </span>
                                </button>

                                <button
                                    v-if="isAdmin"
                                    type="button"
                                    class="account-admin-nav"
                                    :class="{ active: activeSection === 'admin' }"
                                    @click="setSection('admin')"
                                >
                                    <span class="account-nav-icon">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z"></path>
                                            <path d="m9 12 2 2 4-4"></path>
                                        </svg>
                                    </span>
                                    <span class="account-nav-text">
                                        <strong>Admin Panel</strong>
                                        <small>Manage GVDL</small>
                                    </span>
                                    <span class="admin-nav-role">
                                        {{ isOwner ? 'OWNER' : 'ADMIN' }}
                                    </span>
                                </button>

                            </nav>

                            <div class="account-sidebar-footer">
                                <div class="sidebar-user">
                                    <div class="sidebar-user-avatar">
                                        <img
                                            v-if="avatarUrl"
                                            :src="avatarUrl"
                                            alt=""
                                        />
                                        <span v-else>
                                            {{ profile.username.charAt(0).toUpperCase() }}
                                        </span>
                                    </div>
                                    <div>
                                        <strong>{{ profile.username }}</strong>
                                        <small>{{ profile.role || 'Player' }}</small>
                                    </div>
                                </div>

                                <button
                                    class="account-logout"
                                    type="button"
                                    :disabled="loading || uploadingAvatar || uploadingBanner"
                                    @click="logout"
                                >
                                    Log Out
                                </button>
                            </div>
                        </aside>

                        <section class="account-content">

                            <!-- PLAYER PROFILE -->
                            <template v-if="activeSection === 'profile'">

                                <div class="content-heading">
                                    <div>
                                        <h1>Player Profile</h1>
                                        <p>Your public identity and GVDL statistics.</p>
                                    </div>
                                    <span class="content-tag">PLAYER PROFILE</span>
                                </div>

                                <div class="player-profile-card">

                                    <div class="player-profile-banner">
                                        <img
                                            v-if="bannerUrl"
                                            class="player-profile-banner-image"
                                            :src="bannerUrl"
                                            alt="Player profile banner"
                                        />
                                        <div v-else class="banner-pattern"></div>
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

                                        <div v-if="statsLoading" class="player-stats-loading">
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

                            </template>

                            <!-- ACCOUNT SETTINGS -->
                            <template v-else-if="activeSection === 'settings'">

                                <div class="content-heading">
                                    <div>
                                        <h1>Account Settings</h1>
                                        <p>Manage your personal information and account security.</p>
                                    </div>
                                </div>

                                <div class="account-content-section">
                                    <div class="content-section-heading">
                                        <h2>Profile Information</h2>
                                        <p>Update your avatar, banner and personal details.</p>
                                    </div>

                                    <div class="account-avatar-editor">
                                        <div class="account-avatar">
                                            <img v-if="avatarUrl" :src="avatarUrl" alt="Profile avatar" />
                                            <span v-else>
                                                {{ profile.username.charAt(0).toUpperCase() }}
                                            </span>
                                        </div>

                                        <div>
                                            <label class="account-avatar-button" for="account-avatar-input">
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

                                            <p class="account-hint">Maximum size: 2 MB</p>
                                        </div>
                                    </div>

                                    <div class="account-banner-editor">
                                        <div class="account-banner-editor-heading">
                                            <strong>Profile Banner</strong>
                                            <span>Maximum size: 5 MB</span>
                                        </div>

                                        <label class="account-banner-button" for="account-banner-input">
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
                                            Choose an image to personalise your player profile.
                                        </p>
                                    </div>

                                    <template v-if="editingProfile">
                                        <form class="account-form account-edit-form" @submit.prevent="saveProfile">
                                            <label for="edit-username">Username</label>

                                            <input
                                                id="edit-username"
                                                v-model="editUsername"
                                                type="text"
                                                minlength="3"
                                                maxlength="20"
                                                autocomplete="username"
                                                required
                                            />

                                            <p class="account-hint">{{ usernameCooldownText }}</p>

                                            <label for="edit-bio">Biography</label>

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

                                            <button class="account-submit" type="submit" :disabled="loading">
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
                                        class="account-submit account-edit-button"
                                        type="button"
                                        @click="startEditingProfile"
                                    >
                                        Edit Profile Information
                                    </button>
                                </div>

                                <div class="account-content-section">
                                    <div class="content-section-heading">
                                        <h2>Account Information</h2>
                                        <p>Your login and registration details.</p>
                                    </div>

                                    <div class="settings-info">
                                        <span>Email address</span>
                                        <strong>{{ store.user.email }}</strong>
                                    </div>

                                    <div class="settings-info">
                                        <span>Member since</span>
                                        <strong>{{ registrationDate }}</strong>
                                    </div>
                                </div>

                                <div class="account-content-section">
                                    <div class="content-section-heading">
                                        <h2>Security</h2>
                                        <p>Password and account protection.</p>
                                    </div>

                                    <div class="settings-coming-soon">
                                        Password management and account deletion will be available here.
                                    </div>
                                </div>

                                <p v-if="message" class="account-message" :class="messageType">
                                    {{ message }}
                                </p>

                            </template>

                            <!-- RECORD SUBMISSIONS -->
                            <template v-else-if="activeSection === 'submissions'">

                                <div class="content-heading">
                                    <div>
                                        <h1>Record Submissions</h1>
                                        <p>Track the progress of your submitted records.</p>
                                    </div>
                                </div>

                                <div class="submission-summary">
                                    <div>
                                        <strong>{{ submissions.length }}</strong>
                                        <span>Total Submissions</span>
                                    </div>
                                    <div>
                                        <strong>{{ submissions.filter(item => item.status === 'pending').length }}</strong>
                                        <span>Pending</span>
                                    </div>
                                    <div>
                                        <strong>{{ submissions.filter(item => item.status === 'approved').length }}</strong>
                                        <span>Approved</span>
                                    </div>
                                    <div>
                                        <strong>{{ submissions.filter(item => item.status === 'rejected').length }}</strong>
                                        <span>Rejected</span>
                                    </div>
                                </div>

                                <div v-if="submissionsLoading" class="empty-state">
                                    Loading your submissions...
                                </div>

                                <div v-else-if="submissions.length" class="submission-list">

                                    <article
                                        v-for="submission in submissions"
                                        :key="submission.id"
                                        class="submission-card"
                                    >
                                        <div class="submission-card-heading">
                                            <div>
                                                <h2>{{ submission.levels?.name || 'Level submission' }}</h2>
                                                <p>Submitted {{ formatDate(submission.submitted_at) }}</p>
                                            </div>

                                            <span
                                                class="submission-status"
                                                :class="submission.status"
                                            >
                                                {{ submission.status }}
                                            </span>
                                        </div>

                                        <div class="submission-details">
                                            <span>Progress</span>
                                            <strong>{{ submission.percentage }}%</strong>
                                        </div>

                                        <div
                                            v-if="submission.moderator_note"
                                            class="moderator-feedback"
                                        >
                                            <strong>Moderator feedback</strong>
                                            <p>{{ submission.moderator_note }}</p>
                                        </div>
                                    </article>

                                </div>

                                <div v-else class="empty-state">
                                    <div class="empty-state-icon">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M8 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"></path>
                                            <rect x="8" y="2" width="8" height="5" rx="1"></rect>
                                            <path d="M8 13h8M8 17h5"></path>
                                        </svg>
                                    </div>
                                    <h2>No submissions yet</h2>
                                    <p>Your record submissions will appear here once you submit one.</p>
                                </div>

                            </template>

                            <!-- WEBSITE CUSTOMIZATION -->
                            <template v-else-if="activeSection === 'customization'">

                                <div class="content-heading">
                                    <div>
                                        <h1>Website Customization</h1>
                                        <p>Personalise how GVDL looks and feels.</p>
                                    </div>
                                </div>

                                <div class="account-content-section">
                                    <div class="content-section-heading">
                                        <h2>Appearance</h2>
                                        <p>Choose the visual theme used across the website.</p>
                                    </div>

                                    <div class="customization-option">
                                        <div class="customization-option-info">
                                            <strong>Dark Mode</strong>
                                            <p>Use the darker GVDL colour scheme.</p>
                                        </div>

                                        <button
                                            type="button"
                                            class="theme-toggle"
                                            :class="{ enabled: store.dark }"
                                            :aria-pressed="store.dark"
                                            @click="store.toggleDark()"
                                        >
                                            <span></span>
                                            {{ store.dark ? 'On' : 'Off' }}
                                        </button>
                                    </div>
                                </div>

                                <div class="account-content-section">
                                    <div class="content-section-heading">
                                        <h2>More Customization</h2>
                                        <p>Additional personalisation options will be added here.</p>
                                    </div>

                                    <div class="settings-coming-soon">
                                        More display preferences and profile customisation options are planned for a future update.
                                    </div>
                                </div>

                            </template>

                            <!-- ADMIN PANEL -->
                            <template v-else-if="activeSection === 'admin' && isAdmin">

                                <div class="content-heading admin-heading">
                                    <div>
                                        <h1>Admin Panel</h1>
                                        <p>Manage the GVDL community and its competitive records.</p>
                                    </div>

                                    <div class="admin-heading-actions">
                                        <span class="admin-role-tag">
                                            {{ isOwner ? 'OWNER ACCESS' : 'ADMIN ACCESS' }}
                                        </span>

                                        <button
                                            type="button"
                                            class="admin-refresh-button"
                                            :disabled="adminLoading"
                                            @click="loadAdminData"
                                        >
                                            {{ adminLoading ? 'Refreshing...' : 'Refresh' }}
                                        </button>
                                    </div>
                                </div>

                                <div v-if="adminError" class="admin-error">
                                    {{ adminError }}
                                </div>

                                <div class="admin-tabs">
                                    <button
                                        v-for="tab in [
                                            { id: 'overview', label: 'Overview' },
                                            { id: 'submissions', label: 'Submissions' },
                                            { id: 'levels', label: 'Levels' },
                                            { id: 'players', label: 'Players' },
                                            ...(isOwner ? [{ id: 'admins', label: 'Admins' }] : []),
                                            { id: 'logs', label: 'Activity Logs' },
                                        ]"
                                        :key="tab.id"
                                        type="button"
                                        :class="{ active: activeAdminTab === tab.id }"
                                        @click="setAdminTab(tab.id)"
                                    >
                                        {{ tab.label }}
                                        <span v-if="tab.id === 'submissions' && adminStats.pending">
                                            {{ adminStats.pending }}
                                        </span>
                                    </button>
                                </div>

                                <div v-if="adminLoading" class="admin-loading">
                                    Loading administration data...
                                </div>

                                <template v-else>

                                    <!-- ADMIN OVERVIEW -->
                                    <template v-if="activeAdminTab === 'overview'">

                                        <div class="admin-welcome">
                                            <div>
                                                <span class="admin-eyebrow">GVDL ADMINISTRATION</span>
                                                <h2>Welcome back, {{ profile.username }}.</h2>
                                                <p>
                                                    You have {{ isOwner ? 'full owner' : 'administrator' }}
                                                    access to the GVDL management system.
                                                </p>
                                            </div>
                                            <div class="admin-welcome-icon">
                                                <svg viewBox="0 0 24 24">
                                                    <path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z"></path>
                                                    <path d="m9 12 2 2 4-4"></path>
                                                </svg>
                                            </div>
                                        </div>

                                        <div class="admin-stat-grid">
                                            <div class="admin-stat-card">
                                                <span>Total Players</span>
                                                <strong>{{ adminStats.players }}</strong>
                                                <small>Registered accounts</small>
                                            </div>

                                            <div class="admin-stat-card">
                                                <span>Total Levels</span>
                                                <strong>{{ adminStats.levels }}</strong>
                                                <small>Levels in database</small>
                                            </div>

                                            <div class="admin-stat-card">
                                                <span>Pending Submissions</span>
                                                <strong>{{ adminStats.pending }}</strong>
                                                <small>Awaiting review</small>
                                            </div>

                                            <div class="admin-stat-card">
                                                <span>Player Records</span>
                                                <strong>{{ adminStats.records }}</strong>
                                                <small>Stored records</small>
                                            </div>
                                        </div>

                                        <div class="admin-overview-grid">
                                            <div class="admin-overview-card">
                                                <div class="admin-card-heading">
                                                    <div>
                                                        <h2>Submission Overview</h2>
                                                        <p>Current record submission statuses.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        @click="setAdminTab('submissions')"
                                                    >
                                                        View all
                                                    </button>
                                                </div>

                                                <div class="admin-status-row">
                                                    <span>Pending</span>
                                                    <strong>{{ adminStats.pending }}</strong>
                                                </div>
                                                <div class="admin-status-row">
                                                    <span>Approved</span>
                                                    <strong>{{ adminStats.approved }}</strong>
                                                </div>
                                                <div class="admin-status-row">
                                                    <span>Rejected</span>
                                                    <strong>{{ adminStats.rejected }}</strong>
                                                </div>
                                            </div>

                                            <div class="admin-overview-card">
                                                <div class="admin-card-heading">
                                                    <div>
                                                        <h2>Administration</h2>
                                                        <p>Your current access level.</p>
                                                    </div>
                                                </div>

                                                <div class="admin-access-detail">
                                                    <span>Signed in as</span>
                                                    <strong>{{ profile.username }}</strong>
                                                </div>

                                                <div class="admin-access-detail">
                                                    <span>Permission level</span>
                                                    <strong class="admin-access-role">
                                                        {{ profile.role }}
                                                    </strong>
                                                </div>

                                                <div class="admin-access-detail">
                                                    <span>Admin accounts</span>
                                                    <strong>
                                                        {{ adminPlayers.filter(player => ['admin', 'owner'].includes(player.role?.toLowerCase())).length }}
                                                    </strong>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="admin-overview-card admin-recent-activity">
                                            <div class="admin-card-heading">
                                                <div>
                                                    <h2>Recent Activity</h2>
                                                    <p>Latest recorded moderation actions.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    @click="setAdminTab('logs')"
                                                >
                                                    View logs
                                                </button>
                                            </div>

                                            <div v-if="adminLogs.length" class="admin-log-list">
                                                <div
                                                    v-for="(log, index) in adminLogs.slice(0, 5)"
                                                    :key="log.created_at + '-' + index"
                                                    class="admin-log-row"
                                                >
                                                    <div>
                                                        <strong>{{ log.action }}</strong>
                                                        <small>
                                                            {{ log.target_type || 'System' }}
                                                            <template v-if="log.target_id">
                                                                · {{ shortId(log.target_id) }}
                                                            </template>
                                                        </small>
                                                    </div>
                                                    <time>{{ formatDateTime(log.created_at) }}</time>
                                                </div>
                                            </div>

                                            <div v-else class="admin-empty-inline">
                                                No moderation activity has been recorded yet.
                                            </div>
                                        </div>

                                    </template>

                                    <!-- ADMIN SUBMISSIONS -->
                                    <template v-else-if="activeAdminTab === 'submissions'">

                                        <div class="admin-section-intro">
                                            <h2>Record Submissions</h2>
                                            <p>Review the records submitted by GVDL players.</p>
                                        </div>

                                        <div class="admin-filter-summary">
                                            <span>{{ adminSubmissions.length }} total</span>
                                            <span>{{ adminStats.pending }} pending</span>
                                            <span>{{ adminStats.approved }} approved</span>
                                            <span>{{ adminStats.rejected }} rejected</span>
                                        </div>

                                        <div v-if="adminSubmissions.length" class="admin-table-list">
                                            <article
                                                v-for="submission in adminSubmissions"
                                                :key="submission.id"
                                                class="admin-submission-card"
                                            >
                                                <div class="admin-submission-top">
                                                    <div>
                                                        <strong>{{ shortId(submission.id) }}</strong>
                                                        <small>Submitted {{ formatDateTime(submission.submitted_at) }}</small>
                                                    </div>

                                                    <span
                                                        class="submission-status"
                                                        :class="submission.status"
                                                    >
                                                        {{ submission.status }}
                                                    </span>
                                                </div>

                                                <div class="admin-submission-details">
                                                    <div>
                                                        <span>Player ID</span>
                                                        <strong>{{ shortId(submission.submitted_by) }}</strong>
                                                    </div>
                                                    <div>
                                                        <span>Level ID</span>
                                                        <strong>{{ shortId(submission.level_id) }}</strong>
                                                    </div>
                                                    <div>
                                                        <span>Progress</span>
                                                        <strong>{{ submission.percentage }}%</strong>
                                                    </div>
                                                </div>

                                                <div class="admin-submission-actions">
                                                    <a
                                                        v-if="submission.video_url"
                                                        :href="submission.video_url"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        View Evidence
                                                    </a>
                                                    <span v-else>No evidence link</span>

                                                    <small>
                                                        Review actions will be enabled after secure database review functions are installed.
                                                    </small>
                                                </div>
                                            </article>
                                        </div>

                                        <div v-else class="empty-state">
                                            <h2>No submissions found</h2>
                                            <p>Player record submissions will appear here.</p>
                                        </div>

                                    </template>

                                    <!-- ADMIN LEVEL MANAGEMENT -->
                                    <template v-else-if="activeAdminTab === 'levels'">

                                        <div class="admin-section-intro">
                                            <h2>Level Management</h2>
                                            <p>Create, edit, position and remove levels across every GVDL list.</p>
                                        </div>

                                        <button
                                            type="button"
                                            class="account-submit admin-import-button"
                                            style="margin-bottom: 18px;"
                                            @click="openLevelEditor()"
                                        >
                                            Add New Level
                                        </button>

                                        <div class="admin-import-card">
                                            <div class="admin-import-card-heading">
                                                <div>
                                                    <h3>Main List Database Import</h3>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                class="account-submit admin-import-button"
                                                :disabled="importingLevels || !isAdmin"
                                                @click="importMainList"
                                            >
                                                {{
                                                    importingLevels
                                                        ? 'Importing Main List...'
                                                        : 'Import 150 Main List Levels'
                                                }}
                                            </button>

                                            <div
                                                v-if="importingLevels"
                                                class="admin-import-progress"
                                            >
                                                <div class="admin-import-progress-track">
                                                    <div
                                                        class="admin-import-progress-fill"
                                                        :style="{ width: importProgress + '%' }"
                                                    ></div>
                                                </div>
                                                <span>{{ importProgress }}%</span>
                                            </div>

                                            <p
                                                v-if="importMessage"
                                                class="admin-import-message"
                                                :class="importMessageType"
                                            >
                                                {{ importMessage }}
                                            </p>
                                        </div>

                                        <div v-if="adminLevels.length" class="admin-data-list">
                                            <article
                                                v-for="level in adminLevels"
                                                :key="level.id"
                                                class="admin-data-row"
                                            >
                                                <div class="admin-data-main">
                                                    <strong>{{ level.name || 'Unnamed level' }}</strong>
                                                    <small>
                                                        Author: {{ level.author || 'Unknown' }}
                                                        <template v-if="level.verifier">
                                                            · Verifier: {{ level.verifier }}
                                                        </template>
                                                        <template v-if="level.difficulty">
                                                            · {{ level.difficulty }}
                                                        </template>
                                                    </small>
                                                    <button
                                                        type="button"
                                                        class="admin-refresh-button"
                                                        style="margin-top: 10px;"
                                                        @click="openLevelEditor(level)"
                                                    >
                                                        Edit Level
                                                    </button>
                                                </div>

                                                <div
                                                    v-if="level.legacy_path"
                                                    class="admin-level-position"
                                                >
                                                    <label :for="'level-position-' + level.id">
                                                        Position
                                                    </label>

                                                    <input
                                                        :id="'level-position-' + level.id"
                                                        v-model.number="levelPositionDrafts[level.id]"
                                                        type="number"
                                                        min="1"
                                                        max="150"
                                                        step="1"
                                                        :disabled="!!savingLevelPosition || importingLevels"
                                                    />

                                                    <button
                                                        type="button"
                                                        class="admin-refresh-button"
                                                        :disabled="
                                                            !!savingLevelPosition ||
                                                            importingLevels ||
                                                            Number(levelPositionDrafts[level.id]) === Number(level.spreadsheet_rank)
                                                        "
                                                        @click="saveLevelPosition(level)"
                                                    >
                                                        {{
                                                            savingLevelPosition === level.id
                                                                ? 'Saving...'
                                                                : 'Save'
                                                        }}
                                                    </button>
                                                </div>

                                                <div v-else class="admin-data-meta">
                                                    <span>{{ level.game_id || 'No game ID' }}</span>
                                                    <small>{{ formatDate(level.created_at) }}</small>
                                                </div>
                                            </article>
                                        </div>

                                        <div v-else class="empty-state">
                                            <h2>No levels found</h2>
                                            <p>Use Add New Level to create a level, or import the Main List.</p>
                                        </div>

                                        <div
                                            v-if="levelEditorOpen && levelEditorDraft"
                                            class="admin-level-editor-overlay"
                                        >
                                            <form
                                                class="account-content-section admin-level-editor-form"
                                                @submit.prevent="saveLevelEditor"
                                            >
                                                <div class="content-section-heading admin-level-editor-heading">
                                                    <div>
                                                        <h2>{{ levelEditorDraft.id ? 'Edit Level' : 'Create Level' }}</h2>
                                                        <p>Update level details, list membership, positions and player records.</p>
                                                    </div>
                                                    <button type="button" class="admin-refresh-button" :disabled="levelEditorSaving" @click="closeLevelEditor">Close</button>
                                                </div>

                                                <div v-if="levelEditorError" class="admin-error">{{ levelEditorError }}</div>

                                                <div class="admin-level-fields-grid">
                                                    <label>Level Name
                                                        <input v-model="levelEditorDraft.name" required maxlength="200" />
                                                    </label>
                                                    <label>Author
                                                        <input v-model="levelEditorDraft.author" />
                                                    </label>
                                                    <label>Verifier
                                                        <input v-model="levelEditorDraft.verifier" />
                                                    </label>
                                                    <label>Game ID
                                                        <input v-model="levelEditorDraft.game_id" />
                                                    </label>
                                                    <label>Legacy Path
                                                        <input v-model="levelEditorDraft.legacy_path" />
                                                    </label>
                                                    <label>Verification URL
                                                        <input v-model="levelEditorDraft.verification_url" type="url" />
                                                    </label>
                                                    <label>Showcase URL
                                                        <input v-model="levelEditorDraft.showcase_url" type="url" />
                                                    </label>
                                                    <label>Percent to Qualify
                                                        <input v-model.number="levelEditorDraft.percent_to_qualify" type="number" min="0.01" max="100" step="0.01" required />
                                                    </label>
                                                    <label>Password
                                                        <input v-model="levelEditorDraft.password" />
                                                    </label>
                                                    <label>Difficulty
                                                        <input v-model="levelEditorDraft.difficulty" />
                                                    </label>
                                                    <label>Enjoyment
                                                        <input v-model="levelEditorDraft.enjoyment" />
                                                    </label>
                                                </div>

                                                <div class="admin-level-editor-section">
                                                    <div class="admin-level-editor-section-heading">
                                                        <h3>List Membership and Position</h3>
                                                        <p class="account-hint">Select every list this level belongs to. Set its position separately for each selected list.</p>
                                                    </div>
                                                    <div v-for="option in levelEditorListOptions" :key="option.key" class="admin-level-list-row">
                                                        <label style="display:flex; align-items:center; gap:9px;">
                                                            <input v-model="levelEditorDraft.listKeys" type="checkbox" :value="option.key" />
                                                            {{ option.label }}
                                                        </label>
                                                        <input
                                                            v-if="levelEditorDraft.listKeys.includes(option.key)"
                                                            v-model.number="levelEditorDraft.listPositions[option.key]"
                                                            type="number"
                                                            min="1"
                                                            step="1"
                                                            :aria-label="option.label + ' position'"
                                                        />
                                                        <span v-else class="account-hint">Not included</span>
                                                    </div>
                                                </div>

                                                <div class="admin-level-editor-section admin-records-section">
                                                    <div class="admin-level-editor-section-heading admin-records-heading">
                                                        <div>
                                                            <h3>Player Records and Victors</h3>
                                                            <p class="account-hint">Add completions or progress records. Use 100% for a completion and any lower percentage for progress. First Victor is optional.</p>
                                                        </div>
                                                        <button type="button" class="admin-refresh-button" :disabled="levelEditorRecordsLoading || levelEditorSaving" @click="addLevelEditorRecord">Add Record</button>
                                                    </div>

                                                    <p v-if="levelEditorRecordsLoading" class="account-hint" style="margin-top:14px;">Loading this level’s player records...</p>
                                                    <div v-else-if="levelEditorRecords.length" class="admin-level-record-list">
                                                        <article v-for="(record, index) in levelEditorRecords" :key="record.id || 'new-' + index" class="admin-level-record-card">
                                                            <div class="admin-level-record-fields">
                                                                <label>Player Name
                                                                    <input v-model="record.player_name" required />
                                                                </label>
                                                                <label>Percentage
                                                                    <input v-model.number="record.percentage" type="number" min="0.01" max="100" step="0.01" required />
                                                                </label>
                                                            </div>
                                                            <div class="admin-level-record-actions">
                                                                <label class="admin-first-victor-toggle">
                                                                    <input type="checkbox" :checked="record.is_first_victor" @change="setFirstVictorRecord(index, $event.target.checked)" />
                                                                    <span>First Victor</span>
                                                                </label>
                                                                <button type="button" class="admin-refresh-button admin-remove-record" @click="removeLevelEditorRecord(index)">Remove Record</button>
                                                            </div>
                                                        </article>
                                                    </div>
                                                    <p v-else class="account-hint" style="margin-top:14px;">No player records have been added to this level yet.</p>
                                                </div>

                                                <div class="admin-level-editor-footer">
                                                    <button
                                                        v-if="levelEditorDraft.id"
                                                        type="button"
                                                        class="admin-refresh-button"
                                                        :disabled="levelEditorSaving"
                                                        @click="deleteLevel(adminLevels.find(item => item.id === levelEditorDraft.id))"
                                                    >Delete Level</button>
                                                    <div style="display:flex; gap:10px; margin-left:auto;">
                                                        <button type="button" class="admin-refresh-button" :disabled="levelEditorSaving" @click="closeLevelEditor">Cancel</button>
                                                        <button type="submit" class="account-submit" :disabled="levelEditorSaving">
                                                            {{ levelEditorSaving ? 'Saving...' : 'Save Level' }}
                                                        </button>
                                                    </div>
                                                </div>
                                            </form>
                                        </div>

                                    </template>

                                    <!-- ADMIN PLAYER MANAGEMENT -->
                                    <template v-else-if="activeAdminTab === 'players'">

                                        <div class="admin-section-intro">
                                            <h2>Player Management</h2>
                                            <p>View registered GVDL accounts and their current roles.</p>
                                        </div>

                                        <div class="admin-management-notice">
                                            Player bans, timeouts and account restrictions are not enabled yet. These need database-enforced expiry and permission checks before they can be safely applied.
                                        </div>

                                        <div v-if="adminPlayers.length" class="admin-data-list">
                                            <article
                                                v-for="player in adminPlayers"
                                                :key="player.id"
                                                class="admin-data-row"
                                            >
                                                <div class="admin-data-main">
                                                    <strong>{{ player.username || 'Unknown player' }}</strong>
                                                    <small>{{ shortId(player.id) }}</small>
                                                </div>
                                                <div class="admin-data-meta">
                                                    <span
                                                        class="admin-player-role"
                                                        :class="player.role"
                                                    >
                                                        {{ player.role || 'player' }}
                                                    </span>
                                                    <small>Joined {{ formatDate(player.created_at) }}</small>
                                                </div>
                                            </article>
                                        </div>

                                        <div v-else class="empty-state">
                                            <h2>No players found</h2>
                                            <p>Registered accounts will appear here.</p>
                                        </div>

                                    </template>

                                    <!-- OWNER ADMIN MANAGEMENT -->
                                    <template v-else-if="activeAdminTab === 'admins' && isOwner">

                                        <div class="admin-section-intro">
                                            <h2>Admin Management</h2>
                                            <p>View the accounts that currently have administrative permissions.</p>
                                        </div>

                                        <div class="admin-management-notice">
                                            Only the Owner can manage administrator roles. Role changes will be connected after the owner-only database operation is fully tested.
                                        </div>

                                        <div class="admin-data-list">
                                            <article
                                                v-for="player in adminPlayers.filter(item => ['admin', 'owner'].includes(item.role?.toLowerCase()))"
                                                :key="player.id"
                                                class="admin-data-row"
                                            >
                                                <div class="admin-data-main">
                                                    <strong>{{ player.username }}</strong>
                                                    <small>{{ shortId(player.id) }}</small>
                                                </div>
                                                <div class="admin-data-meta">
                                                    <span
                                                        class="admin-player-role"
                                                        :class="player.role"
                                                    >
                                                        {{ player.role }}
                                                    </span>
                                                    <small>Joined {{ formatDate(player.created_at) }}</small>
                                                </div>
                                            </article>

                                            <div
                                                v-if="!adminPlayers.some(item => ['admin', 'owner'].includes(item.role?.toLowerCase()))"
                                                class="admin-empty-inline"
                                            >
                                                No administrator accounts found.
                                            </div>
                                        </div>

                                    </template>

                                    <!-- MODERATION LOGS -->
                                    <template v-else-if="activeAdminTab === 'logs'">

                                        <div class="admin-section-intro">
                                            <h2>Moderation Activity Logs</h2>
                                            <p>Review the latest administrative actions recorded by GVDL.</p>
                                        </div>

                                        <div v-if="adminLogs.length" class="admin-log-list admin-full-log-list">
                                            <article
                                                v-for="(log, index) in adminLogs"
                                                :key="log.created_at + '-' + index"
                                                class="admin-log-row"
                                            >
                                                <div>
                                                    <strong>{{ log.action }}</strong>
                                                    <small>
                                                        {{ log.target_type || 'System' }}
                                                        <template v-if="log.target_id">
                                                            · {{ shortId(log.target_id) }}
                                                        </template>
                                                    </small>
                                                    <small v-if="log.details">
                                                        {{ JSON.stringify(log.details) }}
                                                    </small>
                                                </div>
                                                <time>{{ formatDateTime(log.created_at) }}</time>
                                            </article>
                                        </div>

                                        <div v-else class="empty-state">
                                            <h2>No activity recorded</h2>
                                            <p>Future moderation actions will appear here.</p>
                                        </div>

                                    </template>

                                </template>

                            </template>

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

                            <label for="account-email">Email Address</label>
                            <input
                                id="account-email"
                                v-model="email"
                                type="email"
                                placeholder="Enter your email"
                                autocomplete="email"
                                required
                            />

                            <label for="account-password">Password</label>
                            <input
                                id="account-password"
                                v-model="password"
                                type="password"
                                placeholder="Enter your password"
                                autocomplete="current-password"
                                required
                            />

                            <button class="account-submit" type="submit" :disabled="loading">
                                {{ loading ? 'Logging in...' : 'Login' }}
                            </button>
                        </form>

                        <form
                            v-else
                            class="account-form"
                            @submit.prevent="register"
                        >
                            <h2>Create an account</h2>

                            <label for="account-username">Username</label>
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

                            <label for="register-email">Email Address</label>
                            <input
                                id="register-email"
                                v-model="email"
                                type="email"
                                placeholder="Enter your email"
                                autocomplete="email"
                                required
                            />

                            <label for="register-password">Password</label>
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

                            <button class="account-submit" type="submit" :disabled="loading">
                                {{ loading ? 'Creating account...' : 'Register' }}
                            </button>
                        </form>

                        <p v-if="message" class="account-message" :class="messageType">
                            {{ message }}
                        </p>

                        <p class="account-footer">GRAB VR Demon List</p>
                    </div>
                </template>

            </div>
        </main>
    `,
};
