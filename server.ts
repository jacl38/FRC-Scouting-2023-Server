import express from "express";
import { json } from "body-parser";

import db from "./db";
import { MatchData, decodeXml } from "./objectModel";
import { dataTransform } from "./dataTransform";
const server = express();

const router = express.Router();

router.get("/data", async (request, response) => {
	response.send(await db.getAllMatches());
});

router.get("/stats", async (request, response) => {
	const allTeams = await dataTransform.allTeams();
	const allTeamStats = await Promise.all(allTeams.map(async teamNumber => await dataTransform.teamStats(teamNumber)));

	const statsObject = {
		teams: allTeamStats
	}
	response.send(statsObject);
});

router.get("/submit", async (request, response) => {
	response.send(`
		<title>Submission Upload Route</title>
		Enter this address in your scouting app to submit data
	`);
});

router.post("/submit", async (request, response) => {
	// Don't attempt submission if request body is empty
	if(request.body.length === 0) return;
	
	console.log("\n\x1b[94m[==Preparing submission upload==]\x1b[0m");

	// Parse XML string array into MatchData object array
	const submissionsList: MatchData[] = request.body.submissions.map((s: string) => {
		const decodedMatchData = decodeXml(s);
		console.log(`| \x1b[90mFound \x1b[0mMatch ${decodedMatchData.matchNumber} (\x1b[${{"red": 91, "blue": 94, "none": 95}[decodedMatchData.alliance]}m${decodedMatchData.alliance}\x1b[0m)`);
		return decodedMatchData;
	});
	
	console.log(`> Found ${submissionsList.length} submissions\n`);
	console.log(`> Sending to database...`);

	const rejections: { match: MatchData, reason: string }[] = [];

	// Attempt to send all matches from the submission into the database
	await Promise.all(submissionsList.map(async matchData => {

		await db.insertMatch(matchData).catch(reason => {
			// If the insertion is rejected, send it to the reject pile for printing later
			rejections.push({ match: matchData, reason: reason });
		});
		
	})) // After all submissions are processed (either inserted or rejected), send a summary message
	.then(() => {
		console.log(`\x1b[32mFinished uploading ${submissionsList.length - rejections.length} submissions.\x1b[0m\n`);
	
		// Show the rejected matches
		if(rejections.length > 0) {
			console.log(`\x1b[31mRejected ${rejections.length} submissions:\x1b[0m`);
			rejections.forEach(rejection => {
				// Print the rejected match and its reject reason
				console.log(`| Match ${rejection.match.matchNumber} (\x1b[${{"red": 91, "blue": 94, "none": 95}[rejection.match.alliance]}m${rejection.match.alliance}\x1b[0m) => \x1b[31m${rejection.reason}\x1b[0m`);
			});
		}
	});
});

server.use(json());
server.use(router);

const port = 8080;

server.listen(port, () => {
	console.log(`\n\x1b[33mScouting server started. \x1b[0m`);
	db.init();
});