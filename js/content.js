
import { round, score } from './score.js';

const dir = './data';

const databaseListKeys = {
    '_list.json': 'main',
    '_platformer.json': 'platformer',
    '_challenge.json': 'challenge',
    '_created.json': 'created',
    '_upcoming.json': 'upcoming',
};

async function fetchJsonLevel(path, rank) {
    const levelResult = await fetch(`${dir}/${path}.json`, {
        cache: 'no-store',
    });

    try {
        const level = await levelResult.json();

        return [
            {
                ...level,
                path,
                records: level.records || [],
            },
            null,
        ];
    } catch (error) {
        console.error(
            `Failed to load level #${rank + 1} ${path}:`,
            error
        );

        return [null, path];
    }
}

async function formatDatabaseLevel(databaseLevel, rank, databaseRecords = null) {
    const legacyPath = databaseLevel.legacy_path;
    let legacyRecords = [];

    // Legacy JSON still contains most historical player completions. Load it
    // even when Supabase has some records, because the database may be partial.
    if (legacyPath) {
        try {
            const response = await fetch(`${dir}/${legacyPath}.json`, {
                cache: 'no-store',
            });

            if (response.ok) {
                const legacyLevel = await response.json();
                legacyRecords = Array.isArray(legacyLevel.records)
                    ? legacyLevel.records
                    : [];
            }
        } catch (error) {
            console.error(
                `Could not load legacy records for ${legacyPath}:`,
                error
            );
        }
    }

    const databaseLevelRecords = Array.isArray(databaseRecords)
        ? databaseRecords
            .filter(record => !record.is_first_victor)
            .map(record => {
                const percentage = Number(record.percentage);

                if (percentage >= 100) {
                    return record.player_name;
                }

                return {
                    user: record.player_name,
                    percent: percentage,
                    link: record.video_url || '',
                };
            })
            .filter(record => typeof record === 'string' ? !!record : !!record.user)
        : [];

    // Keep legacy entries first so their existing links and formatting survive.
    // Merge database-only records and avoid duplicate player/percentage entries.
    const records = [];
    const seenRecords = new Set();

    [...legacyRecords, ...databaseLevelRecords].forEach(record => {
        const key = typeof record === 'string'
            ? `completion:${record.trim().toLowerCase()}`
            : `progress:${String(record.user || '').trim().toLowerCase()}:${Number(record.percent)}`;

        if (!key || key.endsWith(':') || seenRecords.has(key)) return;
        seenRecords.add(key);
        records.push(record);
    });

    return [
        {
            id:
                databaseLevel.game_id == null
                    ? null
                    : Number(databaseLevel.game_id),

            databaseId: databaseLevel.id,
            name: databaseLevel.name,
            author: databaseLevel.author || '',
            creators: databaseLevel.creators || [],
            verifier: databaseLevel.verifier || '',
            verification: databaseLevel.verification_url || '',
            showcase: databaseLevel.showcase_url || '',

            percentToQualify:
                databaseLevel.percent_to_qualify == null
                    ? 100
                    : String(databaseLevel.percent_to_qualify),

            password: databaseLevel.password || '',
            records,

            firstVictor: databaseLevel.first_victor_name || '',
            spreadsheetRank:
                databaseLevel.spreadsheet_rank || rank + 1,

            difficulty: databaseLevel.difficulty || '',
            enjoyment: databaseLevel.enjoyment || '',

            pointsReward:
                databaseLevel.points_reward == null
                    ? ''
                    : String(databaseLevel.points_reward),

            path: legacyPath || databaseLevel.id,
        },
        null,
    ];
}

/**
 * Loads a list from Supabase using its list memberships and positions.
 *
 * Returns null when the database list is unavailable or empty, allowing
 * the existing JSON list to remain the fallback.
 */
