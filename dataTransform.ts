import db from "./db";
import { AllianceType, ChargeType, ItemType, RowType, WinResult } from "./objectModel";

const extractEmojis = (text: string) => [...new Set(text.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu))];

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
			allTeams.add(match.team1Data.teamNumber);
			allTeams.add(match.team2Data.teamNumber);
			allTeams.add(match.team3Data.teamNumber);
		});
		return [...allTeams].sort((a, b) => a - b);
	},

	matchBounds: async () => {
		const allMatches = await db.getAllMatches();

		const min = Math.min(...allMatches.map(m => m.matchNumber));
		const max = Math.max(...allMatches.map(m => m.matchNumber));

		return ({ min: min, max: max });
	},

	matchStats: async (matchNumber: number) => {
		const matchStatsPerAlliance = async (matchNumber: number, alliance: AllianceType) => {
			const matchData = (await db.getAllMatches()).find(match => match.matchNumber == matchNumber && match.alliance == alliance);
			if(matchData == undefined) return;
	
			const rowValues = {
				top: { auto: 6, teleop: 5 },
				mid: { auto: 4, teleop: 3 },
				low: { auto: 3, teleop: 2 },
			}
			
			const teamDatas = [matchData.team1Data, matchData.team2Data, matchData.team3Data];
			
			const teams = teamDatas.map(t => t.teamNumber);

			const scoresPerTeam = [0, 0, 0];
			const linksPerTeam = [0, 0, 0];
			const pointsPerTeam = [0, 0, 0];

			let coopScores = 0;
			
			// Raw scores, coop grid, points calculation
			RowType.forEach(row => {
				for(let col = 0; col < 9; col++) {
					const score = matchData?.scoreGrid[row][col];
					if(score?.item == ItemType.none || score?.teamID == undefined) continue;
					scoresPerTeam[score?.teamID - 1]++;
					if(3 <= col && col <= 5) coopScores++;
					pointsPerTeam[score?.teamID - 1] += score.auto ? rowValues[row].auto : rowValues[row].teleop;
				}
			});
	
			// Link calculation
			RowType.forEach(row => {
				const scoreRow = matchData?.scoreGrid[row];
				for(let col = 0; col <= 6; col++) {
					if(scoreRow[col + 0].item != ItemType.none
					&& scoreRow[col + 1].item != ItemType.none
					&& scoreRow[col + 2].item != ItemType.none) {
						// Link found, calculate team contribution
						linksPerTeam[scoreRow[col + 0].teamID - 1] += 1/3;
						linksPerTeam[scoreRow[col + 1].teamID - 1] += 1/3;
						linksPerTeam[scoreRow[col + 2].teamID - 1] += 1/3;
						col += 3;
					}
				}
			});

			const autoCharging = teamDatas.map(t => t.autoCharge).filter(c => c == ChargeType.charged).length > 0;
			const autoDocking = !autoCharging && teamDatas.map(t => t.autoCharge).filter(c => c == ChargeType.docked).length > 0;

			let autoChargePoints = 0;
			if(autoCharging) autoChargePoints += 12;
			if(autoDocking) autoChargePoints += 8;

			const endCharging = teamDatas.map(t => t.endCharge).filter(c => c == ChargeType.charged);
			const endDocking = endCharging.length > 0 ? [] : teamDatas.map(t => t.endCharge).filter(c => c == ChargeType.docked);
			let endChargePoints = endCharging.length * 10 + endDocking.length * 6;

			const stats = {
				matchNumber: matchNumber,
				alliance: alliance,
				coop: coopScores >= 3,
				winResult: matchData.winResult,
				teams: teams,
				scoresPerTeam: scoresPerTeam,
				pointsPerTeam: pointsPerTeam,
				linksPerTeam: linksPerTeam,
				activation: autoChargePoints + endChargePoints >= 26
			};
	
			return stats;
		};

		const blueStats = await matchStatsPerAlliance(matchNumber, AllianceType.blue);
		const redStats = await matchStatsPerAlliance(matchNumber, AllianceType.red);
		
		let blueRankingPoints = 0;
		let redRankingPoints = 0;

		let blueLinks = 0;
		let blueCoop: boolean | null = null;
		if(blueStats != undefined) {
			blueLinks = sum(blueStats?.linksPerTeam);
			blueCoop = blueStats.coop;
			if(blueStats.activation) blueRankingPoints++;
			if(blueStats.winResult == WinResult.tie) blueRankingPoints++;
			if(blueStats.winResult == WinResult.victory) blueRankingPoints += 2;
			
		}

		let redLinks = 0;
		let redCoop: boolean | null = null;
		if(redStats != undefined) {
			redLinks = sum(redStats?.linksPerTeam);
			redCoop = redStats.coop;
			if(redStats.activation) redRankingPoints++;
			if(redStats.winResult == WinResult.tie) redRankingPoints++;
			if(redStats.winResult == WinResult.victory) redRankingPoints += 2;
		}

		const coopThreshold = blueCoop && redCoop ? 4 : 5;

		// sustainability
		if(blueLinks >= coopThreshold) blueRankingPoints++;
		if(redLinks >= coopThreshold) redRankingPoints++;

		return ({
			matchNumber: matchNumber,
			coop: blueCoop && redCoop,
			blue: {
				...blueStats,
				sustainability: redStats != undefined ? blueLinks >= coopThreshold : null,
				rankingPoints: blueRankingPoints

			},
			red: {
				...redStats,
				sustainability: blueStats != undefined ? redLinks >= coopThreshold : null,
				rankingPoints: redRankingPoints
			}
		});
	},

	teamStats: async (teamNumber: number) => {
		if(!(await dataTransform.allTeams()).includes(teamNumber)) return null;
		
		const allMatches = await db.getAllMatches();

		const allMatchesPlayed = allMatches.filter(match => {
			return match.team1Data.teamNumber == teamNumber
				|| match.team2Data.teamNumber == teamNumber
				|| match.team3Data.teamNumber == teamNumber;
		}).sort((a, b) => a.matchNumber - b.matchNumber);

		let thisTeamID = 0;

		const allTeamData = allMatchesPlayed.map(match => {
			if(match.team1Data.teamNumber == teamNumber) { thisTeamID = 1; return match.team1Data };
			if(match.team2Data.teamNumber == teamNumber) { thisTeamID = 2; return match.team2Data };
			if(match.team3Data.teamNumber == teamNumber) { thisTeamID = 3; return match.team3Data };
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
		let linkTotals: { top: number[], mid: number[], low: number[] } = { top: [], mid: [], low: [] };
		
		allMatchesPlayed.forEach(match => {
			RowType.forEach(row => {
				const scoreRow = match.scoreGrid[row];
				let scoreSum = { cubes: 0, cones: 0 };
				scoreRow.forEach((score, column) => {
					if(score.teamID != thisTeamID) return;
					if(score.item == ItemType.cone) scoreSum.cones++;
					if(score.item == ItemType.cube) scoreSum.cubes++;
					if(score.item != ItemType.none) heatMap[row][column]++;
				});

				let rowLinks = 0;
				for(let i = 0; i <= 6; i++) {
					if(scoreRow[i + 0].item != ItemType.none
					&& scoreRow[i + 1].item != ItemType.none
					&& scoreRow[i + 2].item != ItemType.none) {
						// link found, calculate team contribution
						if(scoreRow[i + 0].teamID == thisTeamID) rowLinks++;
						if(scoreRow[i + 1].teamID == thisTeamID) rowLinks++;
						if(scoreRow[i + 2].teamID == thisTeamID) rowLinks++;
						i += 3;
					}
				}
				rowLinks /= 3;
				
				linkTotals[row].push(rowLinks);
				itemTotals[row].push(scoreSum);
				scoreTotals[row].push(scoreSum.cones + scoreSum.cubes);
			});
		});

		const stats = {
			teamNumber: teamNumber,

			notes: allTeamData.map(t => t && t.notes).filter(note => note && note.length > 0),

			emojis: allTeamData.map(t => t && extractEmojis(t.notes)).filter(emojis => emojis && emojis.length > 0).map(a => a?.[0]),
			
			matches: {
				played: allMatchesPlayed.map(match => ({ matchNumber: match.matchNumber, alliance: match.alliance, winResult: match.winResult })),
				numberPlayed: allMatchesPlayed.length,
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
				scoreGrid: RowType.reduce((grid, row) => {
					grid[row] = {
						linkTotals: linkTotals[row],
						rawLinkTotal: sum(linkTotals[row]),
						meanLinks: mean(linkTotals[row]),
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