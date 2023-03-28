import db from "./db";
import { ChargeType, TeamData, WinResult } from "./objectModel";

export const dataTransform = {
	allTeams: async () => {
		const allMatches = await db.getAllMatches();
		const allTeams: Set<number> = new Set();
		allMatches.forEach(match => {
			allTeams.add(match.team1Data.teamInfo.teamNumber);
			allTeams.add(match.team2Data.teamInfo.teamNumber);
			allTeams.add(match.team3Data.teamInfo.teamNumber);
		});
		return [...allTeams];
	},

	teamStats: async (teamNumber: number) => {
		if(!(await dataTransform.allTeams()).includes(teamNumber)) return null;
		
		const allMatches = await db.getAllMatches();

		const allMatchesPlayed = allMatches.filter(match => {
			return match.team1Data.teamInfo.teamNumber == teamNumber
				|| match.team2Data.teamInfo.teamNumber == teamNumber
				|| match.team3Data.teamInfo.teamNumber == teamNumber;
		});

		const allTeamData = allMatchesPlayed.map(match => {
			if(match.team1Data.teamInfo.teamNumber == teamNumber) return match.team1Data;
			if(match.team2Data.teamInfo.teamNumber == teamNumber) return match.team2Data;
			if(match.team3Data.teamInfo.teamNumber == teamNumber) return match.team3Data;
		});

		const stats = {
			teamNumber: teamNumber,
			matches: {
				played: allMatchesPlayed.length,
				won: allMatchesPlayed.filter(match => match.winResult == WinResult.victory).length,
				lost: allMatchesPlayed.filter(match => match.winResult == WinResult.defeat).length,
				tie: allMatchesPlayed.filter(match => match.winResult == WinResult.tie).length,
			},
			auto: {
				mobility: allTeamData.filter(teamData => teamData?.autoMobility == true).length,
				docked: allTeamData.filter(teamData => teamData?.autoCharge == ChargeType.docked).length,
				charged: allTeamData.filter(teamData => teamData?.autoCharge == ChargeType.charged).length
			},
			teleop: {

			},
			end: {
				docked: allTeamData.filter(teamData => teamData?.endCharge == ChargeType.docked).length,
				charged: allTeamData.filter(teamData => teamData?.endCharge == ChargeType.charged).length
			}
		}

		return stats;
	}
}