async function fetchDatabaseList(listKey) {
    try {
        const { supabase } = await import('./main.js');

        const { data, error } = await supabase
            .from('level_list_entries')
            .select(`
                position,
                levels!inner (
                    id,
                    legacy_path,
                    game_id,
                    name,
                    author,
                    creators,
                    verifier,
                    verification_url,
                    showcase_url,
                    percent_to_qualify,
                    password,
                    first_victor_name,
                    spreadsheet_rank,
                    difficulty,
                    enjoyment,
                    points_reward
                )
            `)
            .eq('list_key', listKey)
            .order('position', { ascending: true });

        if (error) {
            console.error(
                `Failed to load ${listKey} from Supabase:`,
                error
            );

            return null;
        }

        if (!data || data.length === 0) {
            return null;
        }

        // Keep the legacy 150-level baseline protected from partial imports,
        // while allowing admin-managed additions beyond the original 150.
        if (listKey === 'main' && data.length < 150) {
            console.warn(
                'The database Main List is incomplete. Using the existing JSON list.'
            );

            return null;
        }

        const levelIds = data
            .map(entry => entry.levels?.id)
            .filter(Boolean);

        let recordsByLevel = null;

        if (levelIds.length) {
            const { data: recordRows, error: recordsError } = await supabase
                .from('player_records')
                .select('id, level_id, player_name, percentage, video_url, is_first_victor')
                .in('level_id', levelIds)
                .order('created_at', { ascending: true });

            if (recordsError) {
                console.error('Failed to load public player records from Supabase:', recordsError);
            } else {
                recordsByLevel = new Map();

                (recordRows || []).forEach(record => {
                    if (!recordsByLevel.has(record.level_id)) {
                        recordsByLevel.set(record.level_id, []);
                    }

                    recordsByLevel.get(record.level_id).push(record);
                });
            }
        }

        return await Promise.all(
            data.map(async (entry, index) => {
                if (!entry.levels) {
                    return [
                        null,
                        `Missing level at position ${index + 1}`,
                    ];
                }

                const databaseLevel = {
                    ...entry.levels,
                    spreadsheet_rank: entry.position,
                };

                return formatDatabaseLevel(
                    databaseLevel,
                    index,
                    recordsByLevel
                        ? recordsByLevel.get(databaseLevel.id) || []
                        : null
                );
            })
        );
    } catch (error) {
        console.error(
            `Could not access the ${listKey} database list:`,
            error
        );

        return null;
    }
}

export async function fetchList(indexFile = '_list.json') {
    const listKey = databaseListKeys[indexFile];

    if (listKey) {
        const databaseList = await fetchDatabaseList(listKey);

        if (databaseList) {
            return databaseList;
        }
    }

    // Preserve the original JSON fallback.
    const listResult = await fetch(`${dir}/${indexFile}`, {
        cache: 'no-store',
    });

    try {
        const list = await listResult.json();

        return await Promise.all(
            list.map(async (path, rank) => {
                return fetchJsonLevel(path, rank);
            })
        );
    } catch (error) {
        console.error('Failed to load list:', error);
        return null;
    }
}

export async function fetchEditors() {
    try {
        const editorsResults = await fetch(`${dir}/_editors.json`);
        const editors = await editorsResults.json();

        return editors;
    } catch {
        return null;
    }
}

export async function fetchLeaderboard(indexFile = '_list.json') {
    const list = await fetchList(indexFile);

    if (!list) {
        return [[], ['Failed to load list.']];
    }

    const scoreMap = {};
    const errs = [];

    const getUser = name =>
        Object.keys(scoreMap).find(
            user => user.toLowerCase() === name.toLowerCase()
        ) || name;

    const ensureUser = name => {
        const user = getUser(name);

        scoreMap[user] ??= {
            completed: [],
            progressed: [],
        };

        return scoreMap[user];
    };

    list.forEach(([level, err], rank) => {
        if (err) {
            errs.push(err);
            return;
        }

        const levelRank = rank + 1;

        const levelScore = score(
            levelRank,
            100,
            level.percentToQualify
        );

        if (level.verifier) {
            ensureUser(level.verifier).completed.push({
                rank: levelRank,
                level: level.name,
                path: level.path,
                score: levelScore,
                link: level.verification,
                type: 'verifier',
            });
        }

        if (level.firstVictor) {
            ensureUser(level.firstVictor).completed.push({
                rank: levelRank,
                level: level.name,
                path: level.path,
                score: levelScore,
                link: '',
                type: 'first-victor',
            });
        }

        level.records.forEach(record => {
            if (typeof record === 'string') {
                ensureUser(record).completed.push({
                    rank: levelRank,
                    level: level.name,
                    path: level.path,
                    score: levelScore,
                    link: '',
                    type: 'completion',
                });

                return;
            }

            ensureUser(record.user).progressed.push({
                rank: levelRank,
                level: level.name,
                path: level.path,
                percent: record.percent,
                score: score(
                    levelRank,
                    record.percent,
                    level.percentToQualify
                ),
                link: record.link,
            });
        });
    });

    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { completed, progressed } = scores;

        const total = [...completed, ...progressed].reduce(
            (previous, current) => previous + current.score,
            0
        );

        return {
            user,
            total: round(total),
            ...scores,
        };
    });

    return [
        res.sort((a, b) => b.total - a.total),
        errs,
    ];
}
