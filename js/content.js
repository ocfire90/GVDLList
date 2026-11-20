import { round, score } from './score.js';

const dir = './data';

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

/**
 * Loads the Main List from Supabase.
 *
 * The database is used only when all 150 Main List levels have been
 * imported. This prevents an incomplete database import from replacing
 * the existing public JSON list.
 */
async function fetchDatabaseMainList() {
    try {
        // Dynamic import avoids a circular initialisation issue:
        // main.js imports the routes, which import this file.
        const { supabase } = await import('./main.js');

        const { data, error } = await supabase
            .from('levels')
            .select(`
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
            `)
            .not('legacy_path', 'is', null)
            .order('spreadsheet_rank', { ascending: true });

        if (error) {
            console.error(
                'Failed to load Main List from Supabase:',
                error
            );

            return null;
        }

        if (!data || data.length !== 150) {
            return null;
        }

        const levels = await Promise.all(
            data.map(async (databaseLevel, index) => {
                const path = databaseLevel.legacy_path;

                if (!path) {
                    return [null, 'Missing legacy path'];
                }

                let records = [];

                try {
                    const response = await fetch(`${dir}/${path}.json`, {
                        cache: 'no-store',
                    });

                    if (response.ok) {
                        const legacyLevel = await response.json();
                        records = legacyLevel.records || [];
                    }
                } catch (error) {
                    console.error(
                        `Could not load legacy records for ${path}:`,
                        error
                    );
                }

                return [
                    {
                        id:
                            databaseLevel.game_id == null
                                ? null
                                : Number(databaseLevel.game_id),

                        name: databaseLevel.name,
                        author: databaseLevel.author || '',
                        creators: databaseLevel.creators || [],
                        verifier: databaseLevel.verifier || '',

                        verification:
                            databaseLevel.verification_url || '',

                        showcase:
                            databaseLevel.showcase_url || '',

                        percentToQualify:
                            databaseLevel.percent_to_qualify == null
                                ? 100
                                : String(databaseLevel.percent_to_qualify),

                        password: databaseLevel.password || '',
                        records,

                        firstVictor:
                            databaseLevel.first_victor_name || '',

                        spreadsheetRank:
                            databaseLevel.spreadsheet_rank || index + 1,

                        difficulty:
                            databaseLevel.difficulty || '',

                        enjoyment:
                            databaseLevel.enjoyment || '',

                        pointsReward:
                            databaseLevel.points_reward == null
                                ? ''
                                : String(databaseLevel.points_reward),

                        path,
                    },
                    null,
                ];
            })
        );

        return levels;
    } catch (error) {
        console.error(
            'Could not access the Main List database:',
            error
        );

        return null;
    }
}

export async function fetchList(indexFile = '_list.json') {
    // The Main List uses Supabase when all 150 levels are imported.
    // Other lists continue to use their existing JSON files.
    if (indexFile === '_list.json') {
        const databaseList = await fetchDatabaseMainList();

        if (databaseList) {
            return databaseList;
        }
    }

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
