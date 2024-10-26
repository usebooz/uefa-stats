import axios from "axios";
import { mkConfig, generateCsv, asString } from "export-to-csv";
import { writeFile } from "node:fs";
import { Buffer } from "node:buffer";

const competition = "1";
const phase = "TOURNAMENT";
const seasonYear = "2025";
const teamRankingUrl = "https://compstats.uefa.com/v1/team-ranking";
const playerRankingUrl = "https://compstats.uefa.com/v1/player-ranking";

// TODO GET matches
// https://match.uefa.com/v5/matches?competitionId=1&fromDate=2024-11-01&limit=50&offset=0&order=ASC&phase=ALL&seasonYear=2025&toDate=2024-11-30&utcOffset=3

async function main() {
    const csvConfig = mkConfig({ useKeysAsHeaders: true });

    const teams = await getTeams();
    const csv = generateCsv(csvConfig)(teams);
    const csvBuffer = new Uint8Array(Buffer.from(asString(csv)));
    writeFile("teams.csv", csvBuffer, (err) => {
        if (err) console.log(err);
        console.log("file saved");
    });

    // const players = await getPlayers(teams);
}

async function getTeams() {
    // TODO parallel requests via Promise.all

    let teams;

    teams = await getTeamRanking(teams, "matches_appearance%2Cmatches_win%2Cmatches_draw%2Cmatches_loss");
    teams = await getTeamRanking(
        teams,
        "goals%2Cgoals_scored_with_right%2Cgoals_scored_with_left%2Cgoals_scored_head%2Cgoals_scored_other%2Cgoals_scored_inside_penalty_area%2Cgoals_scored_outside_penalty_area%2Cpenalty_scored"
    );
    teams = await getTeamRanking(teams, "attempts%2Cattempts_on_target%2Cattempts_off_target%2Cattempts_blocked");
    teams = await getTeamRanking(
        teams,
        "passes_accuracy%2Cpasses_attempted%2Cpasses_completed%2Cball_possession%2Ccross_accuracy%2Ccross_attempted%2Ccross_completed%2Cfree_kick"
    );
    teams = await getTeamRanking(teams, "attacks%2Cassists%2Ccorners%2Coffsides%2Cdribbling");
    teams = await getTeamRanking(teams, "recovered_ball%2Ctackles%2Ctackles_won%2Ctackles_lost%2Cclearance_attempted");
    teams = await getTeamRanking(
        teams,
        "saves%2Cgoals_conceded%2Cown_goal_conceded%2Csaves_on_penalty%2Cclean_sheet%2Cpunches"
    );
    teams = await getTeamRanking(teams, "fouls_committed%2Cfouls_suffered%2Cyellow_cards%2Cred_cards");

    return teams;
}

async function getTeamRanking(teams, statsPath) {
    const url = `${teamRankingUrl}?competitionId=${competition}&phase=${phase}&seasonYear=${seasonYear}&limit=100&offset=0&optionalFields=PLAYER%2CTEAM&order=DESC`;
    const response = await axios.get(`${url}&stats=${statsPath}`).catch((err) => console.log(err));
    if (!response.data?.length) {
        return;
    }

    //TODO move MERGE logic to separate function
    if (!teams?.length) {
        teams = response.data.map((item) => ({ id: item.team.id, ["Клуб"]: item.team.translations.displayName.RU }));
    }

    teams.forEach((team) => {
        const teamRanking = response.data.find((item) => item.team.id === team.id);
        if (!teamRanking) {
            return;
        }
        teamRanking.statistics.forEach((stat) => {
            team[stat.translations.name.RU] = stat.value;
        });
    });

    return teams;
}

async function getPlayers(teams) {
    // TODO parallel requests via Promise.all
    let players = [];

    if (!teams?.length) {
        return;
    }

    for (const team of teams) {
        let teamPlayers;

        teamPlayers = await getTeamPlayerRanking(
            teamPlayers,
            team.id,
            "minutes_played_official%2Cmatches_appearance%2Cgoals%2Cassists%2Cdistance_covered%2Ctop_speed"
        );
        teamPlayers = await getTeamPlayerRanking(
            teamPlayers,
            team.id,
            "goals%2Cgoals_scored_with_right%2Cgoals_scored_with_left%2Cgoals_scored_head%2Cgoals_scored_other%2Cgoals_scored_inside_penalty_area%2Cgoals_scored_outside_penalty_area%2Cpenalty_scored"
        );
        teamPlayers = await getTeamPlayerRanking(
            teamPlayers,
            team.id,
            "attempts%2Cattempts_on_target%2Cattempts_off_target%2Cattempts_blocked"
        );
        teamPlayers = await getTeamPlayerRanking(
            teamPlayers,
            team.id,
            "passes_accuracy%2Cpasses_attempted%2Cpasses_completed%2Ccross_accuracy%2Ccross_attempted%2Ccross_completed%2Cfree_kick"
        );
        teamPlayers = await getTeamPlayerRanking(teamPlayers, team.id, "assists%2Ccorners%2Coffsides%2Cdribbling");
        teamPlayers = await getTeamPlayerRanking(
            teamPlayers,
            team.id,
            "recovered_ball%2Ctackles%2Ctackles_won%2Ctackles_lost%2Cclearance_attempted"
        );
        teamPlayers = await getTeamPlayerRanking(
            teamPlayers,
            team.id,
            "saves%2Cgoals_conceded%2Csaves_on_penalty%2Cclean_sheet%2Cpunches"
        );
        teamPlayers = await getTeamPlayerRanking(
            teamPlayers,
            team.id,
            "fouls_committed%2Cfouls_suffered%2Cyellow_cards%2Cred_cards%2Cminutes_played_official"
        );

        players.push(...teamPlayers);
    }

    return players;
}

async function getTeamPlayerRanking(players, teamId, statsPath) {
    const url = `${playerRankingUrl}?competitionId=${competition}&phase=${phase}&seasonYear=${seasonYear}&limit=100&offset=0&optionalFields=PLAYER%2CTEAM&order=DESC&teamId=${teamId}`;
    const response = await axios.get(`${url}&stats=${statsPath}`).catch((err) => console.log(err));
    if (!response.data?.length) {
        return;
    }

    //TODO move MERGE logic to separate function
    if (!players?.length) {
        players = response.data.map((item) => ({
            id: item.player.id,
            ["Игрок"]: item.player.translations.shortName.RU,
            fieldPosition: item.player.fieldPosition,
            ["Позиция"]: item.player.translations.fieldPosition.RU,
            teamId: item.team.id,
            ["Клуб"]: item.team.translations.displayName.RU,
        }));
    }

    players.forEach((player) => {
        const playerRanking = response.data.find((item) => item.player.id === player.id);
        if (!playerRanking) {
            return;
        }
        playerRanking.statistics.forEach((stat) => {
            player[stat.translations.name.RU] = stat.value;
        });
    });

    return players;
}

main();
