
import { round, score } from './score.js';

/**
 * Path to directory containing `_list.json` and all levels
 */
const dir = './data';

export async function fetchList(indexFile = '_list.json') {
    const listResult = await fetch(`${dir}/${indexFile}`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${dir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        {
                            ...level,
                            path,
                            records: level.records.sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load list.`);
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

    // Match player names without case sensitivity
    const getUser = (name) =>
        Object.keys(scoreMap).find(
            (user) => user.toLowerCase() === name.toLowerCase(),
        ) || name;

    // Create a leaderboard entry if one does not exist
    const ensureUser = (name) => {
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
            level.percentToQualify,
        );

        // Verification
        const verifierScores = ensureUser(level.verifier);

        verifierScores.completed.push({
            rank: levelRank,
            level: level.name,
            score: levelScore,
            link: level.verification,
            type: 'verifier',
        });

        // First victor
        if (level.firstVictor) {
            const firstVictorScores = ensureUser(level.firstVictor);

            firstVictorScores.completed.push({
                rank: levelRank,
                level: level.name,
                score: levelScore,
                link: '',
                type: 'first-victor',
            });
        }

        // Player records
        level.records.forEach((record) => {
            const playerScores = ensureUser(record.user);

            if (record.percent === 100) {
                playerScores.completed.push({
                    rank: levelRank,
                    level: level.name,
                    score: levelScore,
                    link: record.link,
                    type: 'completion',
                });

                return;
            }

            playerScores.progressed.push({
                rank: levelRank,
                level: level.name,
                percent: record.percent,
                score: score(
                    levelRank,
                    record.percent,
                    level.percentToQualify,
                ),
                link: record.link,
            });
        });
    });

    // Calculate each player's total score
    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { completed, progressed } = scores;

        const total = [...completed, ...progressed].reduce(
            (previous, current) => previous + current.score,
            0,
        );

        return {
            user,
            total: round(total),
            ...scores,
        };
    });

    // Sort by total score, highest first
    return [res.sort((a, b) => b.total - a.total), errs];
}

