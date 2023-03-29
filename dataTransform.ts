import db from "./db";
import { ChargeType, ItemType, RowTypes, TeamData, WinResult } from "./objectModel";

const extractEmojis = (text: string) => text.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu);

const sum = (items: number[]): number => items.length == 0 ? 0 : items.reduce((a, b) => a + b);

const mean = (items: number[]): number | null => {
	if(items.length == 0) return null;
	return sum(items) / items.length
}

const median = (items: number[]): number | null => {
	if(items.length == 0) return null;
	const mid1 = items.sort()[Math.floor(items.length / 2)];
	const mid2 = items.sort()[Math.floor((items.length + 1) / 2) - 1];
	return (mid1 + mid2) / 2;
}

const variance = (items: number[]): number | null => {
	if(items.length == 0) return null;
	const popMean = mean(items) ?? 0;
	return sum(items.map(i => (i - popMean) ** 2)) / items.length;
}

const stdev = (items: number[]): number | null => {
	if(items.length == 0) return null;
	return Math.sqrt(variance(items) ?? 0);
}

export const dataTransform = {
	allTeams: async () => {
		const allMatches = await db.getAllMatches();
		const allTeams: Set<number> = new Set();
		allMatches.forEach(match => {
			allTeams.add(match.team1Data.teamInfo.teamNumber);
			allTeams.add(match.team2Data.teamInfo.teamNumber);
			allTeams.add(match.team3Data.teamInfo.teamNumber);
		});
		return [...allTeams].sort((a, b) => a - b);
	},

	teamStats: async (teamNumber: number) => {
		if(!(await dataTransform.allTeams()).includes(teamNumber)) return null;
		
		const allMatches = await db.getAllMatches();

		const allMatchesPlayed = allMatches.filter(match => {
			return match.team1Data.teamInfo.teamNumber == teamNumber
				|| match.team2Data.teamInfo.teamNumber == teamNumber
				|| match.team3Data.teamInfo.teamNumber == teamNumber;
		});

		let thisTeamID = 0;

		const allTeamData = allMatchesPlayed.map(match => {
			if(match.team1Data.teamInfo.teamNumber == teamNumber) { thisTeamID = 1; return match.team1Data };
			if(match.team2Data.teamInfo.teamNumber == teamNumber) { thisTeamID = 2; return match.team2Data };
			if(match.team3Data.teamInfo.teamNumber == teamNumber) { thisTeamID = 3; return match.team3Data };
		});

		let heatMap: { top: number[], mid: number[], low: number[] } = {
			top: [...Array<number>(9)].map(_ => 0),
			mid: [...Array<number>(9)].map(_ => 0),
			low: [...Array<number>(9)].map(_ => 0)
		};

		let itemTotals: {
			top: { cubes: number, cones: number }[],
			mid: { cubes: number, cones: number }[],
			low: { cubes: number, cones: number }[]
		} = { top: [], mid: [], low: [] };

		let scoreTotals: { top: number[], mid: number[], low: number[] } = { top: [], mid: [], low: [] };

		allMatchesPlayed.forEach(match => {
			RowTypes.forEach(row => {
				const scoreRow = match.scoreGrid[row];
				let scoreSum = { cubes: 0, cones: 0 };
				scoreRow.forEach((score, column) => {
					if(score.teamID != thisTeamID) return;
					if(score.item == ItemType.cone) scoreSum.cones++;
					if(score.item == ItemType.cube) scoreSum.cubes++;
					if(score.item != ItemType.none) heatMap[row][column]++;
				});
				itemTotals[row].push(scoreSum);
				scoreTotals[row].push(scoreSum.cones + scoreSum.cubes);
			});
		});

		const stats = {
			teamNumber: teamNumber,

			notes: allTeamData.map(t => t && t.notes).filter(note => note && note.length > 0),

			emojis: allTeamData.map(t => t && extractEmojis(t.notes)).filter(emojis => emojis && emojis.length > 0).map(a => a?.[0]),
			
			matches: {
				played: allMatchesPlayed.length,
				won: allMatchesPlayed.filter(match => match.winResult == WinResult.victory).length,
				lost: allMatchesPlayed.filter(match => match.winResult == WinResult.defeat).length,
				tie: allMatchesPlayed.filter(match => match.winResult == WinResult.tie).length,
				winPercent: (allMatchesPlayed.filter(match => match.winResult == WinResult.victory).length + 0.5 * allMatchesPlayed.filter(match => match.winResult == WinResult.tie).length) / allMatchesPlayed.length
			},

			auto: {
				mobility: allTeamData.filter(teamData => teamData?.autoMobility == true).length,
				mobilityPercent: allTeamData.filter(teamData => teamData?.autoMobility == true).length / allTeamData.length,
				docked: allTeamData.filter(teamData => teamData?.autoCharge == ChargeType.docked).length,
				charged: allTeamData.filter(teamData => teamData?.autoCharge == ChargeType.charged).length,
				chargePercent: allTeamData.filter(teamData => teamData?.autoCharge == ChargeType.charged).length / allTeamData.length
			},

			teleop: {
				scoreGrid: RowTypes.reduce((grid, row) => {
					grid[row] = {
						heatMap: heatMap[row],
						totals: scoreTotals[row],
						itemTotals: itemTotals[row],
						rawTotal: sum(scoreTotals[row]),
						mean: mean(scoreTotals[row]),
						median: median(scoreTotals[row]),
						variance: variance(scoreTotals[row]),
						stdev: stdev(scoreTotals[row])
					};
					return grid;
				}, {top: {}, mid: {}, low: {}})
			},

			end: {
				docked: allTeamData.filter(teamData => teamData?.endCharge == ChargeType.docked).length,
				charged: allTeamData.filter(teamData => teamData?.endCharge == ChargeType.charged).length,
				chargePercent: allTeamData.filter(teamData => teamData?.endCharge == ChargeType.charged).length / allTeamData.length
			}
		}

		return stats;
	}
}