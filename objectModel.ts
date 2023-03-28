import { PropType, getModelForClass, mongoose, prop } from "@typegoose/typegoose";

// General reusable object models
export enum AllianceType { none = "none", blue = "blue", red = "red" }
export enum WinResult { defeat = "defeat", tie = "tie", victory = "victory" }

// Game-specific object models (2023)
export enum ChargeType { none = "none", docked = "docked", charged = "charged" }
export enum ItemType { none = "none", cube = "cube", cone = "cone" }

export class TeamInfo {
	@prop({ required: true, type: Number }) public teamNumber!: number;
}

export class TeamData {
	@prop({ required: true, type: TeamInfo })
	public teamInfo!: TeamInfo;

	@prop({ required: true, type: Number })
	public id!: 0 | 1 | 2 | 3;

	@prop({ required: true, type: Boolean })
	public autoMobility!: boolean;	

	@prop({ required: true, enum: ChargeType, type: String })
	public autoCharge!: ChargeType;

	@prop({ required: true, enum: ChargeType, type: String })
	public endCharge!: ChargeType;	

	@prop({ required: true, type: String }) public notes!: string;
}

export class Score {
	@prop({ required: true, type: Number })
	public teamID!: 0 | 1 | 2 | 3;

	@prop({ required: true, type: Boolean })
	public auto!: boolean;

	@prop({ required: true, enum: ItemType, type: String })
	public item!: ItemType;
}

export class ScoreGrid {
	@prop({ required: true, type: () => [Score] }, PropType.ARRAY) public low!: Score[];
	@prop({ required: true, type: () => [Score] }, PropType.ARRAY) public mid!: Score[];
	@prop({ required: true, type: () => [Score] }, PropType.ARRAY) public top!: Score[];
}

export class MatchData {
	@prop({ required: true, type: Date })
	public timestamp!: Date;

	@prop({ required: true, type: Number })
	public matchNumber!: number;

	@prop({ required: true, enum: AllianceType, type: String })
	public alliance!: AllianceType;

	@prop({ required: true, enum: WinResult, type: String })
	public winResult!: WinResult;

	@prop({ required: true, type: ScoreGrid })
	public scoreGrid!: ScoreGrid;

	@prop({ required: true, type: TeamData }) public team1Data!: TeamData;
	@prop({ required: true, type: TeamData }) public team2Data!: TeamData;
	@prop({ required: true, type: TeamData }) public team3Data!: TeamData;

	constructor() {
		this.timestamp = new Date(0);
		this.matchNumber = 0;
		this.alliance = AllianceType.none;
		this.winResult = WinResult.tie;
		this.scoreGrid = {
			low: [...Array(9)].map(_ => ({ auto: false, item: ItemType.none, teamID: 0 })),
			mid: [...Array(9)].map(_ => ({ auto: false, item: ItemType.none, teamID: 0 })),
			top: [...Array(9)].map(_ => ({ auto: false, item: ItemType.none, teamID: 0 })),
		}
		this.team1Data = {
			id: 1,
			autoMobility: false,
			autoCharge: ChargeType.none,
			endCharge: ChargeType.none,
			teamInfo: { teamNumber: 0 },
			notes: ""
		}
		this.team2Data = {
			id: 2,
			autoMobility: false,
			autoCharge: ChargeType.none,
			endCharge: ChargeType.none,
			teamInfo: { teamNumber: 0 },
			notes: ""
		}
		this.team3Data = {
			id: 3,
			autoMobility: false,
			autoCharge: ChargeType.none,
			endCharge: ChargeType.none,
			teamInfo: { teamNumber: 0 },
			notes: ""
		}
	}
}

export const MatchDataModel = getModelForClass(MatchData);
export const MatchDataCollection = mongoose.connection.collection("matchdatas");

import * as xmljs from "xml2js";

export const decodeXml = (xmlString: string) => {
	let data;
	xmljs.parseString(xmlString, (err, res) => {
		const xmlMatchData = res.MatchData;
		const matchNumber = parseInt(xmlMatchData["$"].matchNumber);
		const timestamp = parseInt(xmlMatchData["$"].timestamp);
		const alliance = xmlMatchData["Alliance"][0] as AllianceType;
		const allianceWin = xmlMatchData["AllianceWin"][0] as WinResult;
		
		const teams: TeamData[] = xmlMatchData["Team"].map((team: any): TeamData => {
			const id = parseInt(team.ID[0]) as 0 | 1 | 2 | 3;
			const teamNumber = parseInt(team.TeamNumber[0]);

			const autoMobility = team.AutoMobility[0] === "true";
			const autoCharge = parseInt(team.AutoCharge[0]);
			const autoChargeType = autoCharge === 2 ? "charged" : (autoCharge === 1 ? "docked" : "none");

			const endCharge = parseInt(team.EndCharge[0]);
			const endChargeType = endCharge === 2 ? "charged" : (endCharge === 1 ? "docked" : "none");

			const notes = team.Notes[0];

			return {
				id: id,
				teamInfo: { teamNumber: teamNumber },
				autoMobility: autoMobility,
				autoCharge: autoChargeType as ChargeType,
				endCharge: endChargeType as ChargeType,
				notes: notes
			};
		});

		const top: Score[] = [];
		const mid: Score[] = [];
		const low: Score[] = [];

		const topXml = xmlMatchData["ScoreGrid"][0]["Top"][0]["Score"];
		const midXml = xmlMatchData["ScoreGrid"][0]["Mid"][0]["Score"];
		const lowXml = xmlMatchData["ScoreGrid"][0]["Low"][0]["Score"];

		topXml.forEach((scoreXml: any) => {
			const auto = scoreXml["Auto"][0] == "true";
			const item = parseInt(scoreXml["Item"][0]);
			const itemType = ["none", "cone", "cube"][item] as ItemType;
			const teamID = parseInt(scoreXml["TeamID"][0]) as 0 | 1 | 2 | 3;

			top.push({
				teamID: teamID,
				auto: auto,
				item: itemType,
			});
		});
		midXml.forEach((scoreXml: any) => {
			const auto = scoreXml["Auto"][0] == "true";
			const item = parseInt(scoreXml["Item"][0]);
			const itemType = ["none", "cone", "cube"][item] as ItemType;
			const teamID = parseInt(scoreXml["TeamID"][0]) as 0 | 1 | 2 | 3;

			mid.push({
				teamID: teamID,
				auto: auto,
				item: itemType
			});
		});
		lowXml.forEach((scoreXml: any) => {
			const auto = scoreXml["Auto"][0] == "true";
			const item = parseInt(scoreXml["Item"][0]);
			const itemType = ["none", "cone", "cube"][item] as ItemType;
			const teamID = parseInt(scoreXml["TeamID"][0]) as 0 | 1 | 2 | 3;
			
			low.push({
				teamID: teamID,
				auto: auto,
				item: itemType,
			});
		});

		const scoreGrid = {
			"top": top,
			"mid": mid,
			"low": low
		};

		const matchData: MatchData = {
			matchNumber: matchNumber,
			timestamp: new Date(timestamp),
			alliance: alliance,
			winResult: allianceWin,
			team1Data: teams[0],
			team2Data: teams[1],
			team3Data: teams[2],
			scoreGrid: scoreGrid
		};

		data = matchData;
	});
	return data as unknown as MatchData;
}