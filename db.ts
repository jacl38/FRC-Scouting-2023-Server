import mongoose from "mongoose";
import { MatchData, MatchDataCollection } from "./objectModel";

const dbConnectString = "mongodb://127.0.0.1:27017/scouting";

const db = {
	init: async () => {
		await mongoose.connect(dbConnectString);
		console.log(`Scouting database connected at \x1b[96m${dbConnectString}\x1b[0m.`);
	},

	insertMatch: async (newMatchData: MatchData) => {
		const matchAlreadyExists = (await db.getAllMatches())
			.some(match => {
				return match.alliance == newMatchData.alliance
					&& match.matchNumber == newMatchData.matchNumber
			});

		if(matchAlreadyExists) {
			return Promise.reject(`Already exists in the database.`);
		} else {
			await MatchDataCollection.insertOne(newMatchData);
		}
	},

	getAllMatches: async () => (await MatchDataCollection.find().toArray() as unknown as MatchData[]).sort((a, b) => a.matchNumber - b.matchNumber),
}

export default db